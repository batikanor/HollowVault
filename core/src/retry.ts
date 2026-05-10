/**
 * Retry transient failures with linear backoff. Used to absorb the
 * occasional Orbitport gateway 5xx so a single unlucky tick doesn't
 * surface to end users as `/api/sign` 500.
 *
 * Defaults: 3 attempts at 200ms / 400ms / 600ms. Last error is rethrown
 * unchanged so callers see the original stack.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 200,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
