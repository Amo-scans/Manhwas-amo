import { QueryClient } from "@tanstack/react-query";

/** Errors that will never succeed on retry (RLS / auth / bad request). */
const NON_RETRYABLE = /PGRST|JWT|permission denied|invalid api key|row-level security/i;

/**
 * One factory shared by the browser and the SSR entry so both sides use the
 * same cache policy (a fresh client is created per request during SSR).
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Content changes at a human pace; avoid hammering Supabase.
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (NON_RETRYABLE.test(message)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
