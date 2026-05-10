import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AgentIntent, PolicyDecision } from "./policy.js";
import { transferAmountWei } from "./policy.js";
import type { Attestation } from "@hollow-vault/core";

export interface AuditEntry {
  agentId: string;
  intent: AgentIntent;
  decision: PolicyDecision;
  attestation: Attestation | null;
  loggedAt: string;
}

function logPath(dataDir: string, agentId: string): string {
  return `${dataDir}/agents/${agentId}.log.jsonl`;
}

export function appendAuditEntry(dataDir: string, entry: AuditEntry): void {
  const path = logPath(dataDir, entry.agentId);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n", { mode: 0o600 });
}

export function loadAuditLog(dataDir: string, agentId: string): AuditEntry[] {
  const path = logPath(dataDir, agentId);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return [];
  return raw
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as AuditEntry);
}

export function spentWeiSince(entries: AuditEntry[], sinceMs: number): bigint {
  let total = 0n;
  for (const entry of entries) {
    if (!entry.decision.allow) continue;
    if (new Date(entry.loggedAt).getTime() < sinceMs) continue;
    total += transferAmountWei(entry.intent);
  }
  return total;
}

export function spentTodayWei(entries: AuditEntry[], now: Date = new Date()): bigint {
  const startOfDayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return spentWeiSince(entries, startOfDayUtc);
}
