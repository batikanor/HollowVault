/**
 * Serverless boot state. Mirrors signer/src/cache.ts but reads identity
 * from env vars instead of disk — Vercel Lambdas have no persistent FS.
 */
import {
  createKmsKey,
  currentMode,
  generateLocalSigner,
  hasOrbitportCredentials,
  kmsSignerFromIdentity,
  orbitportSdk,
  reAttestPublicKeyHex,
  type DeviceIdentity,
  type SignerHandle,
} from "@hollow-vault/core";

export interface SetupPayload {
  setupRequired: true;
  reason: string;
  steps: string[];
  signupUrl: string;
  envFile: string;
}

const SETUP_STEPS = [
  "Open https://accounts.spacecomputer.io/",
  "Sign up or log in.",
  "On the dashboard, generate an OAuth Client ID + Client Secret pair.",
  "Set ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET in the Vercel project (Settings → Environment Variables).",
  "Redeploy.",
];

const KMS_ALIAS_PREFIX = "hollow-vault-prod";

export function setupPayload(): SetupPayload | null {
  if (currentMode() === "real" && !hasOrbitportCredentials()) {
    return {
      setupRequired: true,
      reason: "ORBITPORT_MODE=real but ORBITPORT_CLIENT_ID / ORBITPORT_CLIENT_SECRET are not set in the deployment.",
      steps: SETUP_STEPS,
      signupUrl: "https://accounts.spacecomputer.io/",
      envFile: "Vercel project Environment Variables",
    };
  }
  return null;
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

let cached: SignerHandle | null = null;

export async function getSigner(): Promise<SignerHandle> {
  if (cached) return cached;
  if (currentMode() !== "real") {
    cached = generateLocalSigner().signer;
    return cached;
  }
  const sdk = orbitportSdk();
  const fromEnv = identityFromEnv();
  if (fromEnv) {
    cached = kmsSignerFromIdentity(sdk, fromEnv);
    return cached;
  }
  // Cold start with no preconfigured key — mint one for this Lambda lifetime.
  const alias = `${KMS_ALIAS_PREFIX}-${Date.now()}`;
  const identity = await createKmsKey(sdk, alias, "Hollow Vault production key (auto-minted)");
  console.log(
    `[signer] auto-minted KMS key — promote to env to deduplicate across cold starts: ` +
      `HOLLOW_VAULT_KMS_KEY_ID=${identity.keyId} HOLLOW_VAULT_KMS_ADDRESS=${identity.address}`,
  );
  cached = kmsSignerFromIdentity(sdk, identity);
  return cached;
}

export function mockSatellitePublicKey(): string | null {
  return currentMode() === "mock" ? reAttestPublicKeyHex() : null;
}

// Test-only: lets unit tests exercise the env-driven boot path repeatedly.
export function __resetSignerCacheForTest(): void {
  cached = null;
}

export { currentMode };
