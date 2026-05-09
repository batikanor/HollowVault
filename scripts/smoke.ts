/**
 * End-to-end smoke test. Runs the signer in-process (LocalSigner — no network,
 * no KMS), signs a message, and verifies it using the same library code the
 * web app and CLI use. Useful both as CI and as a quick sanity check before
 * a demo.
 *
 * Run with:    npm run smoke
 *
 * For the KMS path, run `npm run dev` with real credentials in `.env` and
 * use the API directly — KMS createKey is a real network call we don't want
 * to hit on every smoke run.
 */
process.env.KEYSTORE_PATH = process.env.KEYSTORE_PATH ?? "/tmp/hollow-vault-smoke.json";
process.env.ORBITPORT_MODE = "mock";

import { ensureLocalSigner } from "../signer/src/signer.js";
import { getCosmicEntropy } from "../signer/src/orbitport.js";
import { signAttestation } from "../signer/src/attestation.js";
import { verifyAttestation } from "../web/lib/verify.js";

async function main() {
  console.log("→ booting LocalSigner (mock mode)");
  const signer = ensureLocalSigner();
  console.log("  signerType:", signer.identity.signerType);
  console.log("  address:   ", signer.identity.address);

  console.log("→ requesting cosmic entropy (mock satellite)");
  const cosmic = await getCosmicEntropy();
  console.log("  seed:    0x" + cosmic.seed.slice(0, 24) + "…");
  console.log("  ts:     ", cosmic.timestamp);

  console.log("→ signing");
  const att = await signAttestation(signer, "smoke test message", cosmic);
  console.log("  sig:     " + att.signature.slice(0, 24) + "…");
  console.log("  meta.signerType:", att.meta.signerType);
  console.log("  meta.nonceMode :", att.meta.nonceMode);

  console.log("→ verifying");
  const report = verifyAttestation(att);
  for (const s of report.steps) {
    console.log(`  ${s.ok ? "✓" : "✗"} ${s.label}`);
    if (!s.ok) console.log("       " + s.detail);
  }
  if (!report.ok) {
    console.error("\nSMOKE TEST FAILED");
    process.exit(1);
  }
  console.log("\n✓ smoke test passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
