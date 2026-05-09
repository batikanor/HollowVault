import Link from "next/link";

const TABS = [
  { href: "/", label: "sign" },
  { href: "/agents", label: "agents" },
  { href: "/typed", label: "EIP-712" },
  { href: "/batch", label: "batch" },
  { href: "/chain", label: "on-chain" },
  { href: "/guestbook", label: "guestbook" },
  { href: "/verify", label: "verify" },
  { href: "/vulnerability", label: "the bug" },
] as const;

export function PageNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 pt-2">
      {TABS.map((t) => {
        const isActive = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href as never}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "border border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                : "border border-[var(--color-space-border)] bg-[var(--color-space-surface)] text-[var(--color-space-muted)] hover:text-[var(--color-space-text)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
