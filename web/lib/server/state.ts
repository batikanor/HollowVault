/**
 * Shared boot state for serverless API routes. Returns either a ready
 * SignerHandle or a setupRequired payload describing what env vars to set.
 */
import { currentMode, hasCredentials, exportReAttestPublicKey } from "./orbitport";
import { ensureKmsSigner, ensureLocalSigner, type SignerHandle } from "./signer";

export interface SetupPayload {
  setupRequired: true;
  reason: string;
  steps: string[];
  signupUrl: string;
  envFile: string;
}

export function setupPayload(): SetupPayload | null {
  if (currentMode() === "real" && !hasCredentials()) {
    return {
      setupRequired: true,
      reason: "ORBITPORT_MODE=real but ORBITPORT_CLIENT_ID / ORBITPORT_CLIENT_SECRET are not set in the deployment.",
      steps: [
        "Open https://accounts.spacecomputer.io/",
        "Sign up or log in.",
        "On the dashboard, generate an OAuth Client ID + Client Secret pair.",
        "Set ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET in the Vercel project (Settings → Environment Variables).",
        "Redeploy.",
      ],
      signupUrl: "https://accounts.spacecomputer.io/",
      envFile: "Vercel project Environment Variables",
    };
  }
  return null;
}

export async function getSigner(): Promise<SignerHandle> {
  if (currentMode() === "real") return ensureKmsSigner();
  return ensureLocalSigner();
}

export function mockSatellitePublicKey(): string | null {
  return currentMode() === "mock" ? exportReAttestPublicKey() : null;
}
