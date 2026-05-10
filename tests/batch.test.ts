import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  generateLocalSigner,
  getCosmicEntropy,
  signBatch,
  type SignerHandle,
} from "@hollow-vault/core";
import { verifyAttestation } from "../web/lib/verify.js";

process.env.ORBITPORT_MODE = "mock";

let signer: SignerHandle;

before(() => { signer = generateLocalSigner().signer; });

describe("batch sub-seed derivation", () => {
  it("produces N attestations from one master cosmic draw", async () => {
    const cosmic = await getCosmicEntropy();
    const messages = ["a", "b", "c", "d", "e"];
    const result = await signBatch(signer, messages, cosmic);
    assert.equal(result.attestations.length, messages.length);
  });

  it("derives unique sub-seeds for distinct messages", async () => {
    const cosmic = await getCosmicEntropy();
    const messages = Array.from({ length: 20 }, (_, i) => `msg-${i}`);
    const result = await signBatch(signer, messages, cosmic);
    const subSeeds = result.attestations.map((a) => a.cosmic.seed);
    assert.equal(new Set(subSeeds).size, 20, "all sub-seeds should be unique");
  });

  it("derives unique sub-seeds even when two messages are byte-identical", async () => {
    const cosmic = await getCosmicEntropy();
    const repeated = ["same", "same", "same"];
    const result = await signBatch(signer, repeated, cosmic);
    const subSeeds = result.attestations.map((a) => a.cosmic.seed);
    assert.equal(new Set(subSeeds).size, 3, "index disambiguates equal messages");
  });

  it("is deterministic — same inputs yield the same sub-seeds", async () => {
    const cosmic = await getCosmicEntropy();
    const messages = ["x", "y", "z"];
    const first = await signBatch(signer, messages, cosmic);
    const second = await signBatch(signer, messages, cosmic);
    for (let i = 0; i < messages.length; i++) {
      assert.equal(
        first.attestations[i].cosmic.seed,
        second.attestations[i].cosmic.seed,
      );
    }
  });

  it("computes a stable batchId from the master seed", async () => {
    const cosmic = await getCosmicEntropy();
    const a = await signBatch(signer, ["one"], cosmic);
    const b = await signBatch(signer, ["two"], cosmic);
    assert.equal(a.batchId, b.batchId, "batchId depends only on master seed");
  });

  it("each sub-attestation independently passes the full 5-check verifier", async () => {
    const cosmic = await getCosmicEntropy();
    const messages = ["sub-verify-1", "sub-verify-2", "sub-verify-3"];
    const { attestations } = await signBatch(signer, messages, cosmic);
    for (const att of attestations) {
      const report = verifyAttestation(att);
      assert.equal(report.ok, true, `sub-attestation should verify: ${JSON.stringify(report.steps.filter((s) => !s.ok))}`);
    }
  });

  it("sub-attestations carry distinct (re-attested) satellite signatures", async () => {
    const cosmic = await getCosmicEntropy();
    const { attestations } = await signBatch(signer, ["a", "b", "c"], cosmic);
    const sigs = new Set(attestations.map((a) => a.cosmic.satelliteSignature));
    assert.equal(sigs.size, 3, "each sub-seed must get its own satellite signature");
  });

  it("sub-attestations inherit the master timestamp", async () => {
    const cosmic = await getCosmicEntropy();
    const { attestations } = await signBatch(signer, ["m1", "m2"], cosmic);
    for (const att of attestations) {
      assert.equal(att.cosmic.timestamp, cosmic.timestamp);
    }
  });
});
