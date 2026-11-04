import { useEffect, useState } from "react";

export type BackendStatus = "checking" | "online" | "offline";

/**
 * Cheap health probe against the Supabase auth endpoint.
 *
 * The site can be deployed while its database is not configured yet (or paused):
 * in that case every sign-in/sign-up call fails with a network error. Detecting it
 * up-front lets the UI explain the real problem instead of showing a generic error.
 */
export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) {
      setStatus("offline");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: controller.signal,
    })
      .then((response) => setStatus(response.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"))
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return status;
}
