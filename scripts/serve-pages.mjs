#!/usr/bin/env node
/**
 * Local preview of the static GitHub Pages build (`npm run build:pages`).
 *
 * Reproduces GitHub Pages behaviour: files are served under the configured base
 * path and unknown paths fall back to `404.html` (which is the SPA shell).
 *
 * Usage: node scripts/serve-pages.mjs [--port 4173]
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "dist", "client");

/** Minimal dotenv parser, so `npm run preview:pages` finds the Pages base path. */
function parseEnvFile(file) {
  const values = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function loadEnvFiles() {
  const merged = {};
  for (const file of [".env.production.local", ".env.production", ".env.local", ".env"]) {
    const full = path.join(root, file);
    if (existsSync(full)) Object.assign(merged, parseEnvFile(full));
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFiles();

const portArgIndex = process.argv.indexOf("--port");
const port =
  portArgIndex >= 0 && process.argv[portArgIndex + 1]
    ? Number(process.argv[portArgIndex + 1])
    : 4173;

const rawBase = process.env.VITE_BASE_PATH || "/";
const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function sendFile(res, filePath, status = 200) {
  const type = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(status, {
    "content-type": type,
    "cache-control": filePath.endsWith(".html") ? "no-store" : "public, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
}

if (!existsSync(path.join(clientDir, "index.html"))) {
  console.error("[preview] dist/client/index.html missing — run `npm run build:pages` first.");
  process.exit(1);
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (!requestUrl.pathname.startsWith(base)) {
    res.writeHead(302, { location: base });
    res.end();
    return;
  }

  let relative = decodeURIComponent(requestUrl.pathname.slice(base.length));
  if (relative === "" || relative.endsWith("/")) {
    relative = `${relative}index.html`;
  }
  const candidate = path.join(clientDir, relative);

  // Directory traversal guard.
  if (!candidate.startsWith(clientDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    sendFile(res, candidate);
    return;
  }

  // Extension-less route → SPA shell, with the same 404 status GitHub Pages uses.
  const fallback = path.join(clientDir, "404.html");
  if (existsSync(fallback) && !path.extname(relative)) {
    sendFile(res, fallback, 404);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(port, () => {
  console.log(`[preview] static build served at http://localhost:${port}${base}`);
  console.log("[preview] deep links fall back to 404.html (status 404) — same as GitHub Pages");
});
