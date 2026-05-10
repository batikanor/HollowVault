import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 200): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

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

export function ethereumAddressFromUncompressed(publicKey: Uint8Array): string {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error(`expected 65-byte uncompressed pubkey (got ${publicKey.length} bytes)`);
  }
  return "0x" + bytesToHex(keccak_256(publicKey.slice(1)).slice(-20));
}

export function kmsSignerFromIdentity(sdk: OrbitportSDK, identity: DeviceIdentity): SignerHandle {
  return {
    identity,
    async sign(digest32) {
      if (digest32.length !== 32) {
        throw new Error(`KMS DIGEST sign requires 32 bytes, got ${digest32.length}`);
      }
      const result = await withRetry(() =>
        sdk.kms.sign({
          keyId: identity.keyId,
          message: digest32,
          signingAlgorithm: "ETHEREUM_SECP256K1",
          messageType: "DIGEST",
        }),
      );
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

export async function createKmsKey(
  sdk: OrbitportSDK,
  alias: string,
  description = "Hollow Vault key",
): Promise<DeviceIdentity> {
  const created = await sdk.kms.createKey({
    alias,
    keySpec: "ECC_SECG_P256K1",
    keyUsage: "SIGN_VERIFY",
    scheme: "ETHEREUM",
    description,
    tags: [],
  });
  const md = created.data.KeyMetadata;
  if (!md.Address) throw new Error("KMS createKey returned no Address");
  if (!md.PublicKey) throw new Error("KMS createKey returned no PublicKey");
  return {
    signerType: "kms",
    address: md.Address.toLowerCase(),
    publicKey: md.PublicKey,
    keyId: md.KeyId,
    createdAt: md.CreationDate ?? new Date().toISOString(),
  };
}

export function localSignerFromPrivateKey(privateKey: Uint8Array, createdAt?: string): SignerHandle {
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const identity: DeviceIdentity = {
    signerType: "local",
    address: ethereumAddressFromUncompressed(publicKey).toLowerCase(),
    publicKey: "0x" + bytesToHex(publicKey),
    keyId: "local",
    createdAt: createdAt ?? new Date().toISOString(),
  };
  return {
    identity,
    async sign(digest32) {
      // prehash:false matches KMS DIGEST mode so verify.ts doesn't branch
      const sigBytes = secp256k1.sign(digest32, privateKey, { format: "recovered", prehash: false });
      const parsed = secp256k1.Signature.fromBytes(sigBytes, "recovered");
      const compactSig = new Uint8Array(64);
      compactSig.set(hexToBytes(parsed.r.toString(16).padStart(64, "0")), 0);
      compactSig.set(hexToBytes(parsed.s.toString(16).padStart(64, "0")), 32);
      return { compactSig, recoveryId: parsed.recovery as number };
    },
  };
}

export function generateLocalSigner(): { signer: SignerHandle; privateKey: Uint8Array } {
  const privateKey = secp256k1.utils.randomSecretKey();
  return { signer: localSignerFromPrivateKey(privateKey), privateKey };
}
