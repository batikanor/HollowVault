import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, postJSON } from "../runner.mjs";

describe(`[e2e] /api/sign-batch @ ${BASE_URL}`, () => {
  it("signs N messages from one master cosmic draw", async () => {
    const messages = ["alpha", "beta", "gamma", "delta", "epsilon"];
    const { status, body } = await postJSON("/api/sign-batch", { messages });
    assert.equal(status, 200);
    assert.equal(body.attestations.length, messages.length);
    assert.match(body.batchId, /^0x[0-9a-f]{64}$/);
  });

  it("each attestation in the batch is independently verifiable", async () => {
    const messages = ["e2e-batch-a", "e2e-batch-b", "e2e-batch-c"];
    const { body: batch } = await postJSON("/api/sign-batch", { messages });
    for (const att of batch.attestations) {
      const { body: report } = await postJSON("/api/verify", att);
      assert.equal(report.ok, true, `verify failed for sub-attestation: ${JSON.stringify(report.steps)}`);
    }
  });

  it("sub-seeds are unique across the batch", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => `batch-uniq-${i}`);
    const { body } = await postJSON("/api/sign-batch", { messages });
    const seeds = body.attestations.map((a) => a.cosmic.seed);
    assert.equal(new Set(seeds).size, messages.length);
  });

  it("all attestations carry the same signer address", async () => {
    const { body } = await postJSON("/api/sign-batch", { messages: ["one", "two", "three"] });
    const addrs = new Set(body.attestations.map((a) => a.signerAddress));
    assert.equal(addrs.size, 1);
  });

  it("batchId depends only on master seed (independent of messages)", async () => {
    // Two separate calls produce different master seeds → different batchIds.
    const a = (await postJSON("/api/sign-batch", { messages: ["x"] })).body;
    const b = (await postJSON("/api/sign-batch", { messages: ["x"] })).body;
    assert.notEqual(a.batchId, b.batchId);
  });

  it("rejects an empty messages array (zod min(1))", async () => {
    const { status, body } = await postJSON("/api/sign-batch", { messages: [] });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid request");
  });

  it("rejects > 50 messages (zod max(50))", async () => {
    const messages = Array.from({ length: 51 }, (_, i) => `m-${i}`);
    const { status } = await postJSON("/api/sign-batch", { messages });
    assert.equal(status, 400);
  });
});
