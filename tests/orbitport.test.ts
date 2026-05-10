import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  currentMode,
  fromHex,
  getCosmicEntropy,
  hasOrbitportCredentials,
  reAttestPublicKeyHex,
} from "@hollow-vault/core";

const ENV_KEYS = ["ORBITPORT_MODE", "ORBITPORT_CLIENT_ID", "ORBITPORT_CLIENT_SECRET"] as const;
let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

describe("hasOrbitportCredentials", () => {
  it("returns false when both credentials are missing", () => {
    assert.equal(hasOrbitportCredentials(), false);
  });
  it("returns false when only one credential is set", () => {
    process.env.ORBITPORT_CLIENT_ID = "id";
    assert.equal(hasOrbitportCredentials(), false);
    delete process.env.ORBITPORT_CLIENT_ID;
    process.env.ORBITPORT_CLIENT_SECRET = "secret";
    assert.equal(hasOrbitportCredentials(), false);
  });
  it("returns true when both credentials are set", () => {
    process.env.ORBITPORT_CLIENT_ID = "id";
    process.env.ORBITPORT_CLIENT_SECRET = "secret";
    assert.equal(hasOrbitportCredentials(), true);
  });
});

describe("fromHex", () => {
  it("strips a leading 0x prefix", () => {
    assert.deepEqual(Array.from(fromHex("0xab")), [0xab]);
  });
  it("decodes hex without a prefix", () => {
    assert.deepEqual(Array.from(fromHex("ab")), [0xab]);
  });
  it("decodes a 32-byte hash", () => {
    const hex = "0x" + "00".repeat(32);
    assert.equal(fromHex(hex).length, 32);
  });
  it("throws on odd-length input (delegated to noble)", () => {
    assert.throws(() => fromHex("0xabc"));
  });
});

describe("reAttestPublicKeyHex", () => {
  it("returns a 32-byte ed25519 public key as 64-char lowercase hex", () => {
    const hex = reAttestPublicKeyHex();
    assert.match(hex, /^[0-9a-f]{64}$/);
  });
  it("is stable within a process", () => {
    assert.equal(reAttestPublicKeyHex(), reAttestPublicKeyHex());
  });
});

describe("currentMode default", () => {
  it("returns real when env unset", () => {
    assert.equal(currentMode(), "real");
  });
});

describe("getCosmicEntropy in mock mode", () => {
  it("returns a 32-byte seed and an attached satellite signature", async () => {
    process.env.ORBITPORT_MODE = "mock";
    const e = await getCosmicEntropy();
    assert.match(e.seed, /^[0-9a-f]{64}$/);
    assert.match(e.satelliteSignature, /^[0-9a-f]{128}$/);
    assert.match(e.satellitePublicKey, /^[0-9a-f]{64}$/);
    assert.equal(e.source, "mock");
    assert.ok(e.timestamp.endsWith("Z"));
  });

  it("draws a fresh seed every call", async () => {
    process.env.ORBITPORT_MODE = "mock";
    const a = await getCosmicEntropy();
    const b = await getCosmicEntropy();
    assert.notEqual(a.seed, b.seed);
  });

  it("throws in real mode when credentials are missing", async () => {
    process.env.ORBITPORT_MODE = "real";
    await assert.rejects(getCosmicEntropy(), /ORBITPORT_CLIENT_ID/);
  });
});
