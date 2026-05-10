import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  generateLocalSigner,
  getCosmicEntropy,
  signBatch,
  type SignerHandle,
} from "@hollow-vault/core";

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
});
