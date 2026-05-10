import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runBrokenRngDemo, runSafeDemo } from "../web/lib/nonceAttack.js";

describe("broken-RNG ECDSA nonce-reuse exploit", () => {
  it("recovers the actual private key from two reused-nonce signatures", () => {
    const result = runBrokenRngDemo("transfer 100 USDC to Alice", "transfer 100 USDC to Bob");
    assert.equal(result.match, true, "broken-k path must recover the original private key");
    assert.equal(result.recoveredPrivateKey, result.privateKey);
    assert.equal(result.signatureA.r, result.signatureB.r, "reused nonce produces equal r");
  });

  it("does NOT recover the private key when each signature uses fresh entropy", () => {
    for (let trial = 0; trial < 5; trial++) {
      const result = runSafeDemo(`message ${trial}-A`, `message ${trial}-B`);
      assert.equal(result.match, false, "safe path must NOT yield the real private key");
      assert.notEqual(result.signatureA.r, result.signatureB.r, "different nonces produce different r");
    }
  });
});
