import { PageNav } from "@/components/PageNav";
import { VerifyPanel } from "@/components/VerifyPanel";

export default function VerifyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1 text-violet-200">
            verifier · runs locally
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight glow-text md:text-4xl">
          Verify a <span className="text-violet-300">cosmic attestation</span>
        </h1>
        <p className="max-w-2xl text-[var(--color-space-muted)]">
          Anyone, anywhere, with no SpaceComputer credentials, can verify the full chain offline:
          satellite signature → seed binding → ECDSA signature → recovered Ethereum address.
        </p>
        <PageNav active="/verify" />
      </header>

      <VerifyPanel />
    </main>
  );
}
