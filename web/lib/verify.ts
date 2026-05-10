import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { PAYLOAD_SCHEME, PAYLOAD_SEPARATOR } from "@hollow-vault/core";
import type { Attestation, VerificationReport, VerificationStep } from "./types";

const FRESHNESS_PAST_LIMIT_MS = 120_000;
const FRESHNESS_FUTURE_LIMIT_MS = 24 * 3_600_000;

const utf8 = (s: string) => new TextEncoder().encode(s);
const fromHex = (s: string) => hexToBytes(s.startsWith("0x") ? s.slice(2) : s);

function ethereumAddress(uncompressedPubKey: Uint8Array): string {
  if (uncompressedPubKey.length !== 65 || uncompressedPubKey[0] !== 0x04) {
    throw new Error("expected uncompressed secp256k1 public key");
  }
  return "0x" + bytesToHex(keccak_256(uncompressedPubKey.slice(1)).slice(-20));
}

function recomputePayloadHash(seedHex: string, timestamp: string, messageHashHex: string): Uint8Array {
  const parts = [
    utf8(PAYLOAD_SCHEME),
    fromHex(seedHex),
    utf8(PAYLOAD_SEPARATOR),
    utf8(timestamp),
    utf8(PAYLOAD_SEPARATOR),
    fromHex(messageHashHex),
  ];
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const packed = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    packed.set(part, offset);
    offset += part.length;
  }
  return keccak_256(packed);
}

function humanAge(isoTimestamp: string): string {
  const elapsedMs = Date.now() - new Date(isoTimestamp).getTime();
  if (Number.isNaN(elapsedMs)) return "unknown";
  if (elapsedMs < 60_000) return `${Math.round(elapsedMs / 1000)}s ago`;
  if (elapsedMs < 3_600_000) return `${Math.round(elapsedMs / 60_000)}m ago`;
  if (elapsedMs < 86_400_000) return `${Math.round(elapsedMs / 3_600_000)}h ago`;
  return `${Math.round(elapsedMs / 86_400_000)}d ago`;
}

function makeStep(id: string, label: string, ok: boolean, detail: string): VerificationStep {
  return { id, label, ok, detail };
}

function checkMessageHash(att: Attestation): VerificationStep {
  try {
    const expected = "0x" + bytesToHex(keccak_256(utf8(att.message)));
    const ok = expected.toLowerCase() === att.messageHash.toLowerCase();
    return makeStep(
      "msg-hash",
      "Message hash is correct",
      ok,
      ok
        ? `keccak256(message) = ${expected.slice(0, 18)}…`
        : "claimed messageHash does not match keccak256(message)",
    );
  } catch (e) {
    return makeStep("msg-hash", "Message hash is correct", false, String(e));
  }
}

function checkSatelliteSignature(att: Attestation): VerificationStep {
  try {
    if (!att.cosmic.satelliteSignature || !att.cosmic.satellitePublicKey) {
      return makeStep(
        "sat-sig",
        "Satellite signature over the cosmic seed",
        false,
        "missing satellite signature/pubkey on cosmic block",
      );
    }
    const digest = sha256(utf8(att.cosmic.seed + "|" + att.cosmic.timestamp));
    const ok = ed25519.verify(
      fromHex(att.cosmic.satelliteSignature),
      digest,
      fromHex(att.cosmic.satellitePublicKey),
    );
    return makeStep(
      "sat-sig",
      "Satellite signature over the cosmic seed",
      ok,
      ok
        ? `ed25519 over sha256(seed || ts) verified against ${att.cosmic.satellitePublicKey.slice(0, 14)}…`
        : "ed25519 verification failed — seed or timestamp may have been tampered with",
    );
  } catch (e) {
    return makeStep("sat-sig", "Satellite signature over the cosmic seed", false, String(e));
  }
}

function checkBinding(att: Attestation): VerificationStep {
  try {
    const expected = "0x" + bytesToHex(
      recomputePayloadHash(att.cosmic.seed, att.cosmic.timestamp, att.messageHash),
    );
    const ok = expected.toLowerCase() === att.payloadHash.toLowerCase();
    return makeStep(
      "binding",
      "Cosmic seed is bound to this exact message",
      ok,
      ok
        ? "payloadHash = keccak256('hollow-vault/v1|' || seed || '|' || ts || '|' || messageHash)"
        : "claimed payloadHash does not match the cosmic + message inputs",
    );
  } catch (e) {
    return makeStep("binding", "Cosmic seed is bound to this exact message", false, String(e));
  }
}

interface EcdsaCheckResult {
  step: VerificationStep;
  recoveredAddress?: string;
}

function checkEcdsaRecovery(att: Attestation): EcdsaCheckResult {
  try {
    const compactSig = fromHex(att.signature);
    if (compactSig.length !== 64) throw new Error("expected 64-byte compact signature");

    const recoverable = new Uint8Array(65);
    recoverable[0] = att.recoveryId & 0x01;
    recoverable.set(compactSig, 1);

    const recoveredCompressed = secp256k1.recoverPublicKey(
      recoverable,
      fromHex(att.payloadHash),
      { prehash: false },
    );
    const recoveredUncompressed = secp256k1.Point.fromBytes(recoveredCompressed).toBytes(false);
    const claimedPubBytes = fromHex(att.signerPublicKey);

    const pubMatches =
      recoveredUncompressed.length === claimedPubBytes.length &&
      recoveredUncompressed.every((byte, i) => byte === claimedPubBytes[i]);
    const recoveredAddress = ethereumAddress(recoveredUncompressed);
    const addressMatches = recoveredAddress.toLowerCase() === att.signerAddress.toLowerCase();
    const ok = pubMatches && addressMatches;

    return {
      step: makeStep(
        "ecdsa",
        "ECDSA signature is valid and recovers the claimed signer",
        ok,
        ok
          ? `recovered ${recoveredAddress}`
          : `signer address mismatch (recovered ${recoveredAddress}, claimed ${att.signerAddress})`,
      ),
      recoveredAddress,
    };
  } catch (e) {
    return {
      step: makeStep(
        "ecdsa",
        "ECDSA signature is valid and recovers the claimed signer",
        false,
        String(e),
      ),
    };
  }
}

function checkFreshness(att: Attestation): VerificationStep {
  try {
    const cosmicTimeMs = new Date(att.cosmic.timestamp).getTime();
    const driftMs = Date.now() - cosmicTimeMs;
    const isFresh =
      !Number.isNaN(cosmicTimeMs) &&
      driftMs > -FRESHNESS_PAST_LIMIT_MS &&
      driftMs < FRESHNESS_FUTURE_LIMIT_MS;
    return makeStep(
      "fresh",
      "Cosmic entropy is recent",
      isFresh,
      isFresh
        ? `cosmic timestamp ${humanAge(att.cosmic.timestamp)}`
        : `timestamp drift ${Math.round(driftMs / 1000)}s — outside ±2min/+24h window`,
    );
  } catch (e) {
    return makeStep("fresh", "Cosmic entropy is recent", false, String(e));
  }
}

export function verifyAttestation(att: Attestation): VerificationReport {
  const ecdsaResult = checkEcdsaRecovery(att);
  const steps: VerificationStep[] = [
    checkMessageHash(att),
    checkSatelliteSignature(att),
    checkBinding(att),
    ecdsaResult.step,
    checkFreshness(att),
  ];
  return {
    ok: steps.every((step) => step.ok),
    steps,
    signerAddress: ecdsaResult.recoveredAddress,
    cosmicAge: att.cosmic.timestamp ? humanAge(att.cosmic.timestamp) : undefined,
  };
}
