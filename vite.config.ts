import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Two build targets are supported:
 *
 * 1. `npm run build` — Cloudflare Workers (SSR via src/server.ts). Default.
 * 2. `npm run build:pages` — GitHub Pages / any static host. Sets
 *    `BUILD_TARGET=pages`, which disables the Cloudflare plugin and turns on
 *    TanStack Start SPA mode so the whole app is emitted as static assets.
 *
 * `VITE_BASE_PATH` must match the sub-path the site is served from
 * (e.g. `/amo-scans-fr/` on project pages) — it is also consumed by
 * `src/router.tsx` so client-side routing keeps working.
 */
const isPagesBuild = process.env.BUILD_TARGET === "pages";

// CI (GitHub Actions) may override the committed defaults at build time.
const siteUrl = process.env.VITE_SITE_URL;
const basePath = process.env.VITE_BASE_PATH;
// Short commit SHA of the deployed build; used by the in-app "new version" check.
const buildVersion =
  (process.env.GITHUB_SHA || process.env.BUILD_VERSION || "").slice(0, 7) || "dev";

export default defineConfig({
  // The Cloudflare plugin only makes sense for the SSR/worker build.
  cloudflare: isPagesBuild ? false : undefined,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
    server: { entry: "server" },
    ...(isPagesBuild ? { spa: { enabled: true } } : {}),
  },
  vite: {
    base: basePath ?? "/",
    define: {
      ...(siteUrl ? { "import.meta.env.VITE_SITE_URL": JSON.stringify(siteUrl) } : {}),
      ...(basePath ? { "import.meta.env.VITE_BASE_PATH": JSON.stringify(basePath) } : {}),
      "import.meta.env.VITE_BUILD_VERSION": JSON.stringify(buildVersion),
    },
    build: {
      // manhwa panels are large images; keep the warning threshold realistic
      chunkSizeWarningLimit: 900,
    },
  },
});
