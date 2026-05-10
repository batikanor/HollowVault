import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  type AgentPolicy,
  type AgentIntent,
  canonicalIntentJson,
  evaluatePolicy,
  transferAmountWei,
} from "../signer/src/policy.js";

const ETH_1 = "1000000000000000000";
const ETH_05 = "500000000000000000";
const ETH_03 = "300000000000000000";
const ETH_2 = "2000000000000000000";

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const EVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

const restrictedPolicy: AgentPolicy = {
  version: 1,
  maxPerTxWei: ETH_05,
  maxPerDayWei: ETH_1,
  allowedActions: ["transfer"],
  allowedRecipients: [ALICE, BOB],
  allowedContracts: [],
};

function transferIntent(to: string, amountWei: string): AgentIntent {
  return { kind: "transfer", to, amountWei };
}

describe("policy evaluator — transfer intents", () => {
  it("allows a transfer to a whitelisted address within all caps", () => {
    const decision = evaluatePolicy(restrictedPolicy, transferIntent(ALICE, ETH_03), 0n);
    assert.equal(decision.allow, true);
    assert.equal(decision.ruleId, "ok");
  });

  it("denies a transfer above the per-tx cap", () => {
    const decision = evaluatePolicy(restrictedPolicy, transferIntent(ALICE, ETH_2), 0n);
    assert.equal(decision.allow, false);
    assert.equal(decision.ruleId, "over-per-tx");
  });

  it("denies a transfer that would push the daily total over the cap", () => {
    const decision = evaluatePolicy(restrictedPolicy, transferIntent(ALICE, ETH_05), BigInt(ETH_05) + 1n);
    assert.equal(decision.allow, false);
    assert.equal(decision.ruleId, "over-daily");
  });

  it("allows a transfer that exactly hits the daily cap", () => {
    const remaining = BigInt(ETH_05);
    const decision = evaluatePolicy(restrictedPolicy, transferIntent(ALICE, ETH_05), remaining);
    assert.equal(decision.allow, true);
  });

  it("denies a transfer to a non-whitelisted recipient", () => {
    const decision = evaluatePolicy(restrictedPolicy, transferIntent(EVE, ETH_03), 0n);
    assert.equal(decision.allow, false);
    assert.equal(decision.ruleId, "recipient-not-allowed");
  });

  it("treats recipient allow-list as case-insensitive", () => {
    const checksumAlice = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const decision = evaluatePolicy(restrictedPolicy, transferIntent(checksumAlice, ETH_03), 0n);
    assert.equal(decision.allow, true);
  });

  it("treats an empty recipient list as 'no restriction'", () => {
    const policy: AgentPolicy = { ...restrictedPolicy, allowedRecipients: [] };
    const decision = evaluatePolicy(policy, transferIntent(EVE, ETH_03), 0n);
    assert.equal(decision.allow, true);
  });
});

describe("policy evaluator — action gating", () => {
  it("denies an approve when only transfers are allowed", () => {
    const intent: AgentIntent = {
      kind: "approve",
      contract: USDC,
      spender: ALICE,
      amountWei: ETH_03,
    };
    const decision = evaluatePolicy(restrictedPolicy, intent, 0n);
    assert.equal(decision.allow, false);
    assert.equal(decision.ruleId, "action-not-allowed");
  });

  it("allows an approve when explicitly permitted and contract is in allow-list", () => {
    const policy: AgentPolicy = {
      ...restrictedPolicy,
      allowedActions: ["approve"],
      allowedContracts: [USDC],
    };
    const intent: AgentIntent = { kind: "approve", contract: USDC, spender: ALICE, amountWei: ETH_03 };
    const decision = evaluatePolicy(policy, intent, 0n);
    assert.equal(decision.allow, true);
  });

  it("denies an approve targeting an off-list contract", () => {
    const policy: AgentPolicy = {
      ...restrictedPolicy,
      allowedActions: ["approve"],
      allowedContracts: [USDC],
    };
    const otherToken = "0x" + "1".repeat(40);
    const intent: AgentIntent = { kind: "approve", contract: otherToken, spender: ALICE, amountWei: ETH_03 };
    const decision = evaluatePolicy(policy, intent, 0n);
    assert.equal(decision.allow, false);
    assert.equal(decision.ruleId, "contract-not-allowed");
  });
});

describe("policy evaluator — expiry", () => {
  it("denies any intent after the policy's expiry", () => {
    const policy: AgentPolicy = {
      ...restrictedPolicy,
      expiresAt: "2020-01-01T00:00:00Z",
    };
    const decision = evaluatePolicy(policy, transferIntent(ALICE, ETH_03), 0n);
    assert.equal(decision.allow, false);
    assert.equal(decision.ruleId, "expired");
  });

  it("allows the intent when 'now' is before the expiry", () => {
    const policy: AgentPolicy = {
      ...restrictedPolicy,
      expiresAt: "2099-01-01T00:00:00Z",
    };
    const decision = evaluatePolicy(policy, transferIntent(ALICE, ETH_03), 0n);
    assert.equal(decision.allow, true);
  });
});

describe("transferAmountWei", () => {
  it("returns 0 for non-transfer intents", () => {
    const intent: AgentIntent = { kind: "arbitrary", message: "hello" };
    assert.equal(transferAmountWei(intent), 0n);
  });

  it("returns the transfer amount as a bigint", () => {
    assert.equal(transferAmountWei(transferIntent(ALICE, ETH_05)), BigInt(ETH_05));
  });
});

describe("canonicalIntentJson", () => {
  it("normalises addresses to lowercase for transfers", () => {
    const intent: AgentIntent = {
      kind: "transfer",
      to: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      amountWei: ETH_03,
    };
    const canonical = canonicalIntentJson(intent);
    assert.equal(canonical, JSON.stringify({ kind: "transfer", to: ALICE, amountWei: ETH_03, note: null }));
  });

  it("produces stable bytes for byte-identical intents", () => {
    const a = canonicalIntentJson(transferIntent(ALICE, ETH_03));
    const b = canonicalIntentJson(transferIntent(ALICE, ETH_03));
    assert.equal(a, b);
  });
});
