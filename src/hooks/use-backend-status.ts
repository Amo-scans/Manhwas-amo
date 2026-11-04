import { useEffect, useState } from "react";

export type BackendStatus = "checking" | "online" | "offline";

export type AuthHealth = {
  /** Whether the Supabase auth API answers at all. */
  status: BackendStatus;
  /** Email/password provider enabled in the Supabase project. */
  emailEnabled: boolean;
  /** Google OAuth provider enabled in the Supabase project (needs Google Cloud credentials). */
  googleEnabled: boolean;
};

const OFFLINE: AuthHealth = { status: "offline", emailEnabled: false, googleEnabled: false };

/**
 * Reads the Supabase auth settings once per page load.
 *
 * - `status: "offline"` when the project is missing, paused or unreachable → the
 *   sign-in page explains that the database is not connected instead of failing.
 * - `googleEnabled` drives the visibility of the "Continue with Google" button: an
 *   OAuth provider that is not configured in Supabase can only fail, so we do not
 *   offer it. Enabling the provider in Supabase makes the button appear on the next
 *   page load — no redeploy required.
 */
export function useAuthHealth(): AuthHealth {
  const [health, setHealth] = useState<AuthHealth>({
    status: "checking",
    emailEnabled: false,
    googleEnabled: false,
  });

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) {
      setHealth(OFFLINE);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setHealth(OFFLINE);
          return;
        }
        const payload = (await response.json()) as { external?: Record<string, boolean> };
        setHealth({
          status: "online",
          emailEnabled: payload.external?.email === true,
          googleEnabled: payload.external?.google === true,
        });
      })
      .catch(() => setHealth(OFFLINE))
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return health;
}
