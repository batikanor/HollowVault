import { PageNav } from "@/components/PageNav";
import { AgentsApp } from "@/components/AgentsApp";

export default function AgentsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:py-14">
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-cyan-200">
            Agent wallets · Orbitport KMS
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight glow-text md:text-4xl">
          AI agents that can sign — but <span className="text-cyan-300">not run away with the keys</span>
        </h1>
        <p className="max-w-3xl text-[var(--color-space-muted)]">
          Each agent gets its own secp256k1 key minted inside SpaceComputer&apos;s Orbitport KMS. The
          operator deploys the agent and defines a policy (per-tx and daily caps, recipient
          allow-list, expiry). Every intent is policy-checked, then signed by the agent&apos;s KMS
          key with a cosmic-attested timestamp. The operator can never extract the key, and every
          allowed action is recorded with an offline-verifiable attestation.
        </p>
        <PageNav active="/agents" />
      </header>
      <AgentsApp />
    </main>
  );
}
