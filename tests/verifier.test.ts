import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  generateLocalSigner,
  getCosmicEntropy,
  signAttestation,
  type Attestation,
  type SignerHandle,
} from "@hollow-vault/core";
import { verifyAttestation } from "../web/lib/verify.js";

process.env.ORBITPORT_MODE = "mock";

let signer: SignerHandle;
let validAttestation: Attestation;

function clone(att: Attestation): Attestation {
  return JSON.parse(JSON.stringify(att));
}

before(async () => {
  signer = generateLocalSigner().signer;
  const cosmic = await getCosmicEntropy();
  validAttestation = await signAttestation(signer, "valid message", cosmic);
});

describe("verifier — happy path", () => {
  it("returns ok=true for a freshly signed attestation", () => {
    const report = verifyAttestation(validAttestation);
    assert.equal(report.ok, true);
    assert.equal(report.steps.length, 5);
    for (const step of report.steps) {
      assert.equal(step.ok, true, `step "${step.label}" should pass`);
    }
  });
});

describe("verifier — tampering rejections", () => {
  it("rejects when the message is changed but the messageHash is not", () => {
    const tampered = clone(validAttestation);
    tampered.message = "I'm a different message that wasn't signed";
    const report = verifyAttestation(tampered);
    assert.equal(report.ok, false);
    const messageHashStep = report.steps.find((s) => s.id === "msg-hash");
    assert.equal(messageHashStep?.ok, false);
  });

  it("rejects when the satellite signature is corrupted", () => {
    const tampered = clone(validAttestation);
    const flippedSig = tampered.cosmic.satelliteSignature.split("");
    flippedSig[10] = flippedSig[10] === "0" ? "1" : "0";
    tampered.cosmic.satelliteSignature = flippedSig.join("");
    const report = verifyAttestation(tampered);
    assert.equal(report.ok, false);
    const satStep = report.steps.find((s) => s.id === "sat-sig");
    assert.equal(satStep?.ok, false);
  });

  it("rejects when the cosmic seed is replaced after signing", () => {
    const tampered = clone(validAttestation);
    const fakeSeed = "0".repeat(64);
    tampered.cosmic.seed = fakeSeed;
    const report = verifyAttestation(tampered);
    assert.equal(report.ok, false);
    const bindingStep = report.steps.find((s) => s.id === "binding");
    assert.equal(bindingStep?.ok, false);
  });

  it("rejects when the ECDSA signature is corrupted", () => {
    const tampered = clone(validAttestation);
    const sigChars = tampered.signature.split("");
    sigChars[20] = sigChars[20] === "0" ? "1" : "0";
    tampered.signature = sigChars.join("");
    const report = verifyAttestation(tampered);
    assert.equal(report.ok, false);
    const ecdsaStep = report.steps.find((s) => s.id === "ecdsa");
    assert.equal(ecdsaStep?.ok, false);
  });

  it("rejects when the timestamp is far in the past", () => {
    const tampered = clone(validAttestation);
    tampered.cosmic.timestamp = "2020-01-01T00:00:00.000Z";
    const report = verifyAttestation(tampered);
    const freshStep = report.steps.find((s) => s.id === "fresh");
    assert.equal(freshStep?.ok, false);
  });

  it("rejects when the claimed signer address differs from recovery", () => {
    const tampered = clone(validAttestation);
    tampered.signerAddress = "0x" + "1".repeat(40);
    const report = verifyAttestation(tampered);
    const ecdsaStep = report.steps.find((s) => s.id === "ecdsa");
    assert.equal(ecdsaStep?.ok, false);
  });
});
