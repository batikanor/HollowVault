import { PageNav } from "@/components/PageNav";
import { BatchSignFlow } from "@/components/BatchSignFlow";

export default function BatchPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 md:py-14">
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1 text-violet-200">
            bandwidth-aware · one orbit pull, N sigs
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight glow-text md:text-4xl">
          <span className="text-violet-300">Batch</span> signing
        </h1>
        <p className="max-w-2xl text-[var(--color-space-muted)]">
          Cosmic entropy is rare. For workloads that need many signatures — settlement queues, vote
          tallies, audit logs — we pull one cosmic seed and derive per-message sub-seeds with HMAC.
        </p>
        <PageNav active="/batch" />
      </header>

      <BatchSignFlow />
    </main>
  );
}
