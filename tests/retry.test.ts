import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "@hollow-vault/core";

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls += 1;
      return 42;
    });
    assert.equal(out, 42);
    assert.equal(calls, 1);
  });

  it("retries until success and returns the resolved value", async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw new Error(`flake ${calls}`);
      return "ok";
    });
    assert.equal(out, "ok");
    assert.equal(calls, 3);
  });

  it("rethrows the last error after exhausting attempts", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        throw new Error("permanent");
      }),
      /permanent/,
    );
    assert.equal(calls, 3);
  });

  it("respects the configured attempts count", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("nope");
        },
        5,
        10,
      ),
      /nope/,
    );
    assert.equal(calls, 5);
  });

  it("backs off linearly between attempts (200ms / 400ms baseline)", async () => {
    const startedAt = Date.now();
    let calls = 0;
    try {
      await withRetry(async () => {
        calls += 1;
        throw new Error("boom");
      }, 3, 100);
    } catch { /* expected */ }
    const elapsed = Date.now() - startedAt;
    // Two waits of 100ms + 200ms = 300ms minimum.
    assert.ok(elapsed >= 280, `elapsed ${elapsed}ms should be ≥ 280ms`);
    assert.equal(calls, 3);
  });
});
