/**
 * Cosmic-entropy fetch. Real mode wraps `sdk.ctrng.random` from the official
 * SpaceComputer SDK; mock mode produces shape-compatible local entropy for
 * offline tests.
 *
 * The production cTRNG endpoint currently returns `{service, src, data}` with
 * no per-call satellite signature. We re-attest the bytes locally with a
 * process-scoped ed25519 key so the verifier path stays uniform; the
 * `source: "real"` field records that the bytes themselves came from the
 * live API. README documents this explicitly.
 */
import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";

export interface CosmicEntropy {
  seed: string;
  timestamp: string;
  satelliteSignature: string;
  satellitePublicKey: string;
  source: "real" | "mock";
  apiSrc?: string;
}

const reAttestPrivateKey = ed25519.utils.randomSecretKey();
const reAttestPublicKey = ed25519.getPublicKey(reAttestPrivateKey);

function currentMode(): string {
  return (process.env.ORBITPORT_MODE ?? "real").toLowerCase();
}

let cachedSdk: OrbitportSDK | null = null;
function getSdk(): OrbitportSDK {
  if (cachedSdk) return cachedSdk;
  const clientId = process.env.ORBITPORT_CLIENT_ID ?? "";
  const clientSecret = process.env.ORBITPORT_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("ORBITPORT_MODE=real requires ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET");
  }
  cachedSdk = new OrbitportSDK({ config: { clientId, clientSecret } });
  return cachedSdk;
}

export function orbitportSdk(): OrbitportSDK {
  return getSdk();
}

function reAttest(seedBytes: Uint8Array, apiSrc?: string): CosmicEntropy {
  const seed = bytesToHex(seedBytes);
  const timestamp = new Date().toISOString();
  const digest = sha256(new TextEncoder().encode(seed + "|" + timestamp));
  const signature = ed25519.sign(digest, reAttestPrivateKey);
  return {
    seed,
    timestamp,
    satelliteSignature: bytesToHex(signature),
    satellitePublicKey: bytesToHex(reAttestPublicKey),
    source: apiSrc ? "real" : "mock",
    ...(apiSrc ? { apiSrc } : {}),
  };
}

export async function getCosmicEntropy(): Promise<CosmicEntropy> {
  if (currentMode() !== "real") {
    return reAttest(randomBytes(32));
  }
  const sdk = getSdk();
  const response = await sdk.ctrng.random();
  const body = response.data as unknown as { src?: string; data?: string };
  const cleanHex = (body?.data ?? "").replace(/^0x/, "");
  if (!cleanHex) {
    throw new Error(`orbitport ctrng returned empty data: ${JSON.stringify(response.data).slice(0, 200)}`);
  }
  return reAttest(hexToBytes(cleanHex), body.src ?? "trng");
}

export function exportMockSatellitePublicKey(): string {
  return bytesToHex(reAttestPublicKey);
}

export function fromHex(s: string): Uint8Array {
  return hexToBytes(s.startsWith("0x") ? s.slice(2) : s);
}
