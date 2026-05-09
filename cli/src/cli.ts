#!/usr/bin/env node
/**
 * hollow — headless interface to the cosmic signer.
 *
 * Examples:
 *   hollow identity
 *   hollow sign "I authorize transfer 1.5 ETH to 0xAlice"
 *   hollow verify ./attestation.json
 *   hollow batch msg1 msg2 msg3
 *   echo "msg" | hollow sign --stdin
 */
import { readFile } from "node:fs/promises";
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const SIGNER_URL = process.env.SIGNER_URL ?? "http://localhost:8080";
const utf8 = (s: string) => new TextEncoder().encode(s);
const fromHex = (s: string) => hexToBytes(s.startsWith("0x") ? s.slice(2) : s);

function ethAddr(pub: Uint8Array): string {
  return "0x" + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
}

async function readStdin(): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function callSigner(path: string, body: unknown) {
  const res = await fetch(`${SIGNER_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`signer ${path} returned ${res.status}: ${text}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

async function cmdIdentity() {
  const res = await fetch(`${SIGNER_URL}/identity`);
  const j = await res.json();
  console.log(JSON.stringify(j, null, 2));
}

async function cmdSign(args: string[]) {
  let message: string;
  if (args[0] === "--stdin") {
    message = (await readStdin()).trimEnd();
  } else if (args[0]) {
    message = args[0];
  } else {
    console.error("usage: hollow sign <message>  |  hollow sign --stdin");
    process.exit(2);
  }
  const att = await callSigner("/sign", { message });
  console.log(JSON.stringify(att, null, 2));
}

async function cmdBatch(args: string[]) {
  if (args.length === 0) {
    console.error("usage: hollow batch <msg1> [msg2 ...]");
    process.exit(2);
  }
  const result = await callSigner("/sign-batch", { messages: args });
  console.log(JSON.stringify(result, null, 2));
}

interface CosmicEntropyShape {
  seed: string;
  timestamp: string;
  satelliteSignature: string;
  satellitePublicKey: string;
  source: string;
}
interface AttestationShape {
  message: string;
  messageHash: string;
  cosmic: CosmicEntropyShape;
  payloadHash: string;
  signature: string;
  recoveryId: number;
  signerPublicKey: string;
  signerAddress: string;
}

function recomputePayloadHash(seedHex: string, ts: string, mh: string): Uint8Array {
  const parts = [
    utf8("hollow-vault/v1|"),
    fromHex(seedHex),
    utf8("|"),
    utf8(ts),
    utf8("|"),
    fromHex(mh),
  ];
  const total = parts.reduce((n, b) => n + b.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  return keccak_256(buf);
}

async function cmdVerify(args: string[]) {
  if (!args[0]) {
    console.error("usage: hollow verify <attestation.json>");
    process.exit(2);
  }
  const raw = await readFile(args[0], "utf8");
  const att = JSON.parse(raw) as AttestationShape;

  const checks: { ok: boolean; label: string; detail: string }[] = [];

  const expectedMh = "0x" + bytesToHex(keccak_256(utf8(att.message)));
  checks.push({
    ok: expectedMh.toLowerCase() === att.messageHash.toLowerCase(),
    label: "message hash",
    detail: expectedMh.slice(0, 18) + "…",
  });

  if (att.cosmic.satelliteSignature && att.cosmic.satellitePublicKey) {
    const digest = sha256(utf8(att.cosmic.seed + "|" + att.cosmic.timestamp));
    const ok = ed25519.verify(
      fromHex(att.cosmic.satelliteSignature),
      digest,
      fromHex(att.cosmic.satellitePublicKey),
    );
    checks.push({ ok, label: "satellite signature", detail: ok ? "ed25519 ✓" : "ed25519 ✗" });
  } else {
    checks.push({ ok: false, label: "satellite signature", detail: "missing fields" });
  }

  const expectedPh = "0x" + bytesToHex(
    recomputePayloadHash(att.cosmic.seed, att.cosmic.timestamp, att.messageHash),
  );
  checks.push({
    ok: expectedPh.toLowerCase() === att.payloadHash.toLowerCase(),
    label: "binding (seed+ts+msg → payloadHash)",
    detail: expectedPh.slice(0, 18) + "…",
  });

  const compact = fromHex(att.signature);
  const sig65 = new Uint8Array(65);
  sig65[0] = att.recoveryId & 0x01;
  sig65.set(compact, 1);
  const recCompressed = secp256k1.recoverPublicKey(sig65, fromHex(att.payloadHash), {
    prehash: false,
  });
  const recPub = secp256k1.Point.fromBytes(recCompressed).toBytes(false);
  const recAddr = ethAddr(recPub);
  checks.push({
    ok: recAddr.toLowerCase() === att.signerAddress.toLowerCase(),
    label: "ECDSA recovery → signer address",
    detail: recAddr,
  });

  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.label.padEnd(40)} ${c.detail}`);
  }
  const ok = checks.every((c) => c.ok);
  console.log(ok ? "\n✓ valid" : "\n✗ rejected");
  process.exit(ok ? 0 : 1);
}

function help() {
  console.log(`hollow — headless interface to the cosmic signer

Commands:
  identity                       Show the signer's address and capabilities
  sign <message>                 Sign a single message; prints attestation JSON
  sign --stdin                   Read message from stdin and sign
  batch <msg1> [msg2 ...]        Sign N messages with one cTRNG draw
  verify <file.json>             Locally verify an attestation file

Environment:
  SIGNER_URL                     Override signer endpoint (default: ${SIGNER_URL})
`);
}

const [, , cmd, ...rest] = process.argv;
const handlers: Record<string, (args: string[]) => Promise<void> | void> = {
  identity: () => cmdIdentity(),
  sign: cmdSign,
  batch: cmdBatch,
  verify: cmdVerify,
  help,
  "--help": help,
  "-h": help,
};
const handler = cmd ? handlers[cmd] : help;
if (!handler) {
  console.error(`unknown command: ${cmd}\n`);
  help();
  process.exit(2);
}
Promise.resolve(handler(rest)).catch((e) => {
  console.error(e);
  process.exit(1);
});
