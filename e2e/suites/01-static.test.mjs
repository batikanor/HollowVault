import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, getText } from "../runner.mjs";

describe(`[e2e] static pages @ ${BASE_URL}`, () => {
  it("/ serves the HVLT terminal HTML (200 + Bloomberg branding)", async () => {
    const r = await getText("/");
    assert.equal(r.status, 200);
    assert.match(r.body, /HVLT&lt;GO&gt;/);
    assert.match(r.body, /HOLLOW VAULT · AGENT OPS TERMINAL/);
    // Confirm same-origin wiring made it through:
    assert.match(r.body, /SIGNER\s*=\s*"\/api"/);
    assert.match(r.body, /VERIFIER\s*=\s*"\/api\/verify"/);
  });

  it("/ does NOT include hardcoded localhost references", async () => {
    const r = await getText("/");
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.body, /http:\/\/localhost:8080/);
    assert.doesNotMatch(r.body, /http:\/\/localhost:4747/);
  });

  it("/typed (alternative view) returns 200", async () => {
    const r = await getText("/typed");
    assert.equal(r.status, 200);
  });

  it("/batch returns 200", async () => {
    const r = await getText("/batch");
    assert.equal(r.status, 200);
  });

  it("/verify returns 200", async () => {
    const r = await getText("/verify");
    assert.equal(r.status, 200);
  });

  it("/vulnerability returns 200", async () => {
    const r = await getText("/vulnerability");
    assert.equal(r.status, 200);
  });

  it("/examples.js is served as JavaScript", async () => {
    const r = await fetch(BASE_URL + "/examples.js");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") || "", /javascript/);
  });

  it("/setup-banner.js is served as JavaScript", async () => {
    const r = await fetch(BASE_URL + "/setup-banner.js");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") || "", /javascript/);
  });

  it("/nonexistent returns 404 (not server error)", async () => {
    const r = await fetch(BASE_URL + "/this-route-does-not-exist-anywhere");
    assert.equal(r.status, 404);
  });
});
