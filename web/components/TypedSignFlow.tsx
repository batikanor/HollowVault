"use client";

import { useState } from "react";
import { EXAMPLES } from "@/lib/typedExamples";

export function TypedSignFlow() {
  const [exampleId, setExampleId] = useState<typeof EXAMPLES[number]["id"]>("permit");
  const [json, setJson] = useState(() => JSON.stringify(EXAMPLES[0].payload, null, 2));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(id: typeof EXAMPLES[number]["id"]) {
    setExampleId(id);
    const ex = EXAMPLES.find((e) => e.id === id);
    if (ex) setJson(JSON.stringify(ex.payload, null, 2));
  }

  async function sign() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(json); }
      catch { throw new Error("Could not parse JSON. Check for trailing commas, quotes."); }
      const res = await fetch("/api/sign-typed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error((data?.detail as string) ?? (data?.error as string) ?? `signer error ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-space-cyan)]">EIP-712 typed-data signing</h2>
            <p className="mt-1 text-sm text-[var(--color-space-muted)]">
              Sign structured data the way real dapps do — Permit2, Seaport, Uniswap, every wagmi flow.
              The cosmic seed mixes into the signing nonce; the digest is standard EIP-712 so any
              dapp's existing verifier can consume it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e.id}
                onClick={() => pick(e.id)}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  exampleId === e.id
                    ? "border-violet-400/60 bg-violet-400/10 text-violet-100"
                    : "border-[var(--color-space-border)] bg-[var(--color-space-bg)] text-[var(--color-space-muted)] hover:text-[var(--color-space-text)]"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </header>

        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={20}
          className="mono mt-2 w-full resize-y rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-2 text-xs text-[var(--color-space-text)] focus:border-cyan-400/60 focus:outline-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={sign}
            disabled={busy || !json.trim()}
            className="rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 px-5 py-2 text-sm font-semibold text-[#02030a] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "signing…" : "Sign typed data"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
          <h3 className="mb-3 text-lg font-semibold text-[var(--color-space-cyan)]">Typed attestation</h3>
          <pre className="mono max-h-[28rem] overflow-auto rounded-lg bg-[var(--color-space-bg)] p-4 text-xs text-[var(--color-space-text)]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
