#!/usr/bin/env node
/**
 * Build the app for a static host (GitHub Pages, Netlify, S3, ...).
 *
 * Steps:
 *  1. load `.env*` files into process.env (only when not already defined) so the
 *     public Supabase URL/key and the Pages base path are available at build time;
 *  2. run `vite build` with BUILD_TARGET=pages (SPA mode, Cloudflare plugin off);
 *  3. post-process `dist/client`: SPA fallbacks (index.html / 404.html),
 *     `.nojekyll`, `robots.txt`, `sitemap.xml`.
 *
 * Env:
 *   VITE_BASE_PATH  sub-path the site is served from ("/" or "/amo-scans-fr/")
 *   VITE_SITE_URL   absolute public origin, e.g. https://user.github.io/amo-scans-fr
 *   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (or the VITE_* variants) for the sitemap
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "dist", "client");

const initialEnv = new Set(Object.keys(process.env));

/** Minimal dotenv parser: KEY=VALUE, ignores comments and blank lines. */
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

/** Highest priority first â€” mirrors Vite's own env file precedence. */
function loadEnvFiles() {
  const files = [".env.production.local", ".env.production", ".env.local", ".env"];
  const merged = {};
  for (const file of files) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    Object.assign(merged, parseEnvFile(full));
  }
  for (const [key, value] of Object.entries(merged)) {
    if (!initialEnv.has(key) && process.env[key] === undefined) process.env[key] = value;
  }
}

function normalizeBase(input) {
  const base = (input || "/").trim();
  const withLeading = base.startsWith("/") ? base : `/${base}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

function normalizeSiteUrl(input, base) {
  const fallback = `https://example.github.io${base === "/" ? "" : base.replace(/\/$/, "")}`;
  const value = (input || fallback).trim();
  return value.replace(/\/+$/, "");
}

function writeIfChanged(file, content) {
  const full = path.join(clientDir, file);
  const previous = existsSync(full) ? readFileSync(full, "utf8") : null;
  if (previous === content) return false;
  writeFileSync(full, content, "utf8");
  return true;
}

async function fetchSitemapEntries(siteUrl) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Paths are relative to the deployed site root: `siteUrl` already contains the
  // GitHub Pages sub-path (e.g. https://user.github.io/amo-scans-fr).
  const entries = [
    { path: "/", priority: "1.0", changefreq: "daily" },
    { path: "/schedule", priority: "0.5", changefreq: "weekly" },
    { path: "/about", priority: "0.3", changefreq: "monthly" },
  ];

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[pages] Supabase env missing â€” sitemap limited to static routes.");
    return entries;
  }

  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  try {
    const seriesResponse = await fetch(
      `${supabaseUrl}/rest/v1/series?select=id,slug,updated_at&published=eq.true&order=updated_at.desc`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    if (!seriesResponse.ok) {
      throw new Error(`series HTTP ${seriesResponse.status}`);
    }
    const series = await seriesResponse.json();

    for (const item of series) {
      entries.push({
        path: `/series/${item.slug}`,
        lastmod: item.updated_at,
        priority: "0.8",
        changefreq: "weekly",
      });

      const chaptersResponse = await fetch(
        `${supabaseUrl}/rest/v1/chapters?select=number,created_at&series_id=eq.${encodeURIComponent(
          item.id,
        )}&published=eq.true`,
        { headers, signal: AbortSignal.timeout(15_000) },
      );
      if (!chaptersResponse.ok) continue;
      const chapters = await chaptersResponse.json();
      for (const chapter of chapters) {
        entries.push({
          path: `/read/${item.slug}/${chapter.number}`,
          lastmod: chapter.created_at,
          priority: "0.6",
          changefreq: "monthly",
        });
      }
    }
  } catch (error) {
    console.warn(`[pages] sitemap: Supabase unreachable (${error.message}). Static routes only.`);
  }

  return entries;
}

function renderSitemap(entries, siteUrl) {
  const urls = entries.map((entry) =>
    [
      "  <url>",
      `    <loc>${siteUrl}${entry.path}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

async function main() {
  loadEnvFiles();

  const base = normalizeBase(process.env.VITE_BASE_PATH);
  const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL, base);
  process.env.VITE_BASE_PATH = base;
  process.env.VITE_SITE_URL = siteUrl;

  rmSync(path.join(root, "dist"), { recursive: true, force: true });

  console.log(`[pages] building static SPA (base=${base}, site=${siteUrl})`);
  const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteBin)) {
    console.error("[pages] vite not installed â€” run `npm install` first.");
    process.exit(1);
  }
  const build = spawnSync(process.execPath, [viteBin, "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "pages", VITE_BASE_PATH: base, VITE_SITE_URL: siteUrl },
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  const shellPath = path.join(clientDir, "_shell.html");
  if (!existsSync(shellPath)) {
    console.error(`[pages] expected SPA shell at ${shellPath} â€” did SPA mode change?`);
    process.exit(1);
  }

  // GitHub Pages has no SPA rewrite: serve the shell for "/" and for unknown paths.
  copyFileSync(shellPath, path.join(clientDir, "index.html"));
  copyFileSync(shellPath, path.join(clientDir, "404.html"));
  rmSync(shellPath, { force: true });
  rmSync(path.join(clientDir, ".assetsignore"), { force: true });
  writeFileSync(path.join(clientDir, ".nojekyll"), "", "utf8");

  const sitemap = renderSitemap(await fetchSitemapEntries(siteUrl), siteUrl);
  writeIfChanged("sitemap.xml", sitemap);

  // Lets an open tab notice that a newer build was deployed and offer a reload.
  const buildVersion = (process.env.GITHUB_SHA || process.env.BUILD_VERSION || "").slice(0, 7);
  writeIfChanged(
    "version.json",
    `${JSON.stringify(
      { version: buildVersion || "dev", builtAt: new Date().toISOString() },
      null,
      2,
    )}\n`,
  );
  writeIfChanged(
    "robots.txt",
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /auth",
      "",
      `Sitemap: ${siteUrl}/sitemap.xml`,
      "",
    ].join("\n"),
  );

  console.log("[pages] done â†’ dist/client");
  console.log(`[pages] preview: npm run preview:pages   (or open ${siteUrl})`);
}

await main();
