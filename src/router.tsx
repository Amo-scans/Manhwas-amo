import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createQueryClient } from "@/lib/query-client";

/**
 * Vite's `BASE_URL` mirrors the configured `base`:
 *   - "/" on the Cloudflare/SSR deployment and on user/organisation Pages,
 *   - "/amo-scans-fr/" on a GitHub Pages *project* site.
 * TanStack Router needs it as a `basepath` so `<Link>` and the history work
 * behind that sub-path instead of escaping to the domain root.
 */
function getBasePath(): string | undefined {
  const baseUrl = (import.meta.env.BASE_URL as string | undefined) ?? "/";
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized === "" ? undefined : normalized;
}

export const getRouter = () => {
  const queryClient = createQueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    basepath: getBasePath(),
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
