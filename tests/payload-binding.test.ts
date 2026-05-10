import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { computePayloadHash } from "../signer/src/attestation.js";

const utf8 = (s: string) => new TextEncoder().encode(s);

const seed = bytesToHex(keccak_256(utf8("seed-fixture")));
const timestamp = "2026-05-09T12:00:00.000Z";
const messageHash = "0x" + bytesToHex(keccak_256(utf8("hello cosmos")));

describe("payloadHash binding", () => {
  it("is deterministic for identical inputs", () => {
    const a = computePayloadHash(seed, timestamp, messageHash);
    const b = computePayloadHash(seed, timestamp, messageHash);
    assert.equal(bytesToHex(a), bytesToHex(b));
  });

  it("changes if the cosmic seed changes by one bit", () => {
    const seedBytes = hexToBytes(seed);
    seedBytes[0] ^= 0x01;
    const original = computePayloadHash(seed, timestamp, messageHash);
    const flipped = computePayloadHash(bytesToHex(seedBytes), timestamp, messageHash);
    assert.notEqual(bytesToHex(original), bytesToHex(flipped));
  });

  it("changes if the timestamp changes", () => {
    const original = computePayloadHash(seed, timestamp, messageHash);
    const later = computePayloadHash(seed, "2026-05-09T12:00:00.001Z", messageHash);
    assert.notEqual(bytesToHex(original), bytesToHex(later));
  });

  it("changes if the message changes", () => {
    const original = computePayloadHash(seed, timestamp, messageHash);
    const otherMessageHash = "0x" + bytesToHex(keccak_256(utf8("hello stars")));
    const altered = computePayloadHash(seed, timestamp, otherMessageHash);
    assert.notEqual(bytesToHex(original), bytesToHex(altered));
  });

  it("matches the Solidity abi.encodePacked layout byte-for-byte", () => {
    const scheme = utf8("hollow-vault/v1|");
    const sep = utf8("|");
    const seedBytes = hexToBytes(seed);
    const messageHashBytes = hexToBytes(messageHash.slice(2));
    const tsBytes = utf8(timestamp);

    const packed = new Uint8Array(
      scheme.length + 32 + 1 + tsBytes.length + 1 + 32,
    );
    let offset = 0;
    packed.set(scheme, offset); offset += scheme.length;
    packed.set(seedBytes, offset); offset += 32;
    packed.set(sep, offset); offset += 1;
    packed.set(tsBytes, offset); offset += tsBytes.length;
    packed.set(sep, offset); offset += 1;
    packed.set(messageHashBytes, offset);

    const fromContractLayout = bytesToHex(keccak_256(packed));
    const fromOurLib = bytesToHex(computePayloadHash(seed, timestamp, messageHash));
    assert.equal(fromOurLib, fromContractLayout);
  });
});
