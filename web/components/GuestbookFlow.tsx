"use client";

import { useEffect, useState } from "react";
import type { Attestation } from "@/lib/types";

interface Entry {
  id: string;
  receivedAt: string;
  attestation: Attestation;
  verified: boolean;
}

export function GuestbookFlow() {
  const [message, setMessage] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  async function load() {
    const r = await fetch("/api/guestbook", { cache: "no-store" });
    const j = await r.json();
    setEntries(j.entries ?? []);
  }
  useEffect(() => { load(); }, []);

  async function post() {
    if (!message.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const formatted = author.trim()
        ? `${author.trim()} says: ${message.trim()}`
        : message.trim();
      const sigRes = await fetch("/api/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: formatted }),
      });
      const att = await sigRes.json();
      if (!sigRes.ok) throw new Error(att?.error ?? "sign failed");

      const postRes = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(att),
      });
      const out = await postRes.json();
      if (!postRes.ok || !out.ok) throw new Error(out?.error ?? "post failed");
      setMessage("");
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--color-space-cyan)]">Leave a cosmic-attested message</h2>
          <p className="mt-1 text-sm text-[var(--color-space-muted)]">
            Every post is signed by the edge device with fresh cosmic entropy. The board verifies
            each attestation before accepting it. Anyone can later re-verify any entry locally.
          </p>
        </header>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value.slice(0, 40))}
            placeholder="your handle (optional)"
            className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-2 text-sm focus:border-cyan-400/60 focus:outline-none"
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
            placeholder="say something the universe will witness…"
            className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-2 text-sm focus:border-cyan-400/60 focus:outline-none"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--color-space-muted)]">{message.length}/200</span>
          <button
            onClick={post}
            disabled={busy || !message.trim()}
            className="rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 px-5 py-2 text-sm font-semibold text-[#02030a] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "anchoring…" : "Sign + post"}
          </button>
        </div>
        {error && <div className="mt-3 text-sm text-rose-200">{error}</div>}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-space-muted)]">
          {entries.length} cosmic-witnessed message{entries.length === 1 ? "" : "s"}
        </h3>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/60 p-6 text-center text-sm text-[var(--color-space-muted)]">
            be the first to write something the satellite will witness.
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/60 p-4"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-space-muted)]">
                  <span>{new Date(e.receivedAt).toLocaleString()}</span>
                  <span className="text-emerald-300">✓ verified</span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-space-text)]">{e.attestation.message}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-[var(--color-space-muted)] hover:text-[var(--color-space-text)]">
                    proof
                  </summary>
                  <div className="mono mt-2 space-y-1 rounded bg-[var(--color-space-bg)] p-2 text-[10px] text-[var(--color-space-muted)]">
                    <div>seed   : 0x{e.attestation.cosmic.seed.slice(0, 32)}…</div>
                    <div>ts     : {e.attestation.cosmic.timestamp}</div>
                    <div>signer : {e.attestation.signerAddress}</div>
                    <div>sig    : {e.attestation.signature.slice(0, 32)}…</div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
