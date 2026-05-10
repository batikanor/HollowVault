import express from "express";
import { z } from "zod";
import {
  getCosmicEntropy,
  orbitportSdk,
  reAttestPublicKeyHex,
  signAttestation,
  signBatch,
  signTypedAttestation,
  type EIP712TypedData,
  type SignerHandle,
} from "@hollow-vault/core";
import { ensureKmsSigner, ensureLocalSigner } from "./cache.js";
import { getDrandInfo, getDrandRound } from "./drand.js";
import { defaultDataDir } from "./paths.js";
import {
  type AgentIntent,
  type AgentPolicy,
  canonicalIntentJson,
  evaluatePolicy,
} from "./policy.js";
import { listAgents, loadAgent, signerForAgent, spawnAgent } from "./agents.js";
import { appendAuditEntry, loadAuditLog, spentTodayWei } from "./audit.js";

const PORT = Number(process.env.SIGNER_PORT ?? 8080);
const MODE = (process.env.ORBITPORT_MODE ?? "real").toLowerCase();
const HAS_CREDS = !!(process.env.ORBITPORT_CLIENT_ID && process.env.ORBITPORT_CLIENT_SECRET);

const SETUP_STEPS = [
  "Open https://accounts.spacecomputer.io/",
  "Sign up or log in.",
  "On the dashboard, generate an OAuth Client ID + Client Secret pair.",
  "Edit the file '.env' in this project and paste them into ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET.",
  "Restart the signer (Ctrl+C, then `npm run dev`).",
];

type SetupState =
  | { kind: "ready"; signer: SignerHandle }
  | { kind: "needs-credentials"; reason: string; steps: string[] }
  | { kind: "error"; reason: string };

let state: SetupState = MODE === "real" && !HAS_CREDS
  ? {
      kind: "needs-credentials",
      reason: "ORBITPORT_MODE=real but ORBITPORT_CLIENT_ID / ORBITPORT_CLIENT_SECRET are not set.",
      steps: SETUP_STEPS,
    }
  : { kind: "error", reason: "uninitialised" };

async function bootSigner(): Promise<SignerHandle> {
  if (MODE !== "real") return ensureLocalSigner();
  if (!HAS_CREDS) {
    throw new Error(
      "ORBITPORT_MODE=real but credentials are missing. Set ORBITPORT_CLIENT_ID + ORBITPORT_CLIENT_SECRET in .env (see https://accounts.spacecomputer.io/).",
    );
  }
  return ensureKmsSigner();
}

async function requireSigner(): Promise<SignerHandle> {
  if (state.kind === "ready") return state.signer;
  if (state.kind === "needs-credentials") {
    const err = new Error(state.reason);
    (err as Error & { setup?: SetupState }).setup = state;
    throw err;
  }
  const signer = await bootSigner();
  state = { kind: "ready", signer };
  return signer;
}

function setupPayload() {
  if (state.kind !== "needs-credentials") return null;
  return {
    setupRequired: true as const,
    reason: state.reason,
    steps: state.steps,
    signupUrl: "https://accounts.spacecomputer.io/",
    envFile: ".env (in the project root)",
  };
}

function setupGuard(res: express.Response): boolean {
  const setup = setupPayload();
  if (!setup) return false;
  res.status(503).json({ error: "signer setup required", ...setup });
  return true;
}

const app = express();
app.use(express.json({ limit: "256kb" }));

// Permissive CORS for the alt-UI demos served on different localhost ports.
// The signer runs only on the dev machine and never holds user funds.
app.use((req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/health", async (_req, res) => {
  const setup = setupPayload();
  if (setup) {
    res.json({ ok: false, mode: MODE, ...setup });
    return;
  }
  try {
    const s = await requireSigner();
    res.json({
      ok: true,
      mode: MODE,
      signerType: s.identity.signerType,
      address: s.identity.address,
      keyId: s.identity.keyId,
    });
  } catch (err) {
    res.status(500).json({ ok: false, mode: MODE, error: String(err) });
  }
});

app.get("/identity", async (_req, res) => {
  const setup = setupPayload();
  if (setup) {
    res.json({ mode: MODE, signerType: null, address: null, ...setup });
    return;
  }
  try {
    const s = await requireSigner();
    res.json({
      mode: MODE,
      signerType: s.identity.signerType,
      address: s.identity.address,
      publicKey: s.identity.publicKey,
      keyId: s.identity.keyId,
      createdAt: s.identity.createdAt,
      mockSatellitePublicKey: MODE === "mock" ? reAttestPublicKeyHex() : null,
      capabilities: ["sign", "sign-typed", "sign-batch", "drand-adapter", "agents"],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/info", async (_req, res) => res.json(await getDrandInfo()));
app.get("/public/latest", async (_req, res) => {
  try { res.json(await getDrandRound()); }
  catch (err) { res.status(500).json({ error: String(err) }); }
});
app.get("/public/:round", async (req, res) => {
  const r = Number(req.params.round);
  if (!Number.isFinite(r) || r < 1) {
    res.status(400).json({ error: "round must be a positive integer" });
    return;
  }
  try { res.json(await getDrandRound(r)); }
  catch (err) { res.status(500).json({ error: String(err) }); }
});

const SignSchema = z.object({ message: z.string().min(1).max(4096) });

app.post("/sign", async (req, res) => {
  if (setupGuard(res)) return;
  const parsed = SignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid request", detail: parsed.error.format() });
    return;
  }
  try {
    const s = await requireSigner();
    const cosmic = await getCosmicEntropy();
    res.json(await signAttestation(s, parsed.data.message, cosmic));
  } catch (err) {
    console.error("[signer] sign failed", err);
    res.status(500).json({ error: "sign failed", detail: String(err) });
  }
});

const TypedSchema = z.object({
  domain: z.record(z.unknown()),
  types: z.record(z.array(z.object({ name: z.string(), type: z.string() }))),
  primaryType: z.string(),
  message: z.record(z.unknown()),
});

app.post("/sign-typed", async (req, res) => {
  if (setupGuard(res)) return;
  const parsed = TypedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid request", detail: parsed.error.format() });
    return;
  }
  try {
    const s = await requireSigner();
    const cosmic = await getCosmicEntropy();
    res.json(await signTypedAttestation(s, parsed.data as EIP712TypedData, cosmic));
  } catch (err) {
    console.error("[signer] sign-typed failed", err);
    res.status(500).json({ error: "sign-typed failed", detail: String(err) });
  }
});

const BatchSchema = z.object({
  messages: z.array(z.string().min(1).max(4096)).min(1).max(50),
});

app.post("/sign-batch", async (req, res) => {
  if (setupGuard(res)) return;
  const parsed = BatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid request", detail: parsed.error.format() });
    return;
  }
  try {
    const s = await requireSigner();
    const cosmic = await getCosmicEntropy();
    res.json(await signBatch(s, parsed.data.messages, cosmic));
  } catch (err) {
    console.error("[signer] sign-batch failed", err);
    res.status(500).json({ error: "sign-batch failed", detail: String(err) });
  }
});

const PolicySchema: z.ZodType<AgentPolicy> = z.object({
  version: z.literal(1),
  maxPerTxWei: z.string().regex(/^\d+$/, "wei must be a non-negative decimal integer"),
  maxPerDayWei: z.string().regex(/^\d+$/, "wei must be a non-negative decimal integer"),
  allowedActions: z.array(z.enum(["transfer", "approve", "arbitrary"])).min(1),
  allowedRecipients: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
  allowedContracts: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
  expiresAt: z.string().optional(),
});

const SpawnSchema = z.object({
  name: z.string().min(1).max(64),
  policy: PolicySchema,
});

const IntentSchema: z.ZodType<AgentIntent> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transfer"),
    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    amountWei: z.string().regex(/^\d+$/),
    note: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal("approve"),
    contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    spender: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    amountWei: z.string().regex(/^\d+$/),
  }),
  z.object({
    kind: z.literal("arbitrary"),
    message: z.string().min(1).max(4096),
    contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  }),
]);

app.get("/agents", (_req, res) => {
  res.json({ agents: listAgents(defaultDataDir()) });
});

app.post("/agents", async (req, res) => {
  if (setupGuard(res)) return;
  const parsed = SpawnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid spawn request", detail: parsed.error.format() });
    return;
  }
  try {
    const agent = await spawnAgent(orbitportSdk(), defaultDataDir(), parsed.data.name, parsed.data.policy);
    res.json(agent);
  } catch (err) {
    console.error("[signer] spawn agent failed", err);
    res.status(500).json({ error: "spawn agent failed", detail: String(err) });
  }
});

app.get("/agents/:agentId", (req, res) => {
  const agent = loadAgent(defaultDataDir(), req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  res.json(agent);
});

app.get("/agents/:agentId/log", (req, res) => {
  const agent = loadAgent(defaultDataDir(), req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  const entries = loadAuditLog(defaultDataDir(), agent.agentId);
  res.json({
    agentId: agent.agentId,
    entries,
    spentTodayWei: spentTodayWei(entries).toString(),
  });
});

app.post("/agents/:agentId/intent", async (req, res) => {
  if (setupGuard(res)) return;
  const agent = loadAgent(defaultDataDir(), req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  const parsed = IntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid intent", detail: parsed.error.format() });
    return;
  }
  const intent = parsed.data;
  const dataDir = defaultDataDir();
  const log = loadAuditLog(dataDir, agent.agentId);
  const decision = evaluatePolicy(agent.policy, intent, spentTodayWei(log));

  if (!decision.allow) {
    const entry = {
      agentId: agent.agentId,
      intent,
      decision,
      attestation: null,
      loggedAt: new Date().toISOString(),
    };
    appendAuditEntry(dataDir, entry);
    res.status(403).json({ ...entry, error: "policy denied", reason: decision.reason });
    return;
  }

  try {
    const cosmic = await getCosmicEntropy();
    const agentSigner = signerForAgent(orbitportSdk(), agent);
    const attestation = await signAttestation(agentSigner, canonicalIntentJson(intent), cosmic);
    const entry = {
      agentId: agent.agentId,
      intent,
      decision,
      attestation,
      loggedAt: new Date().toISOString(),
    };
    appendAuditEntry(dataDir, entry);
    res.json(entry);
  } catch (err) {
    console.error("[signer] agent intent sign failed", err);
    res.status(500).json({ error: "agent intent sign failed", detail: String(err) });
  }
});

app.use((_req, res) => res.status(404).json({ error: "not found" }));

(async () => {
  if (state.kind === "needs-credentials") {
    console.error("");
    console.error("  ╔════════════════════════════════════════════════════════════════╗");
    console.error("  ║  HOLLOW VAULT · SETUP REQUIRED                                ║");
    console.error("  ║                                                                ║");
    console.error("  ║  ORBITPORT_MODE=real but credentials are missing.              ║");
    console.error("  ║                                                                ║");
    state.steps.forEach((s, i) => {
      const line = `  ${i + 1}. ${s}`.padEnd(64, " ").slice(0, 64);
      console.error(`  ║${line}║`);
    });
    console.error("  ║                                                                ║");
    console.error("  ║  All endpoints will respond with 503 + steps until you do.     ║");
    console.error("  ╚════════════════════════════════════════════════════════════════╝");
    console.error("");
  } else {
    try {
      const signer = await bootSigner();
      state = { kind: "ready", signer };
      console.log(`[signer] ready  mode=${MODE}  signerType=${signer.identity.signerType}  address=${signer.identity.address}`);
    } catch (err) {
      console.error("[signer] boot failed:", err);
      state = { kind: "error", reason: String(err) };
    }
  }
  app.listen(PORT, () => console.log(`[signer] listening on :${PORT}`));
})();
