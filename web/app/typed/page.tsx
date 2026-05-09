import { PageNav } from "@/components/PageNav";
import { TypedSignFlow } from "@/components/TypedSignFlow";

export default function TypedPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-cyan-200">
            EIP-712 · drop-in for any wagmi/viem dapp
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight glow-text md:text-4xl">
          Cosmic <span className="text-cyan-300">EIP-712</span> typed-data signing
        </h1>
        <p className="max-w-2xl text-[var(--color-space-muted)]">
          Sign Permits, votes, DEX orders — the structured data real Ethereum apps emit — with cosmic
          entropy mixed into the nonce. The outer digest is exactly what wallets normally produce, so
          existing on-chain verifiers consume it without modification.
        </p>
        <PageNav active="/typed" />
      </header>

      <TypedSignFlow />
    </main>
  );
}
