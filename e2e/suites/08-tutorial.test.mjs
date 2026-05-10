import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, getText } from "../runner.mjs";

/**
 * The in-UI guided tour is a hard requirement of the demo: a first-time
 * visitor must see the tutorial auto-pop, and an existing visitor must
 * find a TUTORIAL button to re-trigger it.
 *
 * Browser-driven positioning is verified separately by the smoke script
 * in e2e/browser-smoke.mjs (run with `npm run test:browser`) — the static
 * checks here lock the script's contract.
 */
describe(`[e2e] guided tutorial @ ${BASE_URL}`, () => {
  it("/tutorial.js is served as JavaScript with the public API symbols", async () => {
    const res = await fetch(BASE_URL + "/tutorial.js");
    assert.equal(res.status, 200);
    const ct = res.headers.get("content-type") || "";
    assert.match(ct, /javascript/);
    const body = await res.text();
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_START"));
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_NEXT"));
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_CLOSE"));
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_PROBE"));
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_STEP_COUNT"));
  });

  it("/ embeds the TUTORIAL trigger button + tutorial.js script", async () => {
    const r = await getText("/");
    assert.equal(r.status, 200);
    assert.match(r.body, /id=["']hv-tour-trigger["']/);
    assert.match(r.body, /HOLLOW_VAULT_TOUR_START/);
    assert.match(r.body, /<script[^>]*src=["']tutorial\.js["']/);
  });

  it("tutorial.js declares each headline step the demo depends on", async () => {
    const body = await (await fetch(BASE_URL + "/tutorial.js")).text();
    // Step *titles* are user-facing; the counter "X / 8" is the position
    // source-of-truth, so titles must NOT include their own step numbers.
    const required = [
      "WELCOME ABOARD",
      "Pick a real-world scenario",
      "The exact bytes you'll sign",
      "Sign it",
      "The attestation envelope",
      "Run the 5-check verifier",
      "All five green",
      "Tour complete",
    ];
    for (const phrase of required) {
      assert.ok(body.includes(phrase), `tutorial.js must contain step: "${phrase}"`);
    }
  });

  it("tutorial.js title labels do NOT include their own step number (counter is the source of truth)", async () => {
    const body = await (await fetch(BASE_URL + "/tutorial.js")).text();
    // Each STEP entry has `title: "..."`. Pull all titles, assert none has
    // a "STEP N" prefix that could mismatch the "X / 8" counter.
    const titleMatches = [...body.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(titleMatches.length >= 8, `expected ≥8 step titles, got ${titleMatches.length}`);
    for (const t of titleMatches) {
      assert.doesNotMatch(t, /\bSTEP\s+\d/i, `title "${t}" has a hardcoded step number`);
    }
  });

  it("tutorial.js pins automation against the actual element ids in index.html", async () => {
    const html = (await getText("/")).body;
    const tour = await (await fetch(BASE_URL + "/tutorial.js")).text();
    const selectors = ["#presets", "#msg", "#btn-sign", "#raw", "#btn-verify", "#checks"];
    for (const sel of selectors) {
      assert.ok(tour.includes(`"${sel}"`), `tutorial.js references selector ${sel}`);
      const idLiteral = sel.slice(1);
      assert.ok(html.includes(`id="${idLiteral}"`), `index.html must have id="${idLiteral}"`);
    }
  });
});
