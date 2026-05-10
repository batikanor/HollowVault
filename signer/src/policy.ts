export type AgentActionKind = "transfer" | "approve" | "arbitrary";

export interface AgentPolicy {
  version: 1;
  maxPerTxWei: string;
  maxPerDayWei: string;
  allowedActions: AgentActionKind[];
  allowedRecipients: string[];
  allowedContracts: string[];
  expiresAt?: string;
}

export interface TransferIntent {
  kind: "transfer";
  to: string;
  amountWei: string;
  note?: string;
}
export interface ApproveIntent {
  kind: "approve";
  contract: string;
  spender: string;
  amountWei: string;
}
export interface ArbitraryIntent {
  kind: "arbitrary";
  message: string;
  contract?: string;
}
export type AgentIntent = TransferIntent | ApproveIntent | ArbitraryIntent;

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  ruleId: string;
}

const ZERO = 0n;

function lowerSet(addresses: string[]): Set<string> {
  return new Set(addresses.map((a) => a.toLowerCase()));
}

function safeBigInt(value: string, label: string): bigint {
  try {
    const n = BigInt(value);
    if (n < 0n) throw new Error(`${label} must be non-negative`);
    return n;
  } catch {
    throw new Error(`${label} is not a valid wei amount: ${value}`);
  }
}

export function evaluatePolicy(
  policy: AgentPolicy,
  intent: AgentIntent,
  spentTodayWei: bigint,
  now: Date = new Date(),
): PolicyDecision {
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() < now.getTime()) {
    return { allow: false, reason: `policy expired at ${policy.expiresAt}`, ruleId: "expired" };
  }

  if (!policy.allowedActions.includes(intent.kind)) {
    return {
      allow: false,
      reason: `action "${intent.kind}" not in allowed actions [${policy.allowedActions.join(", ")}]`,
      ruleId: "action-not-allowed",
    };
  }

  const maxPerTx = safeBigInt(policy.maxPerTxWei, "maxPerTxWei");
  const maxPerDay = safeBigInt(policy.maxPerDayWei, "maxPerDayWei");

  if (intent.kind === "transfer") {
    const amount = safeBigInt(intent.amountWei, "intent.amountWei");
    if (amount > maxPerTx) {
      return {
        allow: false,
        reason: `transfer ${amount} wei exceeds per-tx cap ${maxPerTx} wei`,
        ruleId: "over-per-tx",
      };
    }
    if (spentTodayWei + amount > maxPerDay) {
      return {
        allow: false,
        reason: `would exceed daily cap (today: ${spentTodayWei} wei, cap: ${maxPerDay} wei)`,
        ruleId: "over-daily",
      };
    }
    if (policy.allowedRecipients.length > 0) {
      const allowed = lowerSet(policy.allowedRecipients);
      if (!allowed.has(intent.to.toLowerCase())) {
        return {
          allow: false,
          reason: `recipient ${intent.to} not in allow-list (${policy.allowedRecipients.length} entries)`,
          ruleId: "recipient-not-allowed",
        };
      }
    }
    return { allow: true, reason: "transfer within policy", ruleId: "ok" };
  }

  if (intent.kind === "approve") {
    const amount = safeBigInt(intent.amountWei, "intent.amountWei");
    if (amount > maxPerTx) {
      return {
        allow: false,
        reason: `approve ${amount} wei exceeds per-tx cap ${maxPerTx} wei`,
        ruleId: "over-per-tx",
      };
    }
    if (policy.allowedContracts.length > 0) {
      const allowed = lowerSet(policy.allowedContracts);
      if (!allowed.has(intent.contract.toLowerCase())) {
        return {
          allow: false,
          reason: `contract ${intent.contract} not in allow-list`,
          ruleId: "contract-not-allowed",
        };
      }
    }
    return { allow: true, reason: "approve within policy", ruleId: "ok" };
  }

  if (policy.allowedContracts.length > 0 && intent.contract) {
    const allowed = lowerSet(policy.allowedContracts);
    if (!allowed.has(intent.contract.toLowerCase())) {
      return {
        allow: false,
        reason: `contract ${intent.contract} not in allow-list`,
        ruleId: "contract-not-allowed",
      };
    }
  }
  return { allow: true, reason: "arbitrary intent within policy", ruleId: "ok" };
}

export function canonicalIntentJson(intent: AgentIntent): string {
  if (intent.kind === "transfer") {
    return JSON.stringify({
      kind: "transfer",
      to: intent.to.toLowerCase(),
      amountWei: intent.amountWei,
      note: intent.note ?? null,
    });
  }
  if (intent.kind === "approve") {
    return JSON.stringify({
      kind: "approve",
      contract: intent.contract.toLowerCase(),
      spender: intent.spender.toLowerCase(),
      amountWei: intent.amountWei,
    });
  }
  return JSON.stringify({
    kind: "arbitrary",
    message: intent.message,
    contract: intent.contract ? intent.contract.toLowerCase() : null,
  });
}

export function transferAmountWei(intent: AgentIntent): bigint {
  if (intent.kind !== "transfer") return ZERO;
  return safeBigInt(intent.amountWei, "intent.amountWei");
}
