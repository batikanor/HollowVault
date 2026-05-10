import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, postJSON, clone, flipHexBit } from "../runner.mjs";

let attestation;

describe(`[e2e] /api/sign → /api/verify roundtrip @ ${BASE_URL}`, () => {
  before(async () => {
    const { status, body } = await postJSON("/api/sign", { message: `e2e roundtrip ${Date.now()}` });
    assert.equal(status, 200, `sign returned ${status}: ${JSON.stringify(body)}`);
    attestation = body;
  });

  it("attestation has the expected envelope shape", () => {
    assert.match(attestation.messageHash, /^0x[0-9a-f]{64}$/);
    assert.match(attestation.payloadHash, /^0x[0-9a-f]{64}$/);
    assert.match(attestation.signature, /^0x[0-9a-f]{128}$/);
    assert.ok(attestation.recoveryId === 0 || attestation.recoveryId === 1);
    assert.match(attestation.signerPublicKey, /^0x04[0-9a-f]{128}$/);
    assert.match(attestation.signerAddress, /^0x[0-9a-f]{40}$/);
    assert.equal(attestation.meta.scheme, "hollow-vault/v1");
    assert.match(attestation.cosmic.seed, /^[0-9a-f]{64}$/);
    assert.match(attestation.cosmic.satelliteSignature, /^[0-9a-f]{128}$/);
  });

  it("verify returns ok=true with all 5 checks green", async () => {
    const { status, body } = await postJSON("/api/verify", attestation);
    assert.equal(status, 200);
    assert.equal(body.ok, true, `expected ok=true, got: ${JSON.stringify(body)}`);
    assert.equal(body.steps.length, 5);
    for (const step of body.steps) {
      assert.equal(step.ok, true, `step "${step.label}" should be green: ${step.detail}`);
    }
    assert.equal(body.signerAddress.toLowerCase(), attestation.signerAddress.toLowerCase());
  });

  it("tamper: changing the message after signing fails msg-hash", async () => {
    const tampered = clone(attestation);
    tampered.message = "totally different message that wasn't signed";
    const { body } = await postJSON("/api/verify", tampered);
    assert.equal(body.ok, false);
    assert.equal(body.steps.find((s) => s.id === "msg-hash").ok, false);
  });

  it("tamper: replacing the cosmic seed fails the binding check", async () => {
    const tampered = clone(attestation);
    tampered.cosmic.seed = "0".repeat(64);
    const { body } = await postJSON("/api/verify", tampered);
    assert.equal(body.ok, false);
    assert.equal(body.steps.find((s) => s.id === "binding").ok, false);
  });

  it("tamper: corrupting the satellite signature fails sat-sig", async () => {
    const tampered = clone(attestation);
    tampered.cosmic.satelliteSignature = flipHexBit(tampered.cosmic.satelliteSignature, 10);
    const { body } = await postJSON("/api/verify", tampered);
    assert.equal(body.ok, false);
    assert.equal(body.steps.find((s) => s.id === "sat-sig").ok, false);
  });

  it("tamper: flipping a bit in the ECDSA signature fails ecdsa", async () => {
    const tampered = clone(attestation);
    tampered.signature = "0x" + flipHexBit(tampered.signature.slice(2), 16);
    const { body } = await postJSON("/api/verify", tampered);
    assert.equal(body.ok, false);
    assert.equal(body.steps.find((s) => s.id === "ecdsa").ok, false);
  });

  it("tamper: ancient cosmic timestamp fails freshness", async () => {
    const tampered = clone(attestation);
    tampered.cosmic.timestamp = "2020-01-01T00:00:00.000Z";
    const { body } = await postJSON("/api/verify", tampered);
    assert.equal(body.ok, false);
    assert.equal(body.steps.find((s) => s.id === "fresh").ok, false);
  });

  it("tamper: replacing the claimed signer address fails ecdsa recovery", async () => {
    const tampered = clone(attestation);
    tampered.signerAddress = "0x" + "1".repeat(40);
    const { body } = await postJSON("/api/verify", tampered);
    assert.equal(body.ok, false);
    assert.equal(body.steps.find((s) => s.id === "ecdsa").ok, false);
  });

  it("two signs of the same message produce different cosmic seeds (no replay)", async () => {
    const a = (await postJSON("/api/sign", { message: "replay-check" })).body;
    const b = (await postJSON("/api/sign", { message: "replay-check" })).body;
    assert.notEqual(a.cosmic.seed, b.cosmic.seed);
    assert.notEqual(a.signature, b.signature);
    assert.equal(a.signerAddress, b.signerAddress, "same KMS key");
  });
});
