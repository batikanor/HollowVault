"use client";

import { useEffect, useState } from "react";
import type { Attestation } from "@/lib/types";
import { CosmicAnimation } from "./CosmicAnimation";
import { SatelliteIcon } from "./SatelliteIcon";
import { DeviceIcon } from "./DeviceIcon";
import { StageBadge } from "./StageBadge";
import { ResultPanel } from "./ResultPanel";

type Stage = "idle" | "fetch" | "sign" | "done" | "error";

// Real-world signing patterns. Each picker preset substitutes {address} and
// {timestamp} on click. Designed to mirror what an actual Web3 user would
// sign: SIWE login, governance vote, sealed-bid auction, on-the-record
// prediction, source-protected disclosure.
const EXAMPLES: Array<{ short: string; build: (addr: string) => string }> = [
  {
    short: "Login (SIWE)",
    build: (addr) =>
      `hollow-vault.app wants you to sign in with your Ethereum account:\n${addr}\n\nSign in to Hollow Vault.\n\nURI: https://hollow-vault.app\nVersion: 1\nChain ID: 1\nNonce: 7f3e9a2c4d1a8b9e\nIssued At: ${new Date().toISOString()}`,
  },
  {
    short: "DAO vote",
    build: (addr) =>
      `Uniswap Governance · Proposal #42\n"Deploy Uniswap v4 on Base mainnet"\nVoter: ${addr}\nVote: YES — voting power 1,250 UNI\nReason: Multi-chain liquidity unlocks ~$50M TVL per Llama Risk audit (2026-05).\nSnapshot: block 21,498,732`,
  },
  {
    short: "Sealed bid",
    build: (addr) =>
      `SealedBid · Lot CryptoPunk #7804\nBidder: ${addr}\nBid: 12.5 ETH (sealed; reveal block 21,500,000)\nThe cosmic seed locks this bid to a fresh moment in orbit — no replay, no late edits, no MEV.`,
  },
  {
    short: "Public prediction",
    build: (addr) =>
      `On The Record — cosmic-timestamped prediction.\n\nI, ${addr}, predict:\n  ETH/USD will close above $5,000 on or before 2026-07-09.\n\nThis signature is bound to a satellite-attested cosmic-randomness draw at this exact moment. I cannot retroactively claim I made this call later.`,
  },
  {
    short: "Source disclosure",
    build: (addr) =>
      `Signed Disclosure — source-protection mode.\n\nSource: B7-2026-05\nDocument SHA-256: 0x4e5a7d9c… (medical-pricing-records-2025-q4.zip)\n\nI attest:\n  · I provided this document to journalist Sarah K. on 2026-05-09.\n  · The signing key for this attestation lives in Orbitport KMS — not on any device I control. I cannot be coerced into producing what I do not have.\n  · This signature establishes priority of disclosure.\n\nSigner: ${addr}`,
  },
];

function buildExample(idx: number, address: string): string {
  return EXAMPLES[idx].build(address || "<your-wallet-address>");
}

export function SignFlow() {
  const [signerAddr, setSignerAddr] = useState<string>("");
  const [message, setMessage] = useState<string>(() => buildExample(0, ""));
  const [activeEx, setActiveEx] = useState<number>(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [att, setAtt] = useState<Attestation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Probe the signer once on mount to learn the KMS-backed wallet address,
  // then refill the active example so {address} interpolates correctly.
  useEffect(() => {
    let cancelled = false;
    fetch("http://localhost:8080/identity")
      .then((r) => r.json())
      .then((j: { address?: string }) => {
        if (cancelled) return;
        if (j.address) {
          setSignerAddr(j.address);
          setMessage(buildExample(activeEx, j.address));
        }
      })
      .catch(() => { /* signer down — leave the <your-wallet-address> placeholder */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSign() {
    setError(null);
    setAtt(null);
    setStage("fetch");

    // The animation runs while the request is in flight. We deliberately give
    // the user a beat to see what's happening — the actual call usually takes
    // 100-400ms in mock mode, longer in real mode.
    const startedAt = performance.now();

    try {
      const res = await fetch("/api/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.hint || data?.error || `signer error ${res.status}`);
      }
      // Hold the "fetch" stage visible for at least 1.4s so the cosmic-ray
      // animation lands.
      const elapsed = performance.now() - startedAt;
      if (elapsed < 1400) {
        await new Promise((r) => setTimeout(r, 1400 - elapsed));
      }
      setStage("sign");
      await new Promise((r) => setTimeout(r, 600));
      setAtt(data as Attestation);
      setStage("done");
    } catch (err) {
      setError(String(err));
      setStage("error");
    }
  }

  const fetching = stage === "fetch";
  const signing = stage === "sign";
  const done = stage === "done";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl bg-[var(--color-space-surface)] glow-border p-6">
        <CosmicAnimation active={fetching} />

        <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
          <div className="flex flex-col items-center gap-2">
            <SatelliteIcon glowing={fetching || done} />
            <span className="text-xs text-[var(--color-space-muted)]">Orbitport · cTRNG</span>
          </div>

          <div className="space-y-3">
            <label htmlFor="msg" className="text-xs uppercase tracking-wider text-[var(--color-space-muted)]">
              Message to sign
            </label>
            <textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={9}
              className="mono w-full resize-y rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-3 py-2 text-sm text-[var(--color-space-text)] focus:border-cyan-400/60 focus:outline-none"
              placeholder="Pick a real-world example below, or type your own."
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1 text-[11px]">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveEx(i); setMessage(buildExample(i, signerAddr)); }}
                    className={`rounded border px-2 py-1 ${
                      activeEx === i
                        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                        : "border-[var(--color-space-border)] bg-[var(--color-space-bg)] text-[var(--color-space-muted)] hover:border-violet-400/40 hover:text-violet-200"
                    }`}
                  >
                    {ex.short}
                  </button>
                ))}
              </div>
              <button
                onClick={onSign}
                disabled={fetching || signing || !message.trim()}
                className="rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 px-5 py-2 text-sm font-semibold text-[#02030a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fetching ? "Receiving cosmic rays…" : signing ? "Signing in enclave…" : "Sign with cosmic entropy"}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <DeviceIcon glowing={signing || done} />
            <span className="text-xs text-[var(--color-space-muted)]">Edge Signer · USB Armory</span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StageBadge
          state={fetching ? "active" : stage === "idle" || stage === "error" ? "idle" : "done"}
          label="1. Fetch cosmic entropy"
          detail="GET /sign → cTRNG (32 bytes + ed25519 attestation)"
        />
        <StageBadge
          state={signing ? "active" : done ? "done" : "idle"}
          label="2. Bind seed to message"
          detail="payloadHash = keccak256('hollow-vault/v1|' || seed || '|' || ts || '|' || msgHash)"
        />
        <StageBadge
          state={done ? "done" : "idle"}
          label="3. ECDSA sign on edge device"
          detail="secp256k1, RFC 6979 + cosmic extra-entropy"
        />
      </section>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          <strong>signer unreachable.</strong> {error}
        </div>
      )}

      {att && <ResultPanel attestation={att} />}
    </div>
  );
}
