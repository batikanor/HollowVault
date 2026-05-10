import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getDrandInfo, getDrandRound } from "../signer/src/drand.js";

process.env.ORBITPORT_MODE = "mock";

describe("drand-shape adapter — /info", () => {
  let info: Awaited<ReturnType<typeof getDrandInfo>>;
  before(async () => { info = await getDrandInfo(); });

  it("declares a 64-char hex public key", () => {
    assert.match(info.public_key, /^[0-9a-f]{64}$/);
  });

  it("publishes a 60-second period (matches the IPFS beacon)", () => {
    assert.equal(info.period, 60);
  });

  it("declares a non-zero genesis time", () => {
    assert.ok(typeof info.genesis_time === "number" && info.genesis_time > 0);
  });

  it("uses our own scheme ID", () => {
    assert.equal(info.schemeID, "hollow-vault-v1-ed25519");
  });

  it("ships a non-empty chain hash", () => {
    assert.match(info.hash, /^[0-9a-f]{64}$/);
    assert.equal(info.hash, info.groupHash);
  });

  it("identifies the beacon", () => {
    assert.equal(info.metadata.beaconID, "hollow-vault");
  });
});

describe("drand-shape adapter — /public/{round}", () => {
  it("returns a structurally valid round", async () => {
    const r = await getDrandRound(1);
    assert.equal(r.round, 1);
    assert.match(r.randomness, /^[0-9a-f]{64}$/);
    assert.match(r.signature, /^[0-9a-f]{128}$/);
    assert.match(r.previous_signature, /^[0-9a-f]{64,128}$/);
    assert.ok(typeof r.round_start_time === "number");
  });

  it("memoises within 30s — same round returns the same randomness", async () => {
    const a = await getDrandRound(2);
    const b = await getDrandRound(2);
    assert.equal(a.randomness, b.randomness);
    assert.equal(a.signature, b.signature);
  });

  it("different rounds produce different randomness", async () => {
    const a = await getDrandRound(3);
    const b = await getDrandRound(4);
    assert.notEqual(a.randomness, b.randomness);
  });

  it("chain integrity: round n's previous_signature equals round (n-1)'s signature", async () => {
    const prev = await getDrandRound(10);
    const next = await getDrandRound(11);
    assert.equal(next.previous_signature, prev.signature);
  });

  it("/public/latest derives a round from current time", async () => {
    const r = await getDrandRound();
    assert.ok(r.round >= 1);
    assert.match(r.randomness, /^[0-9a-f]{64}$/);
  });
});
