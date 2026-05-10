import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { createKmsKey, kmsSignerFromIdentity, type SignerHandle } from "@hollow-vault/core";
import type { AgentPolicy } from "./policy.js";

export interface Agent {
  agentId: string;
  name: string;
  address: string;
  publicKey: string;
  kmsKeyId: string;
  policy: AgentPolicy;
  createdAt: string;
}

const FILE_MODE = 0o600;
const ALIAS_PREFIX = "hollow-vault-agent-v1";

function agentsDir(dataDir: string): string {
  return `${dataDir}/agents`;
}

function agentPath(dataDir: string, agentId: string): string {
  return `${agentsDir(dataDir)}/${agentId}.json`;
}

function newAgentId(): string {
  return `agent-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// KMS aliases must match `^[A-Za-z0-9_-]+$`. We strip everything else.
function sanitizeAlias(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return ascii.length > 0 ? ascii : "agent";
}

export function loadAgent(dataDir: string, agentId: string): Agent | null {
  const path = agentPath(dataDir, agentId);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Agent;
}

export function listAgents(dataDir: string): Agent[] {
  const dir = agentsDir(dataDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as Agent)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function persistAgent(dataDir: string, agent: Agent): void {
  const path = agentPath(dataDir, agent.agentId);
  mkdirSync(agentsDir(dataDir), { recursive: true });
  writeFileSync(path, JSON.stringify(agent, null, 2), { mode: FILE_MODE });
}

export async function spawnAgent(
  sdk: OrbitportSDK,
  dataDir: string,
  name: string,
  policy: AgentPolicy,
): Promise<Agent> {
  const agentId = newAgentId();
  const alias = `${ALIAS_PREFIX}-${sanitizeAlias(name)}-${agentId}`;
  const identity = await createKmsKey(sdk, alias, `AI agent wallet for ${name}`);
  const agent: Agent = {
    agentId,
    name,
    address: identity.address,
    publicKey: identity.publicKey,
    kmsKeyId: identity.keyId,
    policy,
    createdAt: identity.createdAt,
  };
  persistAgent(dataDir, agent);
  return agent;
}

export function signerForAgent(sdk: OrbitportSDK, agent: Agent): SignerHandle {
  return kmsSignerFromIdentity(sdk, {
    signerType: "kms",
    address: agent.address,
    publicKey: agent.publicKey,
    keyId: agent.kmsKeyId,
    createdAt: agent.createdAt,
  });
}
