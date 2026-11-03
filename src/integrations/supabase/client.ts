// Supabase browser/SSR client.
//
// Values are injected at build time from the VITE_* variables (see .env.example)
// and fall back to process.env during SSR / Cloudflare Workers runtime.
// Only the *publishable* (anon) key belongs here — RLS enforces access control.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function readEnv(): { url?: string; key?: string } {
  const viteEnv = import.meta.env as Record<string, string | undefined>;
  const nodeEnv =
    typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};

  return {
    url: viteEnv.VITE_SUPABASE_URL || nodeEnv.SUPABASE_URL,
    key: viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY || nodeEnv.SUPABASE_PUBLISHABLE_KEY,
  };
}

function createSupabaseClient() {
  const { url, key } = readEnv();

  if (!url || !key) {
    const missing = [
      ...(!url ? ["VITE_SUPABASE_URL"] : []),
      ...(!key ? ["VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Supabase is not configured: missing ${missing.join(", ")}. Copy .env.example to .env and fill in your project URL + publishable key.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== "undefined",
    },
    global: {
      headers: { "x-application-name": "amo-scans-fr" },
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Lazily created so that importing this module never throws during build/SSR
// when environment variables are absent.
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
