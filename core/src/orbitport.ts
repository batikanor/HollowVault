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

export type Mode = "real" | "mock";

const reAttestPrivateKey = ed25519.utils.randomSecretKey();
const reAttestPublicKey = ed25519.getPublicKey(reAttestPrivateKey);

export function currentMode(): Mode {
  return (process.env.ORBITPORT_MODE ?? "real").toLowerCase() === "real" ? "real" : "mock";
}

export function hasOrbitportCredentials(): boolean {
  return !!(process.env.ORBITPORT_CLIENT_ID && process.env.ORBITPORT_CLIENT_SECRET);
}

let cachedSdk: OrbitportSDK | null = null;
export function orbitportSdk(): OrbitportSDK {
  if (cachedSdk) return cachedSdk;
  const clientId = process.env.ORBITPORT_CLIENT_ID ?? "";
  const clientSecret = process.env.ORBITPORT_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("ORBITPORT_MODE=real requires ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET");
  }
  cachedSdk = new OrbitportSDK({ config: { clientId, clientSecret } });
  return cachedSdk;
}

function attestSeed(
  seedBytes: Uint8Array,
  opts: { timestamp?: string; apiSrc?: string } = {},
): CosmicEntropy {
  const seed = bytesToHex(seedBytes);
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const digest = sha256(new TextEncoder().encode(seed + "|" + timestamp));
  const signature = ed25519.sign(digest, reAttestPrivateKey);
  return {
    seed,
    timestamp,
    satelliteSignature: bytesToHex(signature),
    satellitePublicKey: bytesToHex(reAttestPublicKey),
    source: opts.apiSrc ? "real" : "mock",
    ...(opts.apiSrc ? { apiSrc: opts.apiSrc } : {}),
  };
}

/**
 * Re-attest a derived sub-seed under the same satellite-attest key. The
 * batch flow uses this so each sub-attestation has a satellite signature
 * that actually verifies against its (sub-)seed, while inheriting the
 * master draw's timestamp + provenance for freshness/audit.
 */
export function reAttestSubSeed(seedBytes: Uint8Array, parent: CosmicEntropy): CosmicEntropy {
  return attestSeed(seedBytes, { timestamp: parent.timestamp, apiSrc: parent.apiSrc });
}

// Retries protect against transient Orbitport gateway 5xx / network blips so
// a single unlucky tick doesn't surface as a /api/sign 500 to end users.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 200): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts - 1) break;
      const delay = baseDelayMs * (attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function getCosmicEntropy(): Promise<CosmicEntropy> {
  if (currentMode() !== "real") {
    return attestSeed(randomBytes(32));
  }
  const sdk = orbitportSdk();
  const response = await withRetry(() => sdk.ctrng.random());
  const body = response.data as unknown as { src?: string; data?: string };
  const cleanHex = (body?.data ?? "").replace(/^0x/, "");
  if (!cleanHex) {
    throw new Error(`orbitport ctrng returned empty data: ${JSON.stringify(response.data).slice(0, 200)}`);
  }
  return attestSeed(hexToBytes(cleanHex), { apiSrc: body.src ?? "trng" });
}

export function reAttestPublicKeyHex(): string {
  return bytesToHex(reAttestPublicKey);
}

export function fromHex(s: string): Uint8Array {
  return hexToBytes(s.startsWith("0x") ? s.slice(2) : s);
}
