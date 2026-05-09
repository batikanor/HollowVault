#!/usr/bin/env node
/**
 * Spawns one tiny static server per alt-UI on its own port. All five hit the
 * same signer (8080) and the same Next.js verifier API (4747). Pure Node, no
 * dependencies — uses the built-in http + fs modules.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(import.meta.url), "..");

const UIS = [
  { port: 5804, dir: "bloomberg",       label: "★ Bloomberg Agent Ops (MAIN)" },
  { port: 5801, dir: "mission-control", label: "  Mission Control" },
  { port: 5802, dir: "swiss",           label: "  Swiss / Editorial" },
  { port: 5803, dir: "glass",           label: "  Liquid Glass" },
  { port: 5805, dir: "brutalist",       label: "  Brutalist Newspaper" },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

function ext(p) { const i = p.lastIndexOf("."); return i === -1 ? "" : p.slice(i).toLowerCase(); }

function makeServer(port, dir, label) {
  const root = join(HERE, dir);
  const srv = createServer(async (req, res) => {
    let url = req.url || "/";
    url = url.split("?")[0];
    if (url === "/") url = "/index.html";
    // Path-traversal guard: normalize and ensure it stays under root.
    const filePath = normalize(join(root, url));
    if (!filePath.startsWith(root)) {
      res.writeHead(403); res.end("forbidden"); return;
    }
    try {
      const s = await stat(filePath);
      if (!s.isFile()) throw new Error("not a file");
      const data = await readFile(filePath);
      res.writeHead(200, {
        "content-type": MIME[ext(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  srv.listen(port, () => {
    console.log(`  · ${label.padEnd(28)} → http://localhost:${port}/`);
  });
  return srv;
}

console.log("\n  Hollow Vault — terminals");
console.log("  ─────────────────────────────────");
for (const ui of UIS) makeServer(ui.port, ui.dir, ui.label);
console.log("");
console.log("  signer (KMS · backend)        http://localhost:8080");
console.log("  cosmic-dark (Next.js · long-form pages)  http://localhost:4747");
console.log("");
console.log("  press Ctrl+C to stop all five.\n");
