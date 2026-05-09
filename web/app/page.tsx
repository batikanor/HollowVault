import { PageNav } from "@/components/PageNav";
import { SignFlow } from "@/components/SignFlow";
import { LiveModePill } from "@/components/LiveModePill";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <header className="mb-10 space-y-3">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-cyan-200">
            ETHPrague 2026 · SpaceComputer
          </span>
          <LiveModePill />
        </div>
        <h1 className="text-4xl font-bold tracking-tight glow-text md:text-5xl">
          Cosmic <span className="text-cyan-300">Signer</span>
        </h1>
        <p className="max-w-3xl text-lg text-[var(--color-space-muted)]">
          An Ethereum signer whose private key has <span className="text-cyan-200">never existed on this device</span>.
          The key was created inside <span className="text-cyan-200">SpaceComputer's Orbitport KMS</span> and
          signs there; we get back only the signature. Each signature is bound to a fresh
          satellite-attested cosmic-randomness draw, and the entire chain verifies offline.
        </p>
        <PageNav active="/" />
      </header>

      <SignFlow />

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        <Card title="The signer was never in the room">
          The secp256k1 key behind every signature lives inside Orbitport KMS — a Trusted Execution
          Environment running gateway-side today; on-orbit secure elements that &quot;never export
          private keys&quot; arrive on SpaceComputer&apos;s Q4 2026 roadmap. We never see the key.
          Phishing, $5-wrench attacks, and root-on-laptop attacks all extract <em>nothing</em>,
          because there is nothing local to extract.
        </Card>
        <Card title="What's actually running">
          The signer service holds OAuth credentials and proxies <span className="mono">kms.CreateKey</span> /
          <span className="mono"> kms.Sign</span> via the official <span className="mono">@spacecomputer-io/orbitport-sdk-ts</span>.
          Cosmic entropy comes from the same gateway via <span className="mono">sdk.ctrng.random()</span>; no
          second credential pair needed.
        </Card>
        <Card title="What's bound into every signature">
          payloadHash = keccak256(<span className="mono">"hollow-vault/v1|"</span> ‖ cosmic_seed ‖ ts ‖ messageHash).
          KMS signs that 32-byte digest in DIGEST mode. Swap the seed or the message and the signature
          stops verifying. The cosmic seed itself is satellite-attested and recorded.
        </Card>
        <Card title="EIP-712 ready">
          Drop-in for any wagmi/viem dapp. Sign Permits, votes, DEX orders. Outer digest is standard
          EIP-712, signed by the off-device KMS key. <a className="underline hover:text-cyan-200" href="/typed">/typed</a> →
        </Card>
        <Card title="On-chain verifiable">
          Foundry-tested <span className="mono">HollowVaultVerifier.sol</span> consumes attestations via
          <span className="mono"> ecrecover</span> at ~31k gas. Plug into any L2 contract that needs a
          cosmic-anchored signature.{" "}
          <a className="underline hover:text-cyan-200" href="/chain">/chain</a> →
        </Card>
        <Card title="See the bug we structurally kill">
          Live, in-browser reproduction of the broken-RNG ECDSA private-key recovery exploit (Sony
          PS3 2010, Android Bitcoin wallets 2013) — and the same attack run against the KMS-backed
          wallet, which has nothing to leak.{" "}
          <a className="underline hover:text-rose-200" href="/vulnerability">/vulnerability</a> →
        </Card>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/60 p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-space-cyan)]">{title}</h3>
      <p className="text-sm text-[var(--color-space-muted)]">{children}</p>
    </div>
  );
}
