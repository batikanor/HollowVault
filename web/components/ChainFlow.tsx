"use client";

import { useEffect, useState } from "react";
import type { Attestation } from "@/lib/types";

interface DeploymentInfo {
  deployed: boolean;
  chainId?: number;
  rpcUrl?: string;
  verifierAddress?: string;
  network?: string;
  hint?: string;
}

interface OnchainResult {
  txHash: string;
  blockNumber: string;
  gasUsed: string;
  status: string;
  signer: string;
  messageHash: string;
  cosmicSeedTopic: string;
  explorerUrl: string | null;
}

interface HistoryItem {
  txHash: string;
  blockNumber: string;
  signer: string;
  messageHash: string;
  cosmicSeed: string;
  cosmicTimestampUnix: string;
}

export function ChainFlow() {
  const [info, setInfo] = useState<DeploymentInfo | null>(null);
  const [message, setMessage] = useState("Anchored on chain via cosmic signer.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OnchainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function refreshInfo() {
    const r = await fetch("/api/chain/info", { cache: "no-store" });
    setInfo(await r.json());
  }
  async function refreshHistory() {
    const r = await fetch("/api/chain/history", { cache: "no-store" });
    const j = await r.json();
    setHistory(j.items ?? []);
  }
  useEffect(() => {
    refreshInfo();
    refreshHistory();
  }, []);

  async function signAndAnchor() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const sigRes = await fetch("/api/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const att = (await sigRes.json()) as Attestation;
      if (!sigRes.ok) throw new Error(`sign failed: ${JSON.stringify(att)}`);

      const onchainRes = await fetch("/api/chain/attest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(att),
      });
      const onchain = await onchainRes.json();
      if (!onchainRes.ok) throw new Error(onchain?.detail ?? onchain?.error ?? "submit failed");
      setResult(onchain as OnchainResult);
      await refreshHistory();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (info && !info.deployed) {
    return (
      <section className="rounded-xl border border-amber-400/40 bg-amber-500/5 p-5 text-sm text-amber-100">
        <p className="font-semibold text-amber-200">No deployment found.</p>
        <p className="mt-2 opacity-90">{info.hint ?? ""}</p>
        <pre className="mono mt-3 rounded bg-[var(--color-space-bg)] p-3 text-xs text-[var(--color-space-text)]">
{`# from project root
npm run deploy:local`}
        </pre>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {info?.deployed && (
        <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5 text-sm">
          <h2 className="text-lg font-semibold text-[var(--color-space-cyan)]">Live deployment</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <KV label="network" value={info.network ?? "?"} />
            <KV label="chainId" value={String(info.chainId)} />
            <KV label="contract" value={info.verifierAddress ?? "?"} mono />
            <KV label="rpc" value={info.rpcUrl ?? "?"} mono />
          </dl>
        </section>
      )}

      <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--color-space-cyan)]">Sign + anchor on-chain</h2>
          <p className="mt-1 text-sm text-[var(--color-space-muted)]">
            One click: pulls cosmic entropy, signs locally, submits a real transaction to the
            deployed HollowVaultVerifier contract, waits for inclusion, and shows the receipt.
          </p>
        </header>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="mono w-full resize-none rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-2 text-sm text-[var(--color-space-text)] focus:border-cyan-400/60 focus:outline-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={signAndAnchor}
            disabled={busy || !message.trim()}
            className="rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-[#02030a] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "anchoring on-chain…" : "Sign + anchor on-chain"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <section className="rounded-xl border border-emerald-400/60 bg-emerald-500/5 p-5">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-emerald-200">✓ Anchored on-chain</h3>
            <span className="text-xs text-emerald-200/80">block #{result.blockNumber} · gas {result.gasUsed}</span>
          </header>
          <dl className="grid gap-3 md:grid-cols-2">
            <KV label="tx hash" value={result.txHash} mono />
            <KV label="signer" value={result.signer} mono />
            <KV label="messageHash (topic)" value={result.messageHash} mono />
            <KV label="cosmicSeed (event)" value={result.cosmicSeedTopic} mono />
          </dl>
          {result.explorerUrl && (
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-block text-sm text-cyan-300 underline"
            >
              view on explorer →
            </a>
          )}
        </section>
      )}

      <section className="rounded-xl bg-[var(--color-space-surface)] glow-border p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-space-cyan)]">Recent on-chain attestations</h3>
          <button
            onClick={refreshHistory}
            className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-1 text-xs text-[var(--color-space-muted)] hover:text-[var(--color-space-text)]"
          >
            refresh
          </button>
        </header>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-space-muted)]">No on-chain attestations yet — sign one above.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-xs">
            {history.map((h) => (
              <li
                key={h.txHash}
                className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)]/60 p-3"
              >
                <div className="mono break-all text-[var(--color-space-text)]">{h.txHash}</div>
                <div className="mono mt-1 text-[10px] text-[var(--color-space-muted)] break-all">
                  signer {h.signer} · block #{h.blockNumber} · seed {h.cosmicSeed.slice(0, 18)}…
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)]/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-space-muted)]">{label}</div>
      <div className={`mt-1 break-all text-xs ${mono ? "mono" : ""} text-[var(--color-space-text)]`}>{value}</div>
    </div>
  );
}
