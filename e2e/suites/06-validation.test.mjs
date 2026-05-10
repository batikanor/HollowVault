import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, postJSON } from "../runner.mjs";

describe(`[e2e] input validation @ ${BASE_URL}`, () => {
  it("/api/sign rejects an empty message (400)", async () => {
    const { status, body } = await postJSON("/api/sign", { message: "" });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid request");
  });

  it("/api/sign rejects a missing message field (400)", async () => {
    const { status, body } = await postJSON("/api/sign", {});
    assert.equal(status, 400);
    assert.equal(body.error, "invalid request");
  });

  it("/api/sign rejects a 5000-character message (over zod max 4096)", async () => {
    const tooLong = "a".repeat(5000);
    const { status } = await postJSON("/api/sign", { message: tooLong });
    assert.equal(status, 400);
  });

  it("/api/sign accepts a 4096-character message at the boundary", async () => {
    const atLimit = "a".repeat(4096);
    const { status, body } = await postJSON("/api/sign", { message: atLimit });
    assert.equal(status, 200);
    assert.equal(body.message.length, 4096);
  });

  it("/api/sign with invalid JSON body returns 400, not 500", async () => {
    const res = await fetch(BASE_URL + "/api/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{{{",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid json");
  });

  it("/api/verify with malformed attestation does NOT 5xx", async () => {
    const { status } = await postJSON("/api/verify", { not: "a real attestation" });
    // verify is permissive — it returns ok=false in the report, status 200.
    // What we're checking: it never crashes the function.
    assert.ok(status < 500, `verify returned ${status} for bad input — should be 4xx or 2xx`);
  });

  it("/api/sign-typed with missing primaryType → 400", async () => {
    const { status } = await postJSON("/api/sign-typed", {
      domain: { name: "X" },
      types: { Vote: [{ name: "x", type: "string" }] },
      message: { x: "y" },
    });
    assert.equal(status, 400);
  });
});
