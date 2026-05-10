import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";

const HAS_CREDS = !!(process.env.ORBITPORT_CLIENT_ID && process.env.ORBITPORT_CLIENT_SECRET);

if (!HAS_CREDS) {
  describe("KMS live integration (skipped — no credentials)", () => {
    it("requires ORBITPORT_CLIENT_ID + ORBITPORT_CLIENT_SECRET", { skip: true }, () => {});
  });
} else {
  let sdk: OrbitportSDK;
  let keyId: string;
  let address: string;

  before(async () => {
    sdk = new OrbitportSDK({
      config: {
        clientId: process.env.ORBITPORT_CLIENT_ID!,
        clientSecret: process.env.ORBITPORT_CLIENT_SECRET!,
      },
    });
  });

  after(async () => {
    if (keyId) console.log(`  (test left a KMS key behind: ${keyId})`);
  });

  describe("KMS live integration (requires credentials)", () => {
    it("creates an Ethereum secp256k1 key in Orbitport KMS", async () => {
      const stamp = Date.now();
      const created = await sdk.kms.createKey({
        alias: `cosmic-test-${stamp}`,
        keySpec: "ECC_SECG_P256K1",
        keyUsage: "SIGN_VERIFY",
        scheme: "ETHEREUM",
        description: "automated integration test",
        tags: [],
      });
      const md = created.data.KeyMetadata;
      keyId = md.KeyId;
      address = md.Address ?? "";
      assert.ok(keyId.startsWith("kms:"));
      assert.equal(address.length, 42);
      assert.ok(md.PublicKey?.startsWith("0x04"));
    });

    it("signs a 32-byte digest in DIGEST mode and returns 65 bytes (r || s || v)", async () => {
      const digest = new Uint8Array(32).fill(0x42);
      const signed = await sdk.kms.sign({
        keyId,
        message: digest,
        signingAlgorithm: "ETHEREUM_SECP256K1",
        messageType: "DIGEST",
      });
      const sigBytes = Buffer.from(signed.data.Signature.replace(/^0x/, ""), "hex");
      assert.equal(sigBytes.length, 65);
      const v = sigBytes[64];
      assert.ok(v === 0 || v === 1 || v === 27 || v === 28, `unexpected v byte: ${v}`);
    });

    it("cTRNG returns 32 bytes of fresh entropy on each call", async () => {
      const r1 = await sdk.ctrng.random();
      const r2 = await sdk.ctrng.random();
      const data1 = (r1.data as { data?: string }).data ?? "";
      const data2 = (r2.data as { data?: string }).data ?? "";
      assert.equal(data1.length, 64, "32 bytes hex");
      assert.equal(data2.length, 64);
      assert.notEqual(data1, data2, "consecutive cTRNG calls must produce different bytes");
    });
  });
}
