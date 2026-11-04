import { useEffect, useState } from "react";

/** Short commit SHA baked into the bundle at build time (or "dev" locally). */
export const BUILD_VERSION = (import.meta.env.VITE_BUILD_VERSION as string | undefined) ?? "dev";

/**
 * Detects that a newer build has been deployed while the tab stayed open.
 *
 * GitHub Pages caches `index.html` and a single-page app keeps running the JS it
 * loaded, so a visitor can keep using a stale build for hours (wrong API URL,
 * missing fixes). Each build publishes `version.json`; we compare it on focus and
 * every few minutes and offer a reload.
 */
export function useAppUpdate(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (BUILD_VERSION === "dev") return;

    let cancelled = false;
    const base = (import.meta.env.BASE_URL as string | undefined) ?? "/";

    const check = async () => {
      try {
        const response = await fetch(`${base}version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { version?: string };
        if (!cancelled && payload.version && payload.version !== BUILD_VERSION) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or blocked: silently retry later.
      }
    };

    void check();
    const timer = window.setInterval(check, 5 * 60 * 1000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return updateAvailable;
}
