import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, getText } from "../runner.mjs";

/**
 * The in-UI guided tour is a hard requirement of the demo: a first-time
 * visitor must see the tutorial auto-pop, and an existing visitor must
 * find a TUTORIAL button to re-trigger it.
 */
describe(`[e2e] guided tutorial @ ${BASE_URL}`, () => {
  it("/tutorial.js is served as JavaScript", async () => {
    const res = await fetch(BASE_URL + "/tutorial.js");
    assert.equal(res.status, 200);
    const ct = res.headers.get("content-type") || "";
    assert.match(ct, /javascript/);
    const body = await res.text();
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_START"), "must export the public start API");
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_NEXT"), "must export the public next API");
    assert.ok(body.includes("HOLLOW_VAULT_TOUR_CLOSE"), "must export the public close API");
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
    // The actual user-visible step titles — locked so a future drive-by
    // refactor doesn't silently skip the canonical demo flow.
    const required = [
      "WELCOME ABOARD",
      "STEP 1 · pick a real-world scenario",
      "STEP 2 · the exact bytes you'll sign",
      "STEP 3 · sign it",
      "STEP 4 · the attestation envelope",
      "STEP 5 · run the 5-check verifier",
      "STEP 6 · all five green",
      "TOUR COMPLETE",
    ];
    for (const phrase of required) {
      assert.ok(body.includes(phrase), `tutorial.js must contain step: "${phrase}"`);
    }
  });

  it("tutorial.js pins automation against the actual element ids in index.html", async () => {
    const html = (await getText("/")).body;
    const tour = await (await fetch(BASE_URL + "/tutorial.js")).text();
    // Every selector the tutorial spotlights must exist in index.html.
    const selectors = ["#presets", "#msg", "#btn-sign", "#raw", "#btn-verify", "#checks"];
    for (const sel of selectors) {
      assert.ok(tour.includes(`"${sel}"`), `tutorial.js references selector ${sel}`);
      const idLiteral = sel.slice(1);
      assert.ok(html.includes(`id="${idLiteral}"`), `index.html must have id="${idLiteral}" (tour spotlight target)`);
    }
  });
});
