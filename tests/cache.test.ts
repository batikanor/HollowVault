import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureLocalSigner } from "../signer/src/cache.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hv-cache-"));
  process.env.SIGNER_DATA_DIR = dir;
  delete process.env.KEYSTORE_PATH;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.SIGNER_DATA_DIR;
  delete process.env.KEYSTORE_PATH;
});

describe("ensureLocalSigner — file-backed cache", () => {
  it("creates the keystore on first call with mode 0600", () => {
    const signer = ensureLocalSigner();
    const path = `${dir}/local-key.json`;
    assert.ok(existsSync(path));
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.match(signer.identity.address, /^0x[0-9a-f]{40}$/);
  });

  it("reuses the same address across invocations", () => {
    const a = ensureLocalSigner();
    const b = ensureLocalSigner();
    assert.equal(a.identity.address, b.identity.address);
    assert.equal(a.identity.publicKey, b.identity.publicKey);
  });

  it("persists the private key as 64-char hex plus createdAt", () => {
    ensureLocalSigner();
    const raw = JSON.parse(readFileSync(`${dir}/local-key.json`, "utf8"));
    assert.match(raw.privateKey, /^[0-9a-f]{64}$/);
    assert.ok(typeof raw.createdAt === "string" && raw.createdAt.endsWith("Z"));
  });

  it("honours KEYSTORE_PATH override", () => {
    const customPath = join(dir, "nested", "custom.json");
    process.env.KEYSTORE_PATH = customPath;
    ensureLocalSigner();
    assert.ok(existsSync(customPath));
  });
});
