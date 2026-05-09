/**
 * Batch signing. cTRNG is bandwidth-limited; we pull one master seed and
 * derive per-message sub-seeds via HMAC-SHA256 so a 50-message batch costs
 * one orbital fetch instead of fifty.
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { CosmicEntropy } from "./orbitport.js";
import { fromHex } from "./orbitport.js";
import type { SignerHandle } from "./signer.js";
import { type Attestation, signAttestation } from "./attestation.js";

const SUB_SEED_DOMAIN = "cosmic-batch/v1";
const BATCH_ID_DOMAIN = "cosmic-batch-id/v1";

function deriveSubSeed(masterSeedHex: string, index: number, message: string): Uint8Array {
  const salt = new TextEncoder().encode(`${SUB_SEED_DOMAIN}|${index}|${message}`);
  return hmac(sha256, fromHex(masterSeedHex), salt);
}

function computeBatchId(masterSeedHex: string): string {
  const digest = sha256(new TextEncoder().encode(`${BATCH_ID_DOMAIN}|${masterSeedHex}`));
  return "0x" + bytesToHex(digest);
}

export async function signBatch(
  signer: SignerHandle,
  messages: string[],
  cosmic: CosmicEntropy,
): Promise<{ batchId: string; cosmic: CosmicEntropy; attestations: Attestation[] }> {
  const attestations: Attestation[] = [];
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    const subSeed = deriveSubSeed(cosmic.seed, index, message);
    const cosmicForThisMessage: CosmicEntropy = { ...cosmic, seed: bytesToHex(subSeed) };
    attestations.push(await signAttestation(signer, message, cosmicForThisMessage));
  }
  return { batchId: computeBatchId(cosmic.seed), cosmic, attestations };
}
