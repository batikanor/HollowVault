import { PageNav } from "@/components/PageNav";
import { GuestbookFlow } from "@/components/GuestbookFlow";

export default function GuestbookPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-pink-400/40 bg-pink-400/10 px-3 py-1 text-pink-200">
            consumer demo · open to all
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight glow-text md:text-4xl">
          Cosmic <span className="text-pink-300">guestbook</span>
        </h1>
        <p className="max-w-2xl text-[var(--color-space-muted)]">
          A public board where every post is signed with cosmic entropy and only accepted if its
          attestation chain verifies end-to-end. The simplest possible consumer of hollow-vault —
          drop in a QR code at a hackathon stage and let the audience post.
        </p>
        <PageNav active="/guestbook" />
      </header>

      <GuestbookFlow />
    </main>
  );
}
