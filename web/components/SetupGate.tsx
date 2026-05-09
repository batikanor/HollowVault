"use client";

import { useEffect, useState } from "react";

const SIGNER = "http://localhost:8080";

interface SetupInfo {
  setupRequired: true;
  reason: string;
  steps: string[];
  signupUrl: string;
}

/**
 * Polls the signer's /health and, when it reports setupRequired, blocks the
 * UI with a fullscreen card listing the exact action steps the user must
 * take to bring the signer into real mode. Auto-reloads when the credentials
 * are added and the signer reports ready.
 */
export function SetupGate() {
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [reachable, setReachable] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch(`${SIGNER}/health`, { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        setReachable(true);
        if (j.setupRequired) setSetup(j as SetupInfo);
        else if (setup) location.reload();
      } catch {
        if (!cancelled) setReachable(false);
      }
    }
    poll();
    const id = window.setInterval(poll, 5000);
    return () => { cancelled = true; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!reachable) {
    return (
      <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/85 backdrop-blur-sm p-6">
        <div className="max-w-xl rounded-xl border border-rose-500/60 bg-[#11111a] p-7 text-[#f1f1f5] shadow-[0_20px_60px_-12px_rgba(244,114,182,0.25)]">
          <h2 className="m-0 mb-2 text-xl font-semibold text-rose-300">Signer not reachable</h2>
          <p className="text-sm text-[#c8c8d0]">
            The web app couldn&apos;t reach the signer service at <code className="rounded bg-black/40 px-1 py-0.5 text-cyan-300">{SIGNER}</code>.
          </p>
          <p className="mt-3 text-sm text-[#c8c8d0]">
            From the project root, run:
          </p>
          <pre className="mt-2 rounded bg-black/60 p-3 text-xs text-cyan-200">npm run dev</pre>
          <p className="mt-3 text-xs text-[#8a8a96]">This banner closes automatically once the signer is up.</p>
        </div>
      </div>
    );
  }

  if (!setup) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/85 backdrop-blur-sm p-6">
      <div className="max-w-2xl rounded-xl border border-amber-500/70 bg-[#14141c] p-7 text-[#f1f1f5] shadow-[0_20px_60px_-12px_rgba(255,140,0,0.25)]">
        <h2 className="m-0 text-xl font-semibold text-amber-400">⚠ Setup required — Orbitport credentials missing</h2>
        <p className="mt-1 text-sm text-[#c8c8d0]">{setup.reason}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          {setup.steps.map((s, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: linkify(s) }} />
          ))}
        </ol>
        <div className="mt-5 flex items-center gap-3">
          <a
            href={setup.signupUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-[#14141c] hover:bg-amber-400"
          >
            Open accounts.spacecomputer.io ↗
          </a>
          <span className="text-xs text-[#8a8a96]">
            This card closes automatically once the signer reports ready (we re-check every 5s).
          </span>
        </div>
      </div>
    </div>
  );
}

function linkify(s: string): string {
  return s
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noreferrer" class="text-cyan-300 underline underline-offset-2">$1</a>')
    .replace(/'\.env'|`\.env`/g, '<code class="rounded bg-black/40 px-1 py-0.5 text-cyan-300">.env</code>')
    .replace(/ORBITPORT_(CLIENT_ID|CLIENT_SECRET|MODE)/g, '<code class="rounded bg-black/40 px-1 py-0.5 text-cyan-300">ORBITPORT_$1</code>')
    .replace(/`npm run dev`/g, '<code class="rounded bg-black/40 px-1 py-0.5 text-cyan-300">npm run dev</code>');
}
