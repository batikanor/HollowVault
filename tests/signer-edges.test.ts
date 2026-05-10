import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  ethereumAddressFromUncompressed,
  generateLocalSigner,
  kmsSignerFromIdentity,
  localSignerFromPrivateKey,
} from "@hollow-vault/core";

describe("ethereumAddressFromUncompressed", () => {
  it("derives the canonical Ethereum address from a real keypair", () => {
    const priv = secp256k1.utils.randomSecretKey();
    const pub = secp256k1.getPublicKey(priv, false);
    const expected = "0x" + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
    assert.equal(ethereumAddressFromUncompressed(pub), expected);
  });

  it("rejects a 33-byte compressed pubkey", () => {
    const priv = secp256k1.utils.randomSecretKey();
    const compressed = secp256k1.getPublicKey(priv, true);
    assert.equal(compressed.length, 33);
    assert.throws(() => ethereumAddressFromUncompressed(compressed), /uncompressed/i);
  });

  it("rejects a 65-byte buffer that doesn't start with 0x04", () => {
    const bad = new Uint8Array(65);
    bad[0] = 0x05;
    assert.throws(() => ethereumAddressFromUncompressed(bad), /uncompressed/i);
  });
});

describe("localSignerFromPrivateKey", () => {
  it("preserves a passed-in createdAt", () => {
    const priv = secp256k1.utils.randomSecretKey();
    const ts = "2026-01-01T00:00:00.000Z";
    const s = localSignerFromPrivateKey(priv, ts);
    assert.equal(s.identity.createdAt, ts);
  });

  it("synthesises createdAt when omitted", () => {
    const priv = secp256k1.utils.randomSecretKey();
    const s = localSignerFromPrivateKey(priv);
    assert.match(s.identity.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("address is the keccak of the uncompressed pubkey tail (20 bytes)", () => {
    const priv = hexToBytes("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const s = localSignerFromPrivateKey(priv);
    // Anvil's deterministic test account #0 — known address.
    assert.equal(s.identity.address.toLowerCase(), "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
  });

  it("returns a 130-char (0x + 65 bytes) uncompressed publicKey", () => {
    const priv = secp256k1.utils.randomSecretKey();
    const s = localSignerFromPrivateKey(priv);
    assert.match(s.identity.publicKey, /^0x04[0-9a-f]{128}$/);
  });
});

describe("generateLocalSigner", () => {
  it("returns matching signer.identity.publicKey and the raw private key", () => {
    const { signer, privateKey } = generateLocalSigner();
    assert.equal(privateKey.length, 32);
    const expectedPub = "0x" + bytesToHex(secp256k1.getPublicKey(privateKey, false));
    assert.equal(signer.identity.publicKey, expectedPub);
  });

  it("two calls produce different private keys", () => {
    const a = generateLocalSigner();
    const b = generateLocalSigner();
    assert.notEqual(bytesToHex(a.privateKey), bytesToHex(b.privateKey));
  });
});

describe("local signer.sign", () => {
  it("rejects a digest of length != 32 in KMS path; works for any 32-byte digest in local path", async () => {
    const { signer } = generateLocalSigner();
    // Local signer is permissive on digest length (delegates to noble) but cosmic-binding always passes 32-byte.
    const digest = keccak_256(new TextEncoder().encode("anything"));
    const out = await signer.sign(digest);
    assert.equal(out.compactSig.length, 64);
    assert.ok(out.recoveryId === 0 || out.recoveryId === 1);
  });

  it("kmsSignerFromIdentity rejects a non-32-byte digest", async () => {
    const fakeSdk = {
      kms: {
        sign: async () => ({ data: { Signature: "0x" + "00".repeat(65) } }),
      },
    };
    const handle = kmsSignerFromIdentity(fakeSdk as never, {
      signerType: "kms",
      address: "0x" + "ab".repeat(20),
      publicKey: "0x04" + "00".repeat(64),
      keyId: "kms:test",
      createdAt: new Date().toISOString(),
    });
    await assert.rejects(handle.sign(new Uint8Array(31)), /32 bytes/);
    await assert.rejects(handle.sign(new Uint8Array(33)), /32 bytes/);
  });

  it("kmsSignerFromIdentity rejects a non-65-byte signature from the gateway", async () => {
    const fakeSdk = {
      kms: {
        sign: async () => ({ data: { Signature: "0x" + "00".repeat(63) } }),
      },
    };
    const handle = kmsSignerFromIdentity(fakeSdk as never, {
      signerType: "kms",
      address: "0x" + "ab".repeat(20),
      publicKey: "0x04" + "00".repeat(64),
      keyId: "kms:test",
      createdAt: new Date().toISOString(),
    });
    await assert.rejects(handle.sign(new Uint8Array(32)), /65 \(r\|\|s\|\|v\)/);
  });

  it("kmsSignerFromIdentity retries on transient SDK errors then succeeds", async () => {
    let calls = 0;
    const goodSig = "0x" + "11".repeat(64) + "1b";
    const fakeSdk = {
      kms: {
        sign: async () => {
          calls++;
          if (calls < 2) throw new Error("transient gateway 500");
          return { data: { Signature: goodSig } };
        },
      },
    };
    const handle = kmsSignerFromIdentity(fakeSdk as never, {
      signerType: "kms",
      address: "0x" + "ab".repeat(20),
      publicKey: "0x04" + "00".repeat(64),
      keyId: "kms:test",
      createdAt: new Date().toISOString(),
    });
    const out = await handle.sign(new Uint8Array(32));
    assert.equal(calls, 2, "should retry once after transient failure");
    assert.equal(out.compactSig.length, 64);
  });

  it("kmsSignerFromIdentity gives up after 3 attempts and surfaces the original error", async () => {
    let calls = 0;
    const fakeSdk = {
      kms: {
        sign: async () => {
          calls++;
          throw new Error("permanent gateway 500");
        },
      },
    };
    const handle = kmsSignerFromIdentity(fakeSdk as never, {
      signerType: "kms",
      address: "0x" + "ab".repeat(20),
      publicKey: "0x04" + "00".repeat(64),
      keyId: "kms:test",
      createdAt: new Date().toISOString(),
    });
    await assert.rejects(handle.sign(new Uint8Array(32)), /permanent gateway 500/);
    assert.equal(calls, 3);
  });

  it("kmsSignerFromIdentity decodes v in {27,28} → recoveryId in {0,1}", async () => {
    function makeFakeSig(v: number): string {
      return "0x" + "11".repeat(64) + v.toString(16).padStart(2, "0");
    }
    for (const [v, expected] of [[27, 0], [28, 1], [0, 0], [1, 1]]) {
      const fakeSdk = { kms: { sign: async () => ({ data: { Signature: makeFakeSig(v as number) } }) } };
      const handle = kmsSignerFromIdentity(fakeSdk as never, {
        signerType: "kms",
        address: "0x" + "ab".repeat(20),
        publicKey: "0x04" + "00".repeat(64),
        keyId: "kms:test",
        createdAt: new Date().toISOString(),
      });
      const out = await handle.sign(new Uint8Array(32));
      assert.equal(out.recoveryId, expected, `v=${v} should map to recoveryId=${expected}`);
    }
  });
});
