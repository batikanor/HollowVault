import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, getText } from "../runner.mjs";

/**
 * Tour contract:
 *  - tutorial.js exports its public API on window.
 *  - / embeds the trigger + script tag.
 *  - Step titles do NOT carry their own step number (counter is the
 *    single source of truth).
 *  - Every spotlight selector resolves to an id in index.html.
 *  - Action steps (preset / sign / verify) are advanceOnClick:true so
 *    users can click the highlighted element themselves and the tour
 *    advances along with them.
 *  - There is no #hv-tour-mask — the page stays interactive during the
 *    tour and only the spotlight box-shadow dims the surroundings.
 */
describe(`[e2e] guided tutorial @ ${BASE_URL}`, () => {
  it("/tutorial.js is served as JavaScript with the public API symbols", async () => {
    const res = await fetch(BASE_URL + "/tutorial.js");
    assert.equal(res.status, 200);
    const ct = res.headers.get("content-type") || "";
    assert.match(ct, /javascript/);
    const body = await res.text();
    for (const sym of [
      "HOLLOW_VAULT_TOUR_START",
      "HOLLOW_VAULT_TOUR_NEXT",
      "HOLLOW_VAULT_TOUR_CLOSE",
      "HOLLOW_VAULT_TOUR_PROBE",
      "HOLLOW_VAULT_TOUR_STEP_COUNT",
    ]) {
      assert.ok(body.includes(sym), `tutorial.js must export ${sym}`);
    }
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

  it("tutorial.js title labels never include their own step number", async () => {
    const body = await (await fetch(BASE_URL + "/tutorial.js")).text();
    const titleMatches = [...body.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(titleMatches.length >= 8);
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

  it("action steps are flagged advanceOnClick:true so user clicks advance the tour", async () => {
    const tour = await (await fetch(BASE_URL + "/tutorial.js")).text();
    // Each of these targets corresponds to a step where the user
    // performs the headline action — clicking the spotlit element
    // must auto-advance the tour, not require a separate Next click.
    const actionTargets = ["#presets", "#btn-sign", "#btn-verify"];
    for (const sel of actionTargets) {
      // Look for the step block that has this selector and check it
      // has advanceOnClick: true within that block (next ~30 lines).
      const blockStart = tour.indexOf(`target: "${sel}"`);
      assert.ok(blockStart >= 0, `expected a step block for ${sel}`);
      const blockSnippet = tour.slice(blockStart, blockStart + 800);
      assert.match(
        blockSnippet,
        /advanceOnClick:\s*true/,
        `step for ${sel} must be advanceOnClick:true (interactive demo)`,
      );
    }
  });

  it("read-only steps are NOT advanceOnClick (don't trap users mid-edit)", async () => {
    const tour = await (await fetch(BASE_URL + "/tutorial.js")).text();
    const readOnlyTargets = ["#msg", "#raw", "#checks"];
    for (const sel of readOnlyTargets) {
      const blockStart = tour.indexOf(`target: "${sel}"`);
      assert.ok(blockStart >= 0);
      const blockSnippet = tour.slice(blockStart, blockStart + 800);
      assert.doesNotMatch(
        blockSnippet,
        /advanceOnClick:\s*true/,
        `step for ${sel} must NOT be advanceOnClick (it's read-only)`,
      );
    }
  });

  it("there is no full-cover mask that would block page interaction", async () => {
    const tour = await (await fetch(BASE_URL + "/tutorial.js")).text();
    // The original implementation had a #hv-tour-mask that swallowed all
    // page clicks. We now rely on the spotlight's box-shadow alone so the
    // page stays interactive during the tour.
    assert.doesNotMatch(tour, /id=["']hv-tour-mask["']/);
    assert.doesNotMatch(tour, /#hv-tour-mask\s*\{/);
  });

  it("tour body text guides the user to either click directly or use the CTA", async () => {
    const tour = await (await fetch(BASE_URL + "/tutorial.js")).text();
    // Hand-holding for users who want to drive themselves.
    assert.match(tour, /Click any preset/i);
    assert.match(tour, /Click F1/i);
    assert.match(tour, /Click F2/i);
  });
});
