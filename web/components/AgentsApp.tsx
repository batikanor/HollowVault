"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Agent,
  type AgentIntent,
  type AgentPolicy,
  type AuditEntry,
  ethToWei,
  weiToEth,
} from "@/lib/agents";

const SIGNER = "http://localhost:8080";

const DEFAULT_NEW_POLICY: AgentPolicy = {
  version: 1,
  maxPerTxWei: ethToWei("0.5"),
  maxPerDayWei: ethToWei("1.0"),
  allowedActions: ["transfer"],
  allowedRecipients: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  allowedContracts: [],
};

interface SpawnFormState {
  name: string;
  maxPerTxEth: string;
  maxPerDayEth: string;
  recipientsCsv: string;
  allowedActionsCsv: string;
}

const DEFAULT_FORM: SpawnFormState = {
  name: "Aria — settlement bot",
  maxPerTxEth: "0.5",
  maxPerDayEth: "1.0",
  recipientsCsv: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  allowedActionsCsv: "transfer",
};

function shorten(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function AgentsApp() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [spawnForm, setSpawnForm] = useState<SpawnFormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const reloadAgents = useCallback(async () => {
    const response = await fetch(`${SIGNER}/agents`);
    const body = (await response.json()) as { agents: Agent[] };
    setAgents(body.agents);
    if (body.agents.length > 0 && !body.agents.some((a) => a.agentId === selectedAgentId)) {
      setSelectedAgentId(body.agents[0].agentId);
    }
  }, [selectedAgentId]);

  useEffect(() => { reloadAgents().catch((e) => setError(String(e))); }, [reloadAgents]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.agentId === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  async function handleSpawn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const policy: AgentPolicy = {
        ...DEFAULT_NEW_POLICY,
        maxPerTxWei: ethToWei(spawnForm.maxPerTxEth),
        maxPerDayWei: ethToWei(spawnForm.maxPerDayEth),
        allowedRecipients: spawnForm.recipientsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allowedActions: spawnForm.allowedActionsCsv
          .split(",")
          .map((s) => s.trim())
          .filter((s): s is AgentPolicy["allowedActions"][number] =>
            s === "transfer" || s === "approve" || s === "arbitrary",
          ),
      };
      const response = await fetch(`${SIGNER}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: spawnForm.name, policy }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "spawn failed");
      await reloadAgents();
      setSelectedAgentId(body.agentId);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <section className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/70 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-space-cyan)]">Agents</h2>
          {agents.length === 0 ? (
            <p className="text-xs text-[var(--color-space-muted)]">No agents yet. Spawn one below.</p>
          ) : (
            <ul className="space-y-2">
              {agents.map((agent) => (
                <li key={agent.agentId}>
                  <button
                    onClick={() => setSelectedAgentId(agent.agentId)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedAgentId === agent.agentId
                        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                        : "border-[var(--color-space-border)] bg-[var(--color-space-bg)] text-[var(--color-space-muted)] hover:text-[var(--color-space-text)]"
                    }`}
                  >
                    <div className="font-semibold">{agent.name}</div>
                    <div className="mono text-[10px] opacity-80">{shorten(agent.address, 8, 6)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/70 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-space-cyan)]">Spawn agent</h2>
          <form className="space-y-2 text-xs" onSubmit={handleSpawn}>
            <Field label="Name">
              <input
                value={spawnForm.name}
                onChange={(e) => setSpawnForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
              />
            </Field>
            <Field label="Max per tx (ETH)">
              <input
                value={spawnForm.maxPerTxEth}
                onChange={(e) => setSpawnForm((s) => ({ ...s, maxPerTxEth: e.target.value }))}
                className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
              />
            </Field>
            <Field label="Max per day (ETH)">
              <input
                value={spawnForm.maxPerDayEth}
                onChange={(e) => setSpawnForm((s) => ({ ...s, maxPerDayEth: e.target.value }))}
                className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
              />
            </Field>
            <Field label="Recipient allow-list (CSV)">
              <textarea
                value={spawnForm.recipientsCsv}
                onChange={(e) => setSpawnForm((s) => ({ ...s, recipientsCsv: e.target.value }))}
                rows={3}
                className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[11px]"
              />
            </Field>
            <Field label="Allowed actions (CSV)">
              <input
                value={spawnForm.allowedActionsCsv}
                onChange={(e) => setSpawnForm((s) => ({ ...s, allowedActionsCsv: e.target.value }))}
                className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
              />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 px-4 py-2 text-xs font-semibold text-[#02030a] disabled:opacity-50"
            >
              {busy ? "spawning…" : "Spawn agent in KMS →"}
            </button>
          </form>
        </section>

        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>
        )}
      </aside>

      <main>{selectedAgent ? <AgentDashboard agent={selectedAgent} /> : <EmptyState />}</main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-space-muted)]">{label}</span>
      {children}
    </label>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-dashed border-[var(--color-space-border)] p-12 text-center text-sm text-[var(--color-space-muted)]">
      Spawn an agent on the left to see its dashboard, policy and audit log here.
    </div>
  );
}

interface IntentFormState {
  kind: "transfer" | "approve" | "arbitrary";
  to: string;
  amountEth: string;
  contract: string;
  spender: string;
  message: string;
}

const DEFAULT_INTENT: IntentFormState = {
  kind: "transfer",
  to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  amountEth: "0.3",
  contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  spender: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  message: "Quarterly settlement attestation 2026-Q2",
};

function AgentDashboard({ agent }: { agent: Agent }) {
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [spentTodayWei, setSpentTodayWei] = useState<string>("0");
  const [intentForm, setIntentForm] = useState<IntentFormState>(DEFAULT_INTENT);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);

  const reloadLog = useCallback(async () => {
    const response = await fetch(`${SIGNER}/agents/${agent.agentId}/log`);
    const body = (await response.json()) as { entries: AuditEntry[]; spentTodayWei: string };
    setLog(body.entries.slice().reverse());
    setSpentTodayWei(body.spentTodayWei);
  }, [agent.agentId]);

  useEffect(() => { reloadLog().catch(() => undefined); }, [reloadLog]);

  function buildIntent(): AgentIntent {
    if (intentForm.kind === "transfer") {
      return { kind: "transfer", to: intentForm.to.trim(), amountWei: ethToWei(intentForm.amountEth) };
    }
    if (intentForm.kind === "approve") {
      return {
        kind: "approve",
        contract: intentForm.contract.trim(),
        spender: intentForm.spender.trim(),
        amountWei: ethToWei(intentForm.amountEth),
      };
    }
    return { kind: "arbitrary", message: intentForm.message };
  }

  async function submitIntent() {
    setSubmitting(true);
    setLastResult(null);
    try {
      const intent = buildIntent();
      const response = await fetch(`${SIGNER}/agents/${agent.agentId}/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(intent),
      });
      const body = await response.json();
      if (response.ok) {
        setLastResult({ ok: true, message: `signed · ${body.attestation.signature.slice(0, 22)}…` });
      } else {
        setLastResult({ ok: false, message: body.reason ?? body.error ?? "rejected" });
      }
      await reloadLog();
    } catch (err) {
      setLastResult({ ok: false, message: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/70 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{agent.name}</h3>
            <div className="mono text-xs text-[var(--color-space-muted)]">{agent.address}</div>
          </div>
          <div className="text-right text-xs text-[var(--color-space-muted)]">
            <div>spent today: <span className="text-cyan-200">{weiToEth(spentTodayWei)} ETH</span></div>
            <div>cap: {weiToEth(agent.policy.maxPerDayWei)} ETH/day · {weiToEth(agent.policy.maxPerTxWei)} ETH/tx</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <KV k="kms key id" v={agent.kmsKeyId} />
          <KV k="created" v={agent.createdAt} />
          <KV k="allowed actions" v={agent.policy.allowedActions.join(" · ")} />
          <KV k="recipient allow-list" v={agent.policy.allowedRecipients.length > 0 ? `${agent.policy.allowedRecipients.length} addresses` : "open (any recipient)"} />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/70 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-space-cyan)]">Submit intent on behalf of agent</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Kind">
            <select
              value={intentForm.kind}
              onChange={(e) => setIntentForm((s) => ({ ...s, kind: e.target.value as IntentFormState["kind"] }))}
              className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
            >
              <option value="transfer">transfer</option>
              <option value="approve">approve</option>
              <option value="arbitrary">arbitrary</option>
            </select>
          </Field>
          {(intentForm.kind === "transfer" || intentForm.kind === "approve") && (
            <Field label="Amount (ETH)">
              <input
                value={intentForm.amountEth}
                onChange={(e) => setIntentForm((s) => ({ ...s, amountEth: e.target.value }))}
                className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
              />
            </Field>
          )}
          {intentForm.kind === "transfer" && (
            <Field label="Recipient">
              <input
                value={intentForm.to}
                onChange={(e) => setIntentForm((s) => ({ ...s, to: e.target.value }))}
                className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px] md:col-span-2"
              />
            </Field>
          )}
          {intentForm.kind === "approve" && (
            <>
              <Field label="Contract">
                <input
                  value={intentForm.contract}
                  onChange={(e) => setIntentForm((s) => ({ ...s, contract: e.target.value }))}
                  className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
                />
              </Field>
              <Field label="Spender">
                <input
                  value={intentForm.spender}
                  onChange={(e) => setIntentForm((s) => ({ ...s, spender: e.target.value }))}
                  className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px]"
                />
              </Field>
            </>
          )}
          {intentForm.kind === "arbitrary" && (
            <Field label="Message">
              <textarea
                value={intentForm.message}
                onChange={(e) => setIntentForm((s) => ({ ...s, message: e.target.value }))}
                rows={3}
                className="mono w-full rounded border border-[var(--color-space-border)] bg-[var(--color-space-bg)] px-2 py-1 text-[12px] md:col-span-2"
              />
            </Field>
          )}
        </div>
        <button
          onClick={submitIntent}
          disabled={submitting}
          className="mt-4 rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 px-5 py-2 text-sm font-semibold text-[#02030a] disabled:opacity-50"
        >
          {submitting ? "evaluating…" : "Submit intent →"}
        </button>
        {lastResult && (
          <p
            className={`mt-3 text-xs ${
              lastResult.ok ? "text-emerald-200" : "text-rose-200"
            }`}
          >
            {lastResult.ok ? "✓ allowed · " : "✗ denied · "}{lastResult.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-space-border)] bg-[var(--color-space-surface)]/70 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-space-cyan)]">Audit log ({log.length})</h3>
        {log.length === 0 ? (
          <p className="text-xs text-[var(--color-space-muted)]">No intents yet. Submit one above to see it appear.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {log.map((entry, i) => (
              <li
                key={`${entry.loggedAt}-${i}`}
                className={`rounded-md border p-3 ${
                  entry.decision.allow
                    ? "border-emerald-400/40 bg-emerald-500/5"
                    : "border-rose-400/40 bg-rose-500/5"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={entry.decision.allow ? "text-emerald-200" : "text-rose-200"}>
                      {entry.decision.allow ? "✓ allowed" : "✗ denied"}
                    </span>
                    <span className="text-[var(--color-space-muted)]">
                      {entry.intent.kind} · {entry.loggedAt}
                    </span>
                  </div>
                  <span className="mono text-[10px] text-[var(--color-space-muted)]">{entry.decision.ruleId}</span>
                </div>
                <div className="mono mt-1 text-[11px] text-[var(--color-space-text)]">{describeIntent(entry.intent)}</div>
                {!entry.decision.allow && (
                  <div className="mt-1 text-[11px] text-rose-200">reason: {entry.decision.reason}</div>
                )}
                {entry.attestation && (
                  <div className="mono mt-1 text-[10px] text-[var(--color-space-muted)] break-all">
                    sig {shorten(entry.attestation.signature, 14, 8)} · cosmic seed 0x{shorten(entry.attestation.cosmic.seed, 12, 6)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function describeIntent(intent: AgentIntent): string {
  if (intent.kind === "transfer") {
    return `transfer ${weiToEth(intent.amountWei)} ETH → ${shorten(intent.to, 8, 6)}`;
  }
  if (intent.kind === "approve") {
    return `approve ${weiToEth(intent.amountWei)} of ${shorten(intent.contract, 8, 6)} for ${shorten(intent.spender, 8, 6)}`;
  }
  return `arbitrary: ${intent.message.slice(0, 60)}${intent.message.length > 60 ? "…" : ""}`;
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-[var(--color-space-border)] bg-[var(--color-space-bg)]/60 p-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-space-muted)]">{k}</div>
      <div className="mono mt-1 break-all text-[11px] text-[var(--color-space-text)]">{v}</div>
    </div>
  );
}
