"use client";

import { useEffect, useState } from "react";

const SIGNER = "http://localhost:8080";

interface HealthOk {
  ok: true;
  mode: string;
  signerType: string;
  address: string;
  keyId: string;
}
interface HealthSetup {
  ok: false;
  mode: string;
  setupRequired: true;
  reason: string;
}
type Health = HealthOk | HealthSetup | null;

/**
 * Live mode pill — polls the signer's /health every 4s and reflects what's
 * actually running, instead of the build-time guess that NEXT_PUBLIC_* gives.
 * Renders a green "real · KMS" pill when the production gateway is live, an
 * amber "setup required" pill when credentials are missing, and a rose
 * "offline" pill if the signer is unreachable.
 */
export function LiveModePill() {
  const [h, setH] = useState<Health>(null);
  const [reachable, setReachable] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch(`${SIGNER}/health`, { cache: "no-store" });
        const j = (await r.json()) as Health;
        if (cancelled) return;
        setReachable(true);
        setH(j);
      } catch {
        if (!cancelled) { setReachable(false); setH(null); }
      }
    }
    poll();
    const id = window.setInterval(poll, 4000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  if (!reachable) {
    return (
      <span className="rounded-full border border-rose-400/50 bg-rose-400/10 px-3 py-1 text-rose-200">
        signer offline
      </span>
    );
  }
  if (!h) {
    return (
      <span className="rounded-full border border-[var(--color-space-border)] bg-[var(--color-space-surface)] px-3 py-1 text-[var(--color-space-muted)]">
        probing…
      </span>
    );
  }
  if ("setupRequired" in h && h.setupRequired) {
    return (
      <>
        <span className="rounded-full border border-amber-400/60 bg-amber-400/10 px-3 py-1 text-amber-200">
          setup required
        </span>
        <span className="rounded-full border border-amber-400/60 bg-amber-400/10 px-3 py-1 text-amber-200">
          add credentials in .env
        </span>
      </>
    );
  }
  const isReal = h.mode === "real";
  const ok = h as HealthOk;
  return (
    <>
      <span
        className={`rounded-full border px-3 py-1 ${
          isReal
            ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
            : "border-violet-400/50 bg-violet-400/10 text-violet-200"
        }`}
      >
        mode: {h.mode}
      </span>
      <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-200">
        signer: {ok.signerType === "kms" ? "Orbitport KMS · off-device" : "local fallback (mock)"}
      </span>
    </>
  );
}
