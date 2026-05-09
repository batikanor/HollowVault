/**
 * Type definitions shared between the signer service and the web app's
 * verifier. These mirror the shapes returned by signer/src/attestation.ts —
 * keep them in sync.
 */

export interface CosmicEntropy {
  seed: string;
  timestamp: string;
  satelliteSignature: string;
  satellitePublicKey: string;
  source: "real" | "mock";
}

export interface Attestation {
  message: string;
  messageHash: string;
  cosmic: CosmicEntropy;
  payloadHash: string;
  signature: string;
  recoveryId: number;
  signerPublicKey: string;
  signerAddress: string;
  signedAt: string;
  meta: {
    scheme: "hollow-vault/v1";
    nonceMode: string;
    deviceCreatedAt: string;
  };
}

export interface VerificationStep {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface VerificationReport {
  ok: boolean;
  steps: VerificationStep[];
  signerAddress?: string;
  cosmicAge?: string;
}
