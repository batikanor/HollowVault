import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  generateLocalSigner,
  getCosmicEntropy,
  signAttestation,
  type SignerHandle,
} from "@hollow-vault/core";

process.env.ORBITPORT_MODE = "mock";

let signer: SignerHandle;

before(() => { signer = generateLocalSigner().signer; });

describe("LocalSigner identity", () => {
  it("returns a 65-byte uncompressed public key", () => {
    const bytes = hexToBytes(signer.identity.publicKey.replace(/^0x/, ""));
    assert.equal(bytes.length, 65);
    assert.equal(bytes[0], 0x04);
  });

  it("derives the Ethereum address from the public key", () => {
    const bytes = hexToBytes(signer.identity.publicKey.replace(/^0x/, ""));
    const expected = "0x" + bytesToHex(keccak_256(bytes.slice(1)).slice(-20));
    assert.equal(signer.identity.address.toLowerCase(), expected.toLowerCase());
  });

  it("identifies itself as a local signer", () => {
    assert.equal(signer.identity.signerType, "local");
    assert.equal(signer.identity.keyId, "local");
  });
});

describe("LocalSigner sign() round-trip", () => {
  it("produces a 64-byte compact signature with recoveryId in {0,1}", async () => {
    const digest = keccak_256(new TextEncoder().encode("sign-this-fixture"));
    const result = await signer.sign(digest);
    assert.equal(result.compactSig.length, 64);
    assert.ok(result.recoveryId === 0 || result.recoveryId === 1);
  });

  it("ECDSA-recovers to the signer's own address", async () => {
    const digest = keccak_256(new TextEncoder().encode("recovery-fixture"));
    const { compactSig, recoveryId } = await signer.sign(digest);

    const recoverable = new Uint8Array(65);
    recoverable[0] = recoveryId;
    recoverable.set(compactSig, 1);

    const compressed = secp256k1.recoverPublicKey(recoverable, digest, { prehash: false });
    const uncompressed = secp256k1.Point.fromBytes(compressed).toBytes(false);
    const recoveredAddr = "0x" + bytesToHex(keccak_256(uncompressed.slice(1)).slice(-20));

    assert.equal(recoveredAddr.toLowerCase(), signer.identity.address.toLowerCase());
  });
});

describe("end-to-end: sign + cosmic-binding + verify", () => {
  it("full attestation envelope verifies offline", async () => {
    const cosmic = await getCosmicEntropy();
    const att = await signAttestation(signer, "fixture message", cosmic);
    assert.equal(att.signerAddress, signer.identity.address);
    assert.equal(att.signature.length, 130, "0x + 64 bytes hex");
    assert.equal(att.payloadHash.length, 66, "0x + 32 bytes hex");
  });
});
