import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { fromHex, type CosmicEntropy } from "./orbitport.js";
import type { SignerHandle } from "./signer.js";

export interface EIP712Domain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
}

export interface EIP712TypedData {
  domain: EIP712Domain;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface TypedAttestation {
  typedData: EIP712TypedData;
  eip712Digest: string;
  cosmic: CosmicEntropy;
  payloadHash: string;
  signature: string;
  recoveryId: number;
  signerPublicKey: string;
  signerAddress: string;
  signedAt: string;
  meta: {
    scheme: "hollow-vault-typed/v1";
    nonceMode: string;
    signerType: string;
    keyId: string;
    deviceCreatedAt: string;
  };
}

const utf8 = (s: string) => new TextEncoder().encode(s);

function dependencies(primaryType: string, types: EIP712TypedData["types"]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  function walk(t: string) {
    const base = t.replace(/\[.*\]$/, "");
    if (!types[base] || seen.has(base)) return;
    seen.add(base);
    order.push(base);
    for (const f of types[base]) walk(f.type);
  }
  walk(primaryType);
  return [primaryType, ...order.filter((x) => x !== primaryType).sort()];
}

function encodeType(primaryType: string, types: EIP712TypedData["types"]): string {
  return dependencies(primaryType, types)
    .map((t) => `${t}(${types[t].map((f) => `${f.type} ${f.name}`).join(",")})`)
    .join("");
}

function typeHash(primaryType: string, types: EIP712TypedData["types"]): Uint8Array {
  return keccak_256(utf8(encodeType(primaryType, types)));
}

function pad32(x: Uint8Array): Uint8Array {
  if (x.length === 32) return x;
  if (x.length > 32) throw new Error("value > 32 bytes");
  const out = new Uint8Array(32);
  out.set(x, 32 - x.length);
  return out;
}

function uintToBytes32(v: bigint | number | string): Uint8Array {
  let n = typeof v === "bigint" ? v : BigInt(v as never);
  if (n < 0n) n = (1n << 256n) + n;
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return bytes;
}

function encodeValue(t: string, v: unknown, types: EIP712TypedData["types"]): Uint8Array {
  const arrMatch = t.match(/^(.+)\[(\d*)\]$/);
  if (arrMatch) {
    const inner = arrMatch[1];
    const arr = v as unknown[];
    const encoded = arr.map((x) => encodeValue(inner, x, types));
    const buf = new Uint8Array(encoded.length * 32);
    for (let i = 0; i < encoded.length; i++) buf.set(encoded[i], i * 32);
    return keccak_256(buf);
  }
  if (types[t]) return hashStruct(t, v as Record<string, unknown>, types);
  if (t === "string") return keccak_256(utf8(String(v)));
  if (t === "bytes") {
    const bytes = typeof v === "string" ? fromHex(v) : (v as Uint8Array);
    return keccak_256(bytes);
  }
  if (t === "address") {
    const hex = (v as string).toLowerCase().replace(/^0x/, "");
    return pad32(hexToBytes(hex.padStart(40, "0")));
  }
  if (t === "bool") return uintToBytes32(v ? 1 : 0);
  if (/^bytes\d+$/.test(t)) {
    const bytes = typeof v === "string" ? fromHex(v) : (v as Uint8Array);
    const out = new Uint8Array(32);
    out.set(bytes);
    return out;
  }
  if (/^u?int\d*$/.test(t)) return uintToBytes32(v as bigint | number | string);
  throw new Error(`unsupported EIP-712 type: ${t}`);
}

function hashStruct(
  primaryType: string,
  data: Record<string, unknown>,
  types: EIP712TypedData["types"],
): Uint8Array {
  const fields = types[primaryType];
  const buf = new Uint8Array(32 * (fields.length + 1));
  buf.set(typeHash(primaryType, types), 0);
  for (let i = 0; i < fields.length; i++) {
    buf.set(encodeValue(fields[i].type, data[fields[i].name], types), 32 * (i + 1));
  }
  return keccak_256(buf);
}

const DOMAIN_FIELDS: Array<{ name: keyof EIP712Domain; type: string }> = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
  { name: "salt", type: "bytes32" },
];

function domainSeparator(domain: EIP712Domain): Uint8Array {
  const usedFields = DOMAIN_FIELDS.filter((f) => domain[f.name] !== undefined);
  const types: EIP712TypedData["types"] = {
    EIP712Domain: usedFields.map((f) => ({ name: f.name as string, type: f.type })),
  };
  return hashStruct("EIP712Domain", domain as Record<string, unknown>, types);
}

export function eip712Digest(td: EIP712TypedData): Uint8Array {
  const ds = domainSeparator(td.domain);
  const ms = hashStruct(td.primaryType, td.message, td.types);
  const buf = new Uint8Array(2 + 32 + 32);
  buf[0] = 0x19;
  buf[1] = 0x01;
  buf.set(ds, 2);
  buf.set(ms, 34);
  return keccak_256(buf);
}

function computeTypedPayloadHash(
  seedHex: string,
  timestamp: string,
  eip712DigestBytes: Uint8Array,
): Uint8Array {
  const parts = [
    utf8("cosmic-typed/v1|"),
    fromHex(seedHex),
    utf8("|"),
    utf8(timestamp),
    utf8("|"),
    eip712DigestBytes,
  ];
  const total = parts.reduce((n, b) => n + b.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return keccak_256(buf);
}

export async function signTypedAttestation(
  signer: SignerHandle,
  td: EIP712TypedData,
  cosmic: CosmicEntropy,
): Promise<TypedAttestation> {
  const digest = eip712Digest(td);
  const eip712DigestHex = "0x" + bytesToHex(digest);
  const payloadHashBytes = computeTypedPayloadHash(cosmic.seed, cosmic.timestamp, digest);
  const payloadHash = "0x" + bytesToHex(payloadHashBytes);
  const { compactSig, recoveryId } = await signer.sign(payloadHashBytes);
  return {
    typedData: td,
    eip712Digest: eip712DigestHex,
    cosmic,
    payloadHash,
    signature: "0x" + bytesToHex(compactSig),
    recoveryId,
    signerPublicKey: signer.identity.publicKey,
    signerAddress: signer.identity.address,
    signedAt: new Date().toISOString(),
    meta: {
      scheme: "hollow-vault-typed/v1",
      nonceMode: signer.identity.signerType === "kms" ? "kms-orbit-managed" : "local-rfc6979",
      signerType: signer.identity.signerType,
      keyId: signer.identity.keyId,
      deviceCreatedAt: signer.identity.createdAt,
    },
  };
}
