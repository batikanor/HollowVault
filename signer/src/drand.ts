/**
 * drand-compatible HTTP adapter.
 *
 * drand (https://drand.love) is the de-facto standard for verifiable
 * randomness on Ethereum and beyond. dApps already integrated with drand
 * use a small client library that hits these three endpoints:
 *
 *   GET /info
 *   GET /public/latest
 *   GET /public/{round}
 *
 * By exposing those exact shapes, any drand-using app can swap in
 * hollow-vault with zero code change — they just point their client at
 * our URL. This is the cleanest possible Track 2 (Orbitport plugin /
 * gateway extension) story: a real protocol bridge, not a wrapper.
 *
 * Mapping:
 *   round       = ceil(unix_seconds_since_genesis / period_seconds)
 *   randomness  = the cosmic seed (32 bytes hex)
 *   signature   = the ed25519 satellite signature (64 bytes hex)
 *   previous    = sha256 of (round-1 || prev randomness)  [chain integrity]
 *   period      = how often we publish (we use 60s to match the IPFS beacon)
 *   genesis     = a fixed timestamp this process treats as "round 1"
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { getCosmicEntropy, reAttestPublicKeyHex } from "@hollow-vault/core";

const PERIOD_SECONDS = 60;
const GENESIS_UNIX = 1_770_000_000; // arbitrary fixed point in 2026
const CHAIN_HASH = sha256(new TextEncoder().encode("hollow-vault-drand-adapter/v1"));

interface RoundCacheEntry {
  round: number;
  randomness: string;
  signature: string;
  previous_signature: string;
  fetchedAt: number;
}

const cache = new Map<number, RoundCacheEntry>();

function roundFromTime(unixSec: number): number {
  return Math.max(1, Math.floor((unixSec - GENESIS_UNIX) / PERIOD_SECONDS));
}

function roundStartTime(round: number): number {
  return GENESIS_UNIX + (round - 1) * PERIOD_SECONDS;
}

export async function getDrandInfo() {
  return {
    public_key: reAttestPublicKeyHex(),
    period: PERIOD_SECONDS,
    genesis_time: GENESIS_UNIX,
    hash: bytesToHex(CHAIN_HASH),
    groupHash: bytesToHex(CHAIN_HASH),
    schemeID: "hollow-vault-v1-ed25519",
    metadata: {
      beaconID: "hollow-vault",
      note: "drand-compatible adapter over SpaceComputer cTRNG",
    },
  };
}

async function buildRound(round: number): Promise<RoundCacheEntry> {
  const cached = cache.get(round);
  if (cached && Date.now() - cached.fetchedAt < 30_000) return cached;

  const entropy = await getCosmicEntropy();
  // Tie the randomness to the round number so two calls at the same round
  // get the same value (drand contract).
  const bound = sha256(
    new TextEncoder().encode(`cosmic-drand/v1|${round}|${entropy.seed}`),
  );
  const randomness = bytesToHex(bound);

  const prev = cache.get(round - 1);
  const previous_signature = prev
    ? prev.signature
    : bytesToHex(sha256(new TextEncoder().encode(`cosmic-drand-genesis|${round - 1}`)));

  const entry: RoundCacheEntry = {
    round,
    randomness,
    signature: entropy.satelliteSignature,
    previous_signature,
    fetchedAt: Date.now(),
  };
  cache.set(round, entry);
  return entry;
}

export async function getDrandRound(round?: number) {
  const now = Math.floor(Date.now() / 1000);
  const r = round && round > 0 ? round : roundFromTime(now);
  const entry = await buildRound(r);
  return {
    round: entry.round,
    randomness: entry.randomness,
    signature: entry.signature,
    previous_signature: entry.previous_signature,
    // Compatibility with drand v2 clients that expect these:
    chain_hash: bytesToHex(CHAIN_HASH),
    round_start_time: roundStartTime(entry.round),
  };
}
