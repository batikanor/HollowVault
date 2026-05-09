/**
 * Live demonstration of the broken-RNG ECDSA nonce attack — the exact class
 * of vulnerability that took down Sony PS3 (2010) and a wave of Android
 * Bitcoin wallets (2013).
 *
 * The math: given two ECDSA signatures (r, s1) and (r, s2) on different
 * messages with the same nonce k, the private key d is recoverable in
 * closed form:
 *
 *     k = (z1 - z2) / (s1 - s2)              mod n
 *     d = (s1 · k - z1) / r                  mod n
 *
 * This file produces a fresh keypair, signs two messages with a deliberately
 * reused k, and recovers the private key from those two signatures alone —
 * with no access to anything else. The recovered key matches the original.
 *
 * It also produces two "safe" signatures (different k each time, sourced
 * from CSPRNG + cosmic-style extra entropy) and shows that the same
 * attempted recovery fails.
 *
 * Pure client-side. No server calls.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const utf8 = (s: string) => new TextEncoder().encode(s);
const N = secp256k1.Point.Fn.ORDER;

function randomScalar(): bigint {
  for (;;) {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    let n = BigInt("0x" + bytesToHex(buf));
    n %= N;
    if (n > 0n) return n;
  }
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a % m, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function modN(x: bigint): bigint {
  const m = ((x % N) + N) % N;
  return m;
}

interface RawSig {
  r: bigint;
  s: bigint;
  z: bigint;
  message: string;
}

/**
 * Manually sign with an explicitly chosen k. We bypass @noble/curves' safe
 * RFC 6979 path on purpose — this function exists to PRODUCE the bug, not
 * to be a safe primitive.
 */
function signWithExplicitK(messageHash: Uint8Array, privateKey: bigint, k: bigint): RawSig {
  const z = BigInt("0x" + bytesToHex(messageHash));
  const G = secp256k1.Point.BASE;
  const point = G.multiply(k);
  const r = modN(point.x);
  if (r === 0n) throw new Error("retry — degenerate k");
  const kInv = modInverse(k, N);
  const s = modN(kInv * (z + r * privateKey));
  if (s === 0n) throw new Error("retry — degenerate k");
  return { r, s, z, message: "" };
}

export interface BrokenDemoResult {
  privateKey: string;
  publicKey: string;
  address: string;
  reusedNonce: string;
  signatureA: { message: string; r: string; s: string; messageHash: string };
  signatureB: { message: string; r: string; s: string; messageHash: string };
  recoveredPrivateKey: string;
  match: boolean;
}

export interface SafeDemoResult {
  privateKey: string;
  publicKey: string;
  address: string;
  signatureA: { message: string; r: string; s: string; messageHash: string };
  signatureB: { message: string; r: string; s: string; messageHash: string };
  attemptedRecoveredKey: string;
  match: boolean;
}

function ethAddr(pub: Uint8Array): string {
  return "0x" + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
}

function bigToHex32(x: bigint): string {
  return "0x" + x.toString(16).padStart(64, "0");
}

export function runBrokenRngDemo(messageA: string, messageB: string): BrokenDemoResult {
  const privKeyBig = randomScalar();
  const privKey = hexToBytes(privKeyBig.toString(16).padStart(64, "0"));
  const pub = secp256k1.getPublicKey(privKey, false);
  const address = ethAddr(pub);

  // The bug: same k for two different messages. This is exactly what Sony
  // PS3's signing did, and what broken Android SecureRandom produced.
  const k = randomScalar();

  const zA = keccak_256(utf8(messageA));
  const zB = keccak_256(utf8(messageB));
  const sigA = signWithExplicitK(zA, privKeyBig, k);
  const sigB = signWithExplicitK(zB, privKeyBig, k);

  // Recovery: an attacker sees sigA and sigB on chain and notices the same
  // r value (the public x coordinate of k·G). That's the giveaway.
  // From there:  k = (zA - zB) / (sA - sB)  →  d = (sA·k - zA) / r
  const dz = modN(sigA.z - sigB.z);
  const ds = modN(sigA.s - sigB.s);
  const recoveredK = modN(dz * modInverse(ds, N));
  const recoveredD = modN((sigA.s * recoveredK - sigA.z) * modInverse(sigA.r, N));

  const match = recoveredD === privKeyBig;

  return {
    privateKey: bigToHex32(privKeyBig),
    publicKey: "0x" + bytesToHex(pub),
    address,
    reusedNonce: bigToHex32(k),
    signatureA: {
      message: messageA,
      r: bigToHex32(sigA.r),
      s: bigToHex32(sigA.s),
      messageHash: "0x" + bytesToHex(zA),
    },
    signatureB: {
      message: messageB,
      r: bigToHex32(sigB.r),
      s: bigToHex32(sigB.s),
      messageHash: "0x" + bytesToHex(zB),
    },
    recoveredPrivateKey: bigToHex32(recoveredD),
    match,
  };
}

export function runSafeDemo(messageA: string, messageB: string): SafeDemoResult {
  const privKeyBig = randomScalar();
  const privKey = hexToBytes(privKeyBig.toString(16).padStart(64, "0"));
  const pub = secp256k1.getPublicKey(privKey, false);
  const address = ethAddr(pub);

  // Two cosmic-style draws — different "extra entropy" each time, mixed
  // into RFC 6979 derivation. nonce k differs per signature.
  const cosmicA = new Uint8Array(32);
  const cosmicB = new Uint8Array(32);
  crypto.getRandomValues(cosmicA);
  crypto.getRandomValues(cosmicB);

  const zA = keccak_256(utf8(messageA));
  const zB = keccak_256(utf8(messageB));
  const sa = secp256k1.Signature.fromBytes(
    secp256k1.sign(zA, privKey, { extraEntropy: cosmicA, prehash: false }),
    "compact",
  );
  const sb = secp256k1.Signature.fromBytes(
    secp256k1.sign(zB, privKey, { extraEntropy: cosmicB, prehash: false }),
    "compact",
  );

  // Try the same recovery math an attacker would run. With different k
  // values, the math gives a meaningless number that is NOT the private key.
  const ra = sa.r;
  const rb = sb.r;
  const sScalarA = sa.s;
  const sScalarB = sb.s;
  const zaBig = BigInt("0x" + bytesToHex(zA));
  const zbBig = BigInt("0x" + bytesToHex(zB));

  // Note: r values won't even match. This is the first defense — the
  // attacker's heuristic "find pairs with same r" returns nothing. We
  // attempt the recovery formula anyway with sigA's r to demonstrate that
  // the result is garbage.
  let attempted = 0n;
  try {
    const dz = modN(zaBig - zbBig);
    const ds = modN(sScalarA - sScalarB);
    if (ds !== 0n && ra !== 0n) {
      const fakeK = modN(dz * modInverse(ds, N));
      attempted = modN((sScalarA * fakeK - zaBig) * modInverse(ra, N));
    }
  } catch {
    /* ds may not be invertible — recovery formula simply doesn't apply */
  }

  return {
    privateKey: bigToHex32(privKeyBig),
    publicKey: "0x" + bytesToHex(pub),
    address,
    signatureA: {
      message: messageA,
      r: bigToHex32(ra),
      s: bigToHex32(sScalarA),
      messageHash: "0x" + bytesToHex(zA),
    },
    signatureB: {
      message: messageB,
      r: bigToHex32(rb),
      s: bigToHex32(sScalarB),
      messageHash: "0x" + bytesToHex(zB),
    },
    attemptedRecoveredKey: bigToHex32(attempted),
    match: attempted === privKeyBig,
  };
}
