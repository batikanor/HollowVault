/**
 * Shared helpers for the e2e suites. Pure ESM, zero deps beyond what
 * Node 22 + the @noble packages already give us.
 */

export const BASE_URL = (process.env.HOLLOW_VAULT_URL ?? "https://hollow-vault.vercel.app").replace(/\/$/, "");

export async function getJSON(path) {
  const res = await fetch(BASE_URL + path, { cache: "no-store" });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`expected JSON from GET ${path}, got ${ct} (${res.status}): ${body}`);
  }
  return { status: res.status, body: await res.json() };
}

export async function postJSON(path, payload) {
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`expected JSON from POST ${path}, got ${ct} (${res.status}): ${body}`);
  }
  return { status: res.status, body: await res.json() };
}

export async function getText(path) {
  const res = await fetch(BASE_URL + path, { cache: "no-store" });
  return { status: res.status, body: await res.text() };
}

export async function head(path) {
  const res = await fetch(BASE_URL + path, { method: "HEAD", cache: "no-store" });
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function flipHexBit(hex, charIndex = 4) {
  const chars = hex.split("");
  // hex chars only — flip 0↔1 to keep the string a valid hex
  chars[charIndex] = chars[charIndex] === "0" ? "1" : "0";
  return chars.join("");
}
