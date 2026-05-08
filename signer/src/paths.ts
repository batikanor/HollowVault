import { existsSync } from "node:fs";

export function defaultDataDir(): string {
  if (process.env.SIGNER_DATA_DIR) return process.env.SIGNER_DATA_DIR;
  if (existsSync("/app/data")) return "/app/data";
  return ".runtime";
}
