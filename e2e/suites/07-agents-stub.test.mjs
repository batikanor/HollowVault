import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, getJSON, postJSON } from "../runner.mjs";

/**
 * The Bloomberg terminal calls /api/agents on first load. On Vercel we don't
 * have a persistent fs to back the audit log, so the route returns a
 * structured "unavailable" payload — this guarantees the UI gets JSON
 * (not the Next.js 404 HTML page) so it can render a friendly notice.
 */
describe(`[e2e] /api/agents stubs @ ${BASE_URL}`, () => {
  it("GET /api/agents → 200 JSON with unavailable=true and empty agents[]", async () => {
    const { status, body } = await getJSON("/api/agents");
    assert.equal(status, 200);
    assert.deepEqual(body.agents, []);
    assert.equal(body.unavailable, true);
    assert.match(body.reason, /local persistent storage/i);
  });

  it("POST /api/agents → 503 JSON (not HTML)", async () => {
    const { status, body } = await postJSON("/api/agents", {
      name: "test",
      policy: { version: 1, maxPerTxWei: "0", maxPerDayWei: "0", allowedActions: ["transfer"], allowedRecipients: [], allowedContracts: [] },
    });
    assert.equal(status, 503);
    assert.equal(body.error, "agents-unavailable");
    assert.equal(body.unavailable, true);
  });

  it("GET /api/agents/:id/log → 200 JSON with empty entries", async () => {
    const { status, body } = await getJSON("/api/agents/agent-fake-1/log");
    assert.equal(status, 200);
    assert.deepEqual(body.entries, []);
    assert.equal(body.unavailable, true);
    assert.equal(body.spentTodayWei, "0");
    assert.equal(body.agentId, "agent-fake-1");
  });

  it("POST /api/agents/:id/intent → 503 JSON", async () => {
    const { status, body } = await postJSON("/api/agents/agent-fake-1/intent", {
      kind: "transfer",
      to: "0x" + "ab".repeat(20),
      amountWei: "1",
    });
    assert.equal(status, 503);
    assert.equal(body.error, "agents-unavailable");
    assert.equal(body.agentId, "agent-fake-1");
  });

  it("agents endpoints never return HTML 404 (the bug we fixed)", async () => {
    const responses = await Promise.all([
      fetch(BASE_URL + "/api/agents"),
      fetch(BASE_URL + "/api/agents/x/log"),
    ]);
    for (const r of responses) {
      const ct = r.headers.get("content-type") || "";
      assert.match(ct, /application\/json/, `expected JSON, got ${ct}`);
    }
  });
});
