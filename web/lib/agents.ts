import type { Attestation } from "./types";

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

export interface Agent {
  agentId: string;
  name: string;
  address: string;
  publicKey: string;
  kmsKeyId: string;
  policy: AgentPolicy;
  createdAt: string;
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

export interface AuditEntry {
  agentId: string;
  intent: AgentIntent;
  decision: PolicyDecision;
  attestation: Attestation | null;
  loggedAt: string;
}

export const ETH_DECIMALS = 18n;

export function ethToWei(eth: string): string {
  const cleaned = eth.trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) throw new Error(`invalid ETH amount: ${eth}`);
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(Number(ETH_DECIMALS))).slice(0, Number(ETH_DECIMALS));
  return (BigInt(whole || "0") * 10n ** ETH_DECIMALS + BigInt(fracPadded || "0")).toString();
}

export function weiToEth(wei: string): string {
  const value = BigInt(wei);
  const whole = value / 10n ** ETH_DECIMALS;
  const remainder = value % 10n ** ETH_DECIMALS;
  if (remainder === 0n) return whole.toString();
  const fracStr = remainder.toString().padStart(Number(ETH_DECIMALS), "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
