import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AuditEntry,
  appendAuditEntry,
  loadAuditLog,
  spentTodayWei,
} from "../signer/src/audit.js";
import type { AgentIntent } from "../signer/src/policy.js";

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function transferEntry(amountWei: string, loggedAt: string, allow = true): AuditEntry {
  const intent: AgentIntent = { kind: "transfer", to: ALICE, amountWei };
  return {
    agentId: "agent-test",
    intent,
    decision: { allow, reason: allow ? "ok" : "denied", ruleId: allow ? "ok" : "over-per-tx" },
    attestation: null,
    loggedAt,
  };
}

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "cosmic-audit-"));
});

describe("audit log persistence", () => {
  it("returns an empty array for an agent with no log", () => {
    const log = loadAuditLog(dataDir, "ghost-agent");
    assert.deepEqual(log, []);
  });

  it("round-trips entries through append + load (preserving order)", () => {
    const a = transferEntry("100", "2026-05-09T10:00:00.000Z");
    const b = transferEntry("200", "2026-05-09T11:00:00.000Z");
    const c = transferEntry("300", "2026-05-09T12:00:00.000Z");
    appendAuditEntry(dataDir, a);
    appendAuditEntry(dataDir, b);
    appendAuditEntry(dataDir, c);

    const loaded = loadAuditLog(dataDir, a.agentId);
    assert.equal(loaded.length, 3);
    assert.equal(loaded[0].intent.kind, "transfer");
    assert.equal((loaded[0].intent as { amountWei: string }).amountWei, "100");
    assert.equal((loaded[2].intent as { amountWei: string }).amountWei, "300");
  });

  rmSync; // keep the import used regardless of describe ordering
});

describe("daily-spend ledger", () => {
  it("sums only allowed transfers from the current UTC day", () => {
    const now = new Date("2026-05-09T15:00:00.000Z");
    const todayStartUtc = "2026-05-09T00:00:01.000Z";
    const yesterday = "2026-05-08T23:59:00.000Z";
    appendAuditEntry(dataDir, transferEntry("100", yesterday));
    appendAuditEntry(dataDir, transferEntry("200", todayStartUtc));
    appendAuditEntry(dataDir, transferEntry("300", "2026-05-09T10:00:00.000Z"));
    const log = loadAuditLog(dataDir, "agent-test");
    assert.equal(spentTodayWei(log, now), 500n);
  });

  it("ignores denied intents in the daily total", () => {
    const today = "2026-05-09T08:00:00.000Z";
    const now = new Date("2026-05-09T15:00:00.000Z");
    appendAuditEntry(dataDir, transferEntry("400", today, true));
    appendAuditEntry(dataDir, transferEntry("9999", today, false));
    const log = loadAuditLog(dataDir, "agent-test");
    assert.equal(spentTodayWei(log, now), 400n);
  });

  it("returns zero when nothing has been spent today", () => {
    appendAuditEntry(dataDir, transferEntry("999", "2026-05-08T08:00:00.000Z"));
    const log = loadAuditLog(dataDir, "agent-test");
    assert.equal(spentTodayWei(log, new Date("2026-05-09T15:00:00.000Z")), 0n);
  });
});
