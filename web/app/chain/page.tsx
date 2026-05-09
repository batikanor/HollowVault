import { PageNav } from "@/components/PageNav";
import { ChainFlow } from "@/components/ChainFlow";

export default function ChainPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 md:py-14">
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200">
            on-chain · HollowVaultVerifier.sol
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight glow-text md:text-4xl">
          Anchor an attestation <span className="text-emerald-300">on-chain</span>
        </h1>
        <p className="max-w-2xl text-[var(--color-space-muted)]">
          Sign a message with cosmic entropy, then submit it to a deployed Solidity verifier. The
          contract recomputes the payload hash on-chain, runs <span className="mono">ecrecover</span>,
          checks the signer matches, and emits a <span className="mono">HollowVaultAttested</span> event
          you can index with any chain explorer.
        </p>
        <PageNav active="/chain" />
      </header>

      <ChainFlow />
    </main>
  );
}
