"use client";

import { useState } from "react";
import type { Attestation, VerificationReport } from "@/lib/types";

export function VerifyPanel() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setError(null);
    setReport(null);
    setBusy(true);
    try {
      let parsed: Attestation;
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new Error("Could not parse JSON. Make sure you copied the full attestation block.");
      }
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "verification failed");
      setReport(data as VerificationReport);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
        <h2 className="text-lg font-semibold text-[var(--color-space-cyan)]">Paste an attestation</h2>
        <p className="mt-1 text-sm text-[var(--color-space-muted)]">
          Drop the JSON you copied from the Sign page. The verifier runs locally — no server-side trust required.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={10}
          className="mono mt-3 w-full resize-y rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-2 text-xs text-[var(--color-space-text)] focus:border-violet-400/60 focus:outline-none"
          placeholder='{"message":"…","cosmic":{…},"signature":"0x…"}'
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={verify}
            disabled={busy || !input.trim()}
            className="rounded-md bg-gradient-to-br from-violet-400 to-pink-500 px-5 py-2 text-sm font-semibold text-[#02030a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "verifying…" : "Verify"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {report && (
        <section
          className={`rounded-xl border p-5 ${
            report.ok
              ? "border-emerald-400/60 bg-emerald-500/5"
              : "border-rose-400/60 bg-rose-500/5"
          }`}
        >
          <header className="mb-4 flex items-center justify-between">
            <h3 className={`text-lg font-semibold ${report.ok ? "text-emerald-200" : "text-rose-200"}`}>
              {report.ok ? "✓ Attestation valid" : "✗ Attestation rejected"}
            </h3>
            {report.signerAddress && (
              <span className="mono text-xs text-[var(--color-space-muted)]">
                signer {report.signerAddress}
              </span>
            )}
          </header>
          <ol className="space-y-2">
            {report.steps.map((s) => (
              <li
                key={s.id}
                className={`rounded-md border p-3 text-sm ${
                  s.ok
                    ? "border-emerald-400/30 bg-emerald-500/5"
                    : "border-rose-400/40 bg-rose-500/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden>{s.ok ? "✓" : "✗"}</span>
                  <span className="font-medium">{s.label}</span>
                </div>
                <div className="mono mt-1 text-xs text-[var(--color-space-muted)] break-all">
                  {s.detail}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
