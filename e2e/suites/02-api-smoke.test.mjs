import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, getJSON } from "../runner.mjs";

describe(`[e2e] /api smoke @ ${BASE_URL}`, () => {
  it("/api/health → ok=true with mode + signerType + address + keyId", async () => {
    const { status, body } = await getJSON("/api/health");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.mode === "real" || body.mode === "mock", `unexpected mode ${body.mode}`);
    assert.ok(body.signerType === "kms" || body.signerType === "local");
    assert.match(body.address, /^0x[0-9a-f]{40}$/);
    assert.ok(typeof body.keyId === "string" && body.keyId.length > 0);
  });

  it("/api/identity → mode + signerType + 65-byte uncompressed publicKey + capabilities", async () => {
    const { status, body } = await getJSON("/api/identity");
    assert.equal(status, 200);
    assert.match(body.publicKey, /^0x04[0-9a-f]{128}$/);
    assert.match(body.address, /^0x[0-9a-f]{40}$/);
    assert.ok(Array.isArray(body.capabilities));
    for (const cap of ["sign", "sign-typed", "sign-batch"]) {
      assert.ok(body.capabilities.includes(cap), `missing capability: ${cap}`);
    }
  });

  it("/api/health and /api/identity return the same address", async () => {
    const h = (await getJSON("/api/health")).body;
    const i = (await getJSON("/api/identity")).body;
    assert.equal(h.address, i.address);
    assert.equal(h.signerType, i.signerType);
  });
});
