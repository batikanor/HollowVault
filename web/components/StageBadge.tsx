interface Props {
  state: "idle" | "active" | "done";
  label: string;
  detail?: string;
}

export function StageBadge({ state, label, detail }: Props) {
  const ring =
    state === "done"
      ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
      : state === "active"
        ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-100 pulse-soft"
        : "border-[var(--color-space-border)] bg-[var(--color-space-surface)] text-[var(--color-space-muted)]";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm transition-colors ${ring}`}>
      <div className="flex items-center gap-2">
        {state === "done" ? (
          <span aria-hidden>✓</span>
        ) : state === "active" ? (
          <span aria-hidden>•</span>
        ) : (
          <span aria-hidden>○</span>
        )}
        <span className="font-medium">{label}</span>
      </div>
      {detail && <div className="mono mt-1 text-xs opacity-80 break-all">{detail}</div>}
    </div>
  );
}
