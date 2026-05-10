import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAlias } from "../signer/src/agents.js";

const KMS_ALIAS_REGEX = /^[A-Za-z0-9_-]+$/;

describe("sanitizeAlias — KMS-compatible identifiers", () => {
  it("preserves a clean ASCII name", () => {
    assert.equal(sanitizeAlias("Treasury"), "Treasury");
  });

  it("converts spaces to single hyphens", () => {
    assert.equal(sanitizeAlias("Trading Desk Alpha"), "Trading-Desk-Alpha");
  });

  it("collapses runs of non-ASCII to a single hyphen", () => {
    const out = sanitizeAlias("Müncheñ ✨ trader");
    assert.match(out, KMS_ALIAS_REGEX);
    assert.ok(!out.includes("--"));
  });

  it("strips leading and trailing hyphens", () => {
    assert.equal(sanitizeAlias("---a---b---"), "a-b");
  });

  it("returns 'agent' for an empty string", () => {
    assert.equal(sanitizeAlias(""), "agent");
  });

  it("returns 'agent' for an all-non-ASCII input", () => {
    assert.equal(sanitizeAlias("✨🌟🚀"), "agent");
  });

  it("clamps to 24 characters", () => {
    const out = sanitizeAlias("A".repeat(100));
    assert.equal(out.length, 24);
  });

  it("never produces a string containing characters KMS rejects", () => {
    const samples = [
      "Hello, world!",
      "a/b\\c.d",
      "with\"quotes\"and'singles'",
      "tabs\tand\nnewlines",
      "中文字符",
      "🎉 emoji-name",
    ];
    for (const s of samples) {
      const out = sanitizeAlias(s);
      assert.match(out, KMS_ALIAS_REGEX, `failed on input: ${JSON.stringify(s)}`);
      assert.ok(out.length > 0);
      assert.ok(out.length <= 24);
    }
  });

  it("is idempotent — sanitize(sanitize(x)) === sanitize(x)", () => {
    const samples = ["Treasury", "Trading Desk", "✨", "weird name 123!"];
    for (const s of samples) {
      const once = sanitizeAlias(s);
      const twice = sanitizeAlias(once);
      assert.equal(twice, once);
    }
  });
});
