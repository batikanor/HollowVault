/**
 * Vercel-friendly signer. Mirrors signer/src/signer.ts but with no on-disk
 * cache — Vercel's serverless filesystem is read-only, and cold-start state
 * is not persisted. We cache the SignerHandle in module scope so subsequent
 * invocations on a warm Lambda reuse it.
 *
 * Production deployments should set HOLLOW_VAULT_KMS_KEY_ID +
 * HOLLOW_VAULT_KMS_PUBLIC_KEY + HOLLOW_VAULT_KMS_ADDRESS env vars so every
 * cold-started Lambda reuses the same KMS key. The deploy script does this
 * automatically via `vercel env add`.
 */
import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { orbitportSdk } from "./orbitport";

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

const KMS_ALIAS_PREFIX = "hollow-vault-prod";

function ethereumAddressFromUncompressed(publicKey: Uint8Array): string {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error(`expected 65-byte uncompressed pubkey (got ${publicKey.length} bytes)`);
  }
  return "0x" + bytesToHex(keccak_256(publicKey.slice(1)).slice(-20));
}

let cachedSigner: SignerHandle | null = null;

function makeKmsHandle(sdk: OrbitportSDK, identity: DeviceIdentity): SignerHandle {
  return {
    identity,
    async sign(digest32) {
      if (digest32.length !== 32) {
        throw new Error(`KMS DIGEST sign requires 32 bytes, got ${digest32.length}`);
      }
      const result = await sdk.kms.sign({
        keyId: identity.keyId,
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

function identityFromEnv(): DeviceIdentity | null {
  const keyId = process.env.HOLLOW_VAULT_KMS_KEY_ID;
  const publicKey = process.env.HOLLOW_VAULT_KMS_PUBLIC_KEY;
  const address = process.env.HOLLOW_VAULT_KMS_ADDRESS;
  if (!keyId || !publicKey || !address) return null;
  return {
    signerType: "kms",
    address: address.toLowerCase(),
    publicKey,
    keyId,
    createdAt: process.env.HOLLOW_VAULT_KMS_CREATED_AT ?? new Date(0).toISOString(),
  };
}

export async function ensureKmsSigner(): Promise<SignerHandle> {
  if (cachedSigner) return cachedSigner;

  const sdk = orbitportSdk();
  const fromEnv = identityFromEnv();
  if (fromEnv) {
    cachedSigner = makeKmsHandle(sdk, fromEnv);
    return cachedSigner;
  }

  // Cold start with no preconfigured key — mint one for the lifetime of this
  // Lambda instance. Logs the keyId so an operator can promote it to env.
  const alias = `${KMS_ALIAS_PREFIX}-${Date.now()}`;
  const created = await sdk.kms.createKey({
    alias,
    keySpec: "ECC_SECG_P256K1",
    keyUsage: "SIGN_VERIFY",
    scheme: "ETHEREUM",
    description: "Hollow Vault production key (auto-minted)",
    tags: [],
  });
  const md = created.data.KeyMetadata;
  if (!md.Address) throw new Error("KMS createKey returned no Address");
  if (!md.PublicKey) throw new Error("KMS createKey returned no PublicKey");
  const identity: DeviceIdentity = {
    signerType: "kms",
    address: md.Address.toLowerCase(),
    publicKey: md.PublicKey,
    keyId: md.KeyId,
    createdAt: md.CreationDate ?? new Date().toISOString(),
  };
  console.log(
    `[signer] auto-minted KMS key — promote to env to deduplicate across cold starts: ` +
      `HOLLOW_VAULT_KMS_KEY_ID=${md.KeyId} HOLLOW_VAULT_KMS_ADDRESS=${md.Address}`,
  );
  cachedSigner = makeKmsHandle(sdk, identity);
  return cachedSigner;
}

export function ensureLocalSigner(): SignerHandle {
  // Mock-mode signer for environments without KMS credentials. Generates a
  // throwaway key per Lambda cold start.
  const privateKey = secp256k1.utils.randomSecretKey();
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const identity: DeviceIdentity = {
    signerType: "local",
    address: ethereumAddressFromUncompressed(publicKey).toLowerCase(),
    publicKey: "0x" + bytesToHex(publicKey),
    keyId: "local",
    createdAt: new Date().toISOString(),
  };
  return {
    identity,
    async sign(digest32) {
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
