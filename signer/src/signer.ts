import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { defaultDataDir } from "./paths.js";

export type SignerType = "kms" | "local";

export interface DeviceIdentity {
  signerType: SignerType;
  address: string;
  publicKey: string;
  keyId: string;
  createdAt: string;
}

export interface SignerHandle {
  identity: DeviceIdentity;
  sign: (digest32: Uint8Array) => Promise<{ compactSig: Uint8Array; recoveryId: number }>;
}

const SIGNER_FILE_MODE = 0o600;
const KMS_ALIAS_PREFIX = "hollow-vault-v1";

function ethereumAddressFromUncompressed(publicKey: Uint8Array): string {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error(`expected 65-byte uncompressed pubkey (got ${publicKey.length} bytes)`);
  }
  return "0x" + bytesToHex(keccak_256(publicKey.slice(1)).slice(-20));
}

function kmsCachePath(): string {
  return process.env.KMS_KEY_CACHE_PATH ?? `${defaultDataDir()}/kms-key.json`;
}

function localCachePath(): string {
  return process.env.KEYSTORE_PATH ?? `${defaultDataDir()}/local-key.json`;
}

function readCachedKmsIdentity(path: string): DeviceIdentity | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as DeviceIdentity;
    if (raw?.signerType === "kms" && raw.keyId && raw.address && raw.publicKey) {
      return raw;
    }
  } catch {
    /* corrupt cache — fall through and recreate */
  }
  return null;
}

export async function ensureKmsSigner(sdk: OrbitportSDK, aliasPrefix?: string): Promise<SignerHandle> {
  const cachePath = kmsCachePath();
  let identity = readCachedKmsIdentity(cachePath);

  if (identity) {
    console.log(`[signer] reused KMS key  alias=${identity.keyId}  address=${identity.address}`);
  } else {
    // Gateway requires Description and Tags to be present; SDK type marks them optional.
    // Alias must match `^[A-Za-z0-9_-]+$` (no slashes).
    const alias = `${aliasPrefix ?? KMS_ALIAS_PREFIX}-${Date.now()}`;
    const created = await sdk.kms.createKey({
      alias,
      keySpec: "ECC_SECG_P256K1",
      keyUsage: "SIGN_VERIFY",
      scheme: "ETHEREUM",
      description: "Hollow Vault device key",
      tags: [],
    });
    const md = created.data.KeyMetadata;
    if (!md.Address) throw new Error("KMS createKey returned no Address");
    if (!md.PublicKey) throw new Error("KMS createKey returned no PublicKey");
    identity = {
      signerType: "kms",
      address: md.Address.toLowerCase(),
      publicKey: md.PublicKey,
      keyId: md.KeyId,
      createdAt: md.CreationDate ?? new Date().toISOString(),
    };
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(identity, null, 2), { mode: SIGNER_FILE_MODE });
    console.log(`[signer] created KMS key  alias=${md.Alias}  keyId=${md.KeyId}  address=${md.Address}`);
  }

  const stableIdentity = identity;

  return {
    identity: stableIdentity,
    async sign(digest32) {
      if (digest32.length !== 32) {
        throw new Error(`KMS DIGEST sign requires 32 bytes, got ${digest32.length}`);
      }
      const result = await sdk.kms.sign({
        keyId: stableIdentity.keyId,
        message: digest32,
        signingAlgorithm: "ETHEREUM_SECP256K1",
        messageType: "DIGEST",
      });
      const sigHex = result.data.Signature.replace(/^0x/, "");
      const sigBytes = hexToBytes(sigHex);
      if (sigBytes.length !== 65) {
        throw new Error(`KMS returned ${sigBytes.length}-byte signature, expected 65 (r||s||v)`);
      }
      const compactSig = sigBytes.slice(0, 64);
      const vByte = sigBytes[64];
      const recoveryId = vByte === 27 || vByte === 28 ? vByte - 27 : vByte & 1;
      return { compactSig, recoveryId };
    },
  };
}

export function ensureLocalSigner(): SignerHandle {
  const cachePath = localCachePath();
  let privateKey: Uint8Array;
  let createdAt: string;

  if (existsSync(cachePath)) {
    const raw = JSON.parse(readFileSync(cachePath, "utf8")) as { privateKey: string; createdAt: string };
    privateKey = hexToBytes(raw.privateKey);
    createdAt = raw.createdAt;
  } else {
    privateKey = secp256k1.utils.randomSecretKey();
    createdAt = new Date().toISOString();
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({ privateKey: bytesToHex(privateKey), createdAt }, null, 2),
      { mode: SIGNER_FILE_MODE },
    );
  }

  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const identity: DeviceIdentity = {
    signerType: "local",
    address: ethereumAddressFromUncompressed(publicKey).toLowerCase(),
    publicKey: "0x" + bytesToHex(publicKey),
    keyId: "local",
    createdAt,
  };

  return {
    identity,
    async sign(digest32) {
      // `prehash: false` keeps the byte layout compatible with KMS DIGEST mode
      // so verify.ts doesn't need to branch on signer type.
      const sigBytes = secp256k1.sign(digest32, privateKey, {
        format: "recovered",
        prehash: false,
      });
      const parsed = secp256k1.Signature.fromBytes(sigBytes, "recovered");
      const compactSig = new Uint8Array(64);
      compactSig.set(hexToBytes(parsed.r.toString(16).padStart(64, "0")), 0);
      compactSig.set(hexToBytes(parsed.s.toString(16).padStart(64, "0")), 32);
      return { compactSig, recoveryId: parsed.recovery as number };
    },
  };
}
