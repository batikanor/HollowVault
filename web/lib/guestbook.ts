/**
 * Tiny in-process guestbook backing store. Each entry is a cosmic-attested
 * signature over a user-supplied message. Persisted to .runtime/guestbook.json.
 *
 * Real production would persist to Postgres or an L2; this is enough for the
 * pitch demo and shows the full attestation chain per entry.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Attestation } from "./types";
import { verifyAttestation } from "./verify";

// On Vercel only /tmp is writable; locally we keep the project-relative path.
const STORE_PATH = process.env.VERCEL
  ? "/tmp/hollow-vault-guestbook.json"
  : resolve(process.cwd(), "..", ".runtime", "guestbook.json");

export interface GuestbookEntry {
  id: string;
  receivedAt: string;
  attestation: Attestation;
  verified: boolean;
}

function ensureFile() {
  if (!existsSync(STORE_PATH)) {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, "[]", "utf8");
  }
}

export function listEntries(limit = 100): GuestbookEntry[] {
  ensureFile();
  const raw = readFileSync(STORE_PATH, "utf8");
  const arr = JSON.parse(raw) as GuestbookEntry[];
  return arr.slice(-limit).reverse();
}

export function appendEntry(att: Attestation): GuestbookEntry {
  ensureFile();
  const report = verifyAttestation(att);
  if (!report.ok) {
    throw new Error("attestation rejected: " + report.steps.find((s) => !s.ok)?.detail);
  }
  const id = att.payloadHash.slice(2, 18);
  const entry: GuestbookEntry = {
    id,
    receivedAt: new Date().toISOString(),
    attestation: att,
    verified: true,
  };
  const raw = readFileSync(STORE_PATH, "utf8");
  const arr = JSON.parse(raw) as GuestbookEntry[];
  // Dedupe by payloadHash
  if (!arr.find((e) => e.attestation.payloadHash === att.payloadHash)) {
    arr.push(entry);
    writeFileSync(STORE_PATH, JSON.stringify(arr, null, 2), "utf8");
  }
  return entry;
}
