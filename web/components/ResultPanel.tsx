"use client";

import { useState } from "react";
import type { Attestation } from "@/lib/types";

interface Props {
  attestation: Attestation;
}

export function ResultPanel({ attestation }: Props) {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const json = JSON.stringify(attestation, null, 2);

  async function copy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-space-cyan)]">Attestation</h3>
          <p className="text-xs text-[var(--color-space-muted)]">
            {attestation.cosmic.source === "real"
              ? "Cosmic entropy from live Orbitport satellite link"
              : "Cosmic entropy from local mock satellite (no network)"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-1.5 text-xs font-medium hover:border-cyan-400/60 hover:text-cyan-200"
          >
            {copied ? "copied!" : "copy json"}
          </button>
          <a
            href="/verify"
            className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-1.5 text-xs font-medium hover:border-violet-400/60 hover:text-violet-200"
          >
            verify →
          </a>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <KV k="signer address" v={attestation.signerAddress} />
        <KV k="signed at" v={attestation.signedAt} />
        <KV k="cosmic timestamp" v={attestation.cosmic.timestamp} />
        <KV k="message hash" v={attestation.messageHash} />
        <KV k="payload hash" v={attestation.payloadHash} />
        <KV k="cosmic seed" v={"0x" + attestation.cosmic.seed} />
        <KV k="ECDSA signature" v={attestation.signature} />
        <KV k="recovery id" v={String(attestation.recoveryId)} />
      </dl>

      <button
        onClick={() => setShowFull((v) => !v)}
        className="mt-4 text-xs text-[var(--color-space-muted)] underline hover:text-[var(--color-space-text)]"
      >
        {showFull ? "hide raw json" : "show raw json"}
      </button>
      {showFull && (
        <pre className="mono mt-3 max-h-96 overflow-auto rounded-lg bg-[var(--color-space-bg)] p-4 text-xs text-[var(--color-space-text)]">
          {json}
        </pre>
      )}
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)]/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-space-muted)]">{k}</div>
      <div className="mono mt-1 break-all text-xs text-[var(--color-space-text)]">{v}</div>
    </div>
  );
}
