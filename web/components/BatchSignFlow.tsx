"use client";

import { useState } from "react";

const DEFAULT_BATCH = [
  "Vote: YES on EIP-9999",
  "Vote: NO on EIP-9998",
  "Vote: ABSTAIN on EIP-9997",
  "Settlement #1 — pool A → pool B, 5.0 ETH",
  "Settlement #2 — pool B → pool C, 1.2 ETH",
];

export function BatchSignFlow() {
  const [text, setText] = useState(DEFAULT_BATCH.join("\n"));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [t0, setT0] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function sign() {
    setError(null);
    setResult(null);
    setBusy(true);
    setElapsed(null);
    const messages = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (messages.length === 0) {
      setError("at least one message required (one per line)");
      setBusy(false);
      return;
    }
    setT0(performance.now());
    try {
      const res = await fetch("/api/sign-batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error((data?.detail as string) ?? (data?.error as string) ?? `signer error ${res.status}`);
      setResult(data);
      setElapsed(Math.round(performance.now() - t0));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const lineCount = text.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--color-space-cyan)]">Batch sign — one cTRNG draw, N messages</h2>
          <p className="mt-1 text-sm text-[var(--color-space-muted)]">
            Cosmic entropy is bandwidth-limited. For high-throughput workloads we pull one satellite
            seed and derive per-message sub-seeds via HMAC-SHA256. Each attestation still verifies
            independently. One round-trip to orbit serves up to 50 signatures.
          </p>
        </header>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="mono mt-2 w-full resize-y rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-2 text-xs text-[var(--color-space-text)] focus:border-cyan-400/60 focus:outline-none"
          placeholder="one message per line"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--color-space-muted)]">
            {lineCount} message{lineCount === 1 ? "" : "s"} · max 50 per call
          </div>
          <button
            onClick={sign}
            disabled={busy || lineCount === 0}
            className="rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 px-5 py-2 text-sm font-semibold text-[#02030a] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "signing batch…" : `Sign ${lineCount} message${lineCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result != null && (
        <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--color-space-cyan)]">Batch result</h3>
            {elapsed != null && (
              <span className="text-xs text-[var(--color-space-muted)]">total: {elapsed}ms</span>
            )}
          </header>
          <pre className="mono mt-3 max-h-[36rem] overflow-auto rounded-lg bg-[var(--color-space-bg)] p-4 text-xs text-[var(--color-space-text)]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
