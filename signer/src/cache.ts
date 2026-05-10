/**
 * File-backed identity cache for the long-running Express signer.
 * Vercel uses env vars instead (see web/lib/server-state.ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils.js";
import {
  createKmsKey,
  generateLocalSigner,
  kmsSignerFromIdentity,
  localSignerFromPrivateKey,
  orbitportSdk,
  type DeviceIdentity,
  type SignerHandle,
} from "@hollow-vault/core";
import { defaultDataDir } from "./paths.js";

const FILE_MODE = 0o600;
const KMS_ALIAS_PREFIX = "hollow-vault-v1";

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
    if (raw?.signerType === "kms" && raw.keyId && raw.address && raw.publicKey) return raw;
  } catch {
    // corrupt cache — fall through and recreate
  }
  return null;
}

function writeIdentity(path: string, identity: DeviceIdentity): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(identity, null, 2), { mode: FILE_MODE });
}

export async function ensureKmsSigner(aliasPrefix?: string): Promise<SignerHandle> {
  const sdk = orbitportSdk();
  const cachePath = kmsCachePath();
  const cached = readCachedKmsIdentity(cachePath);
  if (cached) {
    console.log(`[signer] reused KMS key  alias=${cached.keyId}  address=${cached.address}`);
    return kmsSignerFromIdentity(sdk, cached);
  }
  const alias = `${aliasPrefix ?? KMS_ALIAS_PREFIX}-${Date.now()}`;
  const identity = await createKmsKey(sdk, alias, "Hollow Vault device key");
  writeIdentity(cachePath, identity);
  console.log(`[signer] created KMS key  alias=${alias}  keyId=${identity.keyId}  address=${identity.address}`);
  return kmsSignerFromIdentity(sdk, identity);
}

export function ensureLocalSigner(): SignerHandle {
  const cachePath = localCachePath();
  if (existsSync(cachePath)) {
    const raw = JSON.parse(readFileSync(cachePath, "utf8")) as { privateKey: string; createdAt: string };
    return localSignerFromPrivateKey(hexToBytes(raw.privateKey), raw.createdAt);
  }
  const { signer, privateKey } = generateLocalSigner();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(
    cachePath,
    JSON.stringify({ privateKey: bytesToHex(privateKey), createdAt: signer.identity.createdAt }, null, 2),
    { mode: FILE_MODE },
  );
  return signer;
}
