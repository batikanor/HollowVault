import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashTypedData, recoverAddress } from "viem";
import { BASE_URL, postJSON } from "../runner.mjs";

const TYPED = {
  domain: { name: "Hollow Vault E2E", version: "1", chainId: 1 },
  types: {
    Vote: [
      { name: "proposal", type: "string" },
      { name: "support", type: "bool" },
      { name: "voter", type: "address" },
    ],
  },
  primaryType: "Vote",
  message: {
    proposal: "P-42 — deploy on Base",
    support: true,
    voter: "0x6a8ae891b034a56940c5528c42350fd8a9ca8004",
  },
};

describe(`[e2e] /api/sign-typed @ ${BASE_URL}`, () => {
  it("returns a typed attestation whose eip712Digest matches viem.hashTypedData", async () => {
    const { status, body } = await postJSON("/api/sign-typed", TYPED);
    assert.equal(status, 200);
    const viemDigest = hashTypedData({
      domain: TYPED.domain,
      types: TYPED.types,
      primaryType: TYPED.primaryType,
      message: TYPED.message,
    });
    assert.equal(body.eip712Digest.toLowerCase(), viemDigest.toLowerCase());
    assert.equal(body.meta.scheme, "hollow-vault-typed/v1");
  });

  it("recovers to the gateway's address using the standard EIP-712 path", async () => {
    const { body } = await postJSON("/api/sign-typed", TYPED);
    const r = body.signature.slice(2, 66);
    const s = body.signature.slice(66, 130);
    const v = (body.recoveryId + 27).toString(16).padStart(2, "0");
    const recovered = await recoverAddress({
      hash: body.payloadHash,
      signature: `0x${r}${s}${v}`,
    });
    assert.equal(recovered.toLowerCase(), body.signerAddress.toLowerCase());
  });

  it("malformed body → 400 (zod validation)", async () => {
    const { status, body } = await postJSON("/api/sign-typed", { domain: "not-an-object" });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid request");
  });
});
