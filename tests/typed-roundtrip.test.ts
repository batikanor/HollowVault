import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { hashTypedData, recoverAddress } from "viem";
import {
  generateLocalSigner,
  getCosmicEntropy,
  signTypedAttestation,
  type EIP712TypedData,
  type SignerHandle,
} from "@hollow-vault/core";

process.env.ORBITPORT_MODE = "mock";

const PERMIT: EIP712TypedData = {
  domain: { name: "USD Coin", version: "2", chainId: 1, verifyingContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
  types: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  message: {
    owner: "0x6a8ae891b034a56940c5528c42350fd8a9ca8004",
    spender: "0x1111111254eeb25477b68fb85ed929f73a960582",
    value: "1000000000",
    nonce: "0",
    deadline: "9999999999",
  },
};

let signer: SignerHandle;

before(() => { signer = generateLocalSigner().signer; });

describe("signTypedAttestation roundtrip", () => {
  it("eip712Digest matches viem.hashTypedData byte-for-byte", async () => {
    const cosmic = await getCosmicEntropy();
    const att = await signTypedAttestation(signer, PERMIT, cosmic);
    const viemDigest = hashTypedData({
      domain: PERMIT.domain as never,
      types: PERMIT.types as never,
      primaryType: PERMIT.primaryType as never,
      message: PERMIT.message as never,
    });
    assert.equal(att.eip712Digest.toLowerCase(), viemDigest.toLowerCase());
  });

  it("recovers to the signer's address using viem", async () => {
    const cosmic = await getCosmicEntropy();
    const att = await signTypedAttestation(signer, PERMIT, cosmic);
    const r = att.signature.slice(2, 66);
    const s = att.signature.slice(66, 130);
    const v = (att.recoveryId + 27).toString(16).padStart(2, "0");
    const compactSig = `0x${r}${s}${v}` as `0x${string}`;
    const recovered = await recoverAddress({
      hash: ("0x" + bytesToHex(hexToBytes(att.payloadHash.slice(2)))) as `0x${string}`,
      signature: compactSig,
    });
    assert.equal(recovered.toLowerCase(), signer.identity.address.toLowerCase());
  });

  it("payloadHash binds the cosmic seed + timestamp + EIP-712 digest", async () => {
    const cosmic = await getCosmicEntropy();
    const att = await signTypedAttestation(signer, PERMIT, cosmic);
    const utf8 = (s: string) => new TextEncoder().encode(s);
    const seed = hexToBytes(att.cosmic.seed);
    const ts = utf8(att.cosmic.timestamp);
    const digest = hexToBytes(att.eip712Digest.slice(2));
    const parts = [utf8("cosmic-typed/v1|"), seed, utf8("|"), ts, utf8("|"), digest];
    const total = parts.reduce((n, b) => n + b.length, 0);
    const packed = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { packed.set(p, off); off += p.length; }
    const expected = "0x" + bytesToHex(keccak_256(packed));
    assert.equal(att.payloadHash.toLowerCase(), expected.toLowerCase());
  });

  it("different message → different signature (no nonce reuse)", async () => {
    const cosmic = await getCosmicEntropy();
    const a = await signTypedAttestation(signer, PERMIT, cosmic);
    const altered: EIP712TypedData = {
      ...PERMIT,
      message: { ...PERMIT.message, value: "2000000000" },
    };
    const b = await signTypedAttestation(signer, altered, cosmic);
    assert.notEqual(a.signature, b.signature);
    assert.notEqual(a.eip712Digest, b.eip712Digest);
  });

  it("meta records the typed scheme + signer type", async () => {
    const cosmic = await getCosmicEntropy();
    const att = await signTypedAttestation(signer, PERMIT, cosmic);
    assert.equal(att.meta.scheme, "hollow-vault-typed/v1");
    assert.equal(att.meta.signerType, "local");
    assert.equal(att.meta.nonceMode, "local-rfc6979");
    assert.equal(att.meta.keyId, "local");
  });

  it("handles a typed message with bool + array fields", async () => {
    const td: EIP712TypedData = {
      domain: { name: "Vote", version: "1", chainId: 1 },
      types: {
        Ballot: [
          { name: "voter", type: "address" },
          { name: "support", type: "bool" },
          { name: "tags", type: "string[]" },
        ],
      },
      primaryType: "Ballot",
      message: {
        voter: "0x6a8ae891b034a56940c5528c42350fd8a9ca8004",
        support: true,
        tags: ["alpha", "beta"],
      },
    };
    const cosmic = await getCosmicEntropy();
    const att = await signTypedAttestation(signer, td, cosmic);
    const viemDigest = hashTypedData({
      domain: td.domain as never,
      types: td.types as never,
      primaryType: td.primaryType as never,
      message: td.message as never,
    });
    assert.equal(att.eip712Digest.toLowerCase(), viemDigest.toLowerCase());
  });
});

describe("signature shape invariants", () => {
  it("65-byte r||s||v reconstructable from compactSig + recoveryId", async () => {
    const cosmic = await getCosmicEntropy();
    const att = await signTypedAttestation(signer, PERMIT, cosmic);
    const compact = hexToBytes(att.signature.slice(2));
    assert.equal(compact.length, 64);
    const recoverable = new Uint8Array(65);
    recoverable[0] = att.recoveryId & 1;
    recoverable.set(compact, 1);
    const recoveredCompressed = secp256k1.recoverPublicKey(
      recoverable,
      hexToBytes(att.payloadHash.slice(2)),
      { prehash: false },
    );
    const recoveredUncompressed = secp256k1.Point.fromBytes(recoveredCompressed).toBytes(false);
    const claimedPub = hexToBytes(att.signerPublicKey.slice(2));
    assert.deepEqual(Array.from(recoveredUncompressed), Array.from(claimedPub));
  });
});
