import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromHex, type CosmicEntropy } from "./orbitport.js";
import type { SignerHandle } from "./signer.js";

export interface Attestation {
  message: string;
  messageHash: string;
  cosmic: CosmicEntropy;
  payloadHash: string;
  signature: string;
  recoveryId: number;
  signerPublicKey: string;
  signerAddress: string;
  signedAt: string;
  meta: {
    scheme: "hollow-vault/v1";
    nonceMode: string;
    signerType: string;
    keyId: string;
    deviceCreatedAt: string;
  };
}

export const PAYLOAD_SCHEME = "hollow-vault/v1|";
export const PAYLOAD_SEPARATOR = "|";

const utf8 = (s: string) => new TextEncoder().encode(s);

export function computePayloadHash(
  seedHex: string,
  timestamp: string,
  messageHashHex: string,
): Uint8Array {
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

export async function signAttestation(
  signer: SignerHandle,
  message: string,
  cosmic: CosmicEntropy,
): Promise<Attestation> {
  const messageHashBytes = keccak_256(utf8(message));
  const messageHash = "0x" + bytesToHex(messageHashBytes);
  const payloadHashBytes = computePayloadHash(cosmic.seed, cosmic.timestamp, messageHash);
  const payloadHash = "0x" + bytesToHex(payloadHashBytes);
  const { compactSig, recoveryId } = await signer.sign(payloadHashBytes);
  return {
    message,
    messageHash,
    cosmic,
    payloadHash,
    signature: "0x" + bytesToHex(compactSig),
    recoveryId,
    signerPublicKey: signer.identity.publicKey,
    signerAddress: signer.identity.address,
    signedAt: new Date().toISOString(),
    meta: {
      scheme: "hollow-vault/v1",
      nonceMode: signer.identity.signerType === "kms" ? "kms-orbit-managed" : "local-rfc6979",
      signerType: signer.identity.signerType,
      keyId: signer.identity.keyId,
      deviceCreatedAt: signer.identity.createdAt,
    },
  };
}
