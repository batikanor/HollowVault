import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  __resetSignerCacheForTest,
  currentMode,
  getSigner,
  mockSatellitePublicKey,
  setupPayload,
} from "../web/lib/server/state.js";

const ENV_KEYS = [
  "ORBITPORT_MODE",
  "ORBITPORT_CLIENT_ID",
  "ORBITPORT_CLIENT_SECRET",
  "HOLLOW_VAULT_KMS_KEY_ID",
  "HOLLOW_VAULT_KMS_PUBLIC_KEY",
  "HOLLOW_VAULT_KMS_ADDRESS",
  "HOLLOW_VAULT_KMS_CREATED_AT",
] as const;

let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  __resetSignerCacheForTest();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  __resetSignerCacheForTest();
});

describe("setupPayload", () => {
  it("flags missing credentials when mode=real", () => {
    process.env.ORBITPORT_MODE = "real";
    const setup = setupPayload();
    assert.ok(setup);
    assert.equal(setup.setupRequired, true);
    assert.match(setup.reason, /ORBITPORT_CLIENT_ID/);
    assert.equal(setup.steps.length, 5);
    assert.equal(setup.signupUrl, "https://accounts.spacecomputer.io/");
  });

  it("returns null in mock mode (no credentials needed)", () => {
    process.env.ORBITPORT_MODE = "mock";
    assert.equal(setupPayload(), null);
  });

  it("returns null when both credentials are present in real mode", () => {
    process.env.ORBITPORT_MODE = "real";
    process.env.ORBITPORT_CLIENT_ID = "id";
    process.env.ORBITPORT_CLIENT_SECRET = "secret";
    assert.equal(setupPayload(), null);
  });
});

describe("currentMode", () => {
  it("defaults to real when ORBITPORT_MODE is unset", () => {
    assert.equal(currentMode(), "real");
  });
  it("normalises case", () => {
    process.env.ORBITPORT_MODE = "MOCK";
    assert.equal(currentMode(), "mock");
  });
});

describe("getSigner", () => {
  it("returns a fresh local signer in mock mode", async () => {
    process.env.ORBITPORT_MODE = "mock";
    const signer = await getSigner();
    assert.equal(signer.identity.signerType, "local");
    assert.match(signer.identity.address, /^0x[0-9a-f]{40}$/);
  });

  it("memoises the signer across calls (warm Lambda)", async () => {
    process.env.ORBITPORT_MODE = "mock";
    const a = await getSigner();
    const b = await getSigner();
    assert.equal(a, b);
  });

  it("reconstructs a KMS signer from env without hitting createKey", async () => {
    process.env.ORBITPORT_MODE = "real";
    process.env.ORBITPORT_CLIENT_ID = "id";
    process.env.ORBITPORT_CLIENT_SECRET = "secret";
    process.env.HOLLOW_VAULT_KMS_KEY_ID = "kms:test-key-1";
    process.env.HOLLOW_VAULT_KMS_PUBLIC_KEY =
      "0x046346ea5fe986e29582e6f1a62c0c072b5d7ea809ebe95bfc30af06d00b2b2ee68b670c09025e46e847a28dd973588557f1ad2de481bb24bf0ba515bb4a81ada9";
    process.env.HOLLOW_VAULT_KMS_ADDRESS = "0x6a8ae891b034a56940c5528c42350fd8a9ca8004";
    const signer = await getSigner();
    assert.equal(signer.identity.signerType, "kms");
    assert.equal(signer.identity.keyId, "kms:test-key-1");
    assert.equal(signer.identity.address, "0x6a8ae891b034a56940c5528c42350fd8a9ca8004");
  });

  it("lowercases the address from env", async () => {
    process.env.ORBITPORT_MODE = "real";
    process.env.ORBITPORT_CLIENT_ID = "id";
    process.env.ORBITPORT_CLIENT_SECRET = "secret";
    process.env.HOLLOW_VAULT_KMS_KEY_ID = "kms:k";
    process.env.HOLLOW_VAULT_KMS_PUBLIC_KEY = "0x04" + "ab".repeat(64);
    process.env.HOLLOW_VAULT_KMS_ADDRESS = "0x6A8AE891B034A56940C5528C42350FD8A9CA8004";
    const signer = await getSigner();
    assert.equal(signer.identity.address, "0x6a8ae891b034a56940c5528c42350fd8a9ca8004");
  });
});

describe("mockSatellitePublicKey", () => {
  it("returns the re-attest pubkey hex in mock mode", () => {
    process.env.ORBITPORT_MODE = "mock";
    assert.match(mockSatellitePublicKey()!, /^[0-9a-f]{64}$/);
  });

  it("returns null in real mode", () => {
    process.env.ORBITPORT_MODE = "real";
    process.env.ORBITPORT_CLIENT_ID = "id";
    process.env.ORBITPORT_CLIENT_SECRET = "secret";
    assert.equal(mockSatellitePublicKey(), null);
  });
});
