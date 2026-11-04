import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { useAppUpdate } from "@/hooks/use-app-update";
import { Toaster } from "sonner";
import { SITE_DESCRIPTION, SITE_NAME, buildPageMeta } from "@/lib/seo";

const BASE_URL = (import.meta.env.BASE_URL as string | undefined) ?? "/";

/** Public asset href that keeps working behind a GitHub Pages sub-path. */
function asset(file: string): string {
  return `${BASE_URL}${file.replace(/^\/+/, "")}`;
}

const DEFAULT_TITLE = `${SITE_NAME} — Original Manhwa`;
const DEFAULT_DESCRIPTION = SITE_DESCRIPTION;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Back to library
          </Link>
          <Link
            to="/schedule"
            className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-800 bg-surface px-5 text-sm font-medium text-foreground transition hover:bg-neutral-800/40"
          >
            Release schedule
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Something broke
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          This page did not load
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          An unexpected error occurred. If a network request failed, the site may be temporarily
          unable to reach its database. Try again, or head back to the library.
        </p>
        {import.meta.env.DEV && error.message ? (
          <p className="mt-4 break-words rounded-md border border-neutral-800 bg-surface p-3 text-left font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-800 bg-surface px-5 text-sm font-medium text-foreground transition hover:bg-neutral-800/40"
          >
            Back to library
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "color-scheme", content: "dark" },
      { name: "theme-color", content: "#0b0b0f" },
      ...buildPageMeta({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        path: "/",
      }),
    ],
    links: [
      { rel: "icon", href: asset("favicon.svg"), type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: asset("apple-touch-icon.png") },
      { rel: "manifest", href: asset("site.webmanifest") },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_NAME,
          url: "/",
          description: "Independent studio publishing original manhwa webcomics.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const updateAvailable = useAppUpdate();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" position="top-center" richColors closeButton />
        {updateAvailable ? (
          <div
            role="status"
            className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-lg"
          >
            A new version of the site is available.
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-wider transition hover:bg-black/40"
            >
              Reload
            </button>
          </div>
        ) : null}
      </AuthProvider>
    </QueryClientProvider>
  );
}
