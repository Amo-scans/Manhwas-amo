import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  LayoutGrid,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildPageMeta, canonicalLink } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: buildPageMeta({
      title: "Studio — AMO-SCANS-FR",
      description: "Manage your series, chapters and pages on AMO-SCANS-FR.",
      path: "/admin",
      noindex: true,
    }),
    links: [canonicalLink("/admin")],
  }),
  component: AdminLayout,
});

const navLinkClass = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    active
      ? "bg-neutral-800/70 text-foreground"
      : "text-muted-foreground hover:bg-neutral-800/40 hover:text-foreground",
  );

function AdminLoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <div className="border-b border-neutral-800/60 bg-surface/40">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-6">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-5xl px-6 py-10" aria-busy="true">
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {label}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-neutral-800 bg-surface/40 p-4"
            >
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function AccessDenied({
  email,
  retrying,
  signingOut,
  onRetry,
  onSignOut,
}: {
  email: string | null;
  retrying: boolean;
  signingOut: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <main className="mx-auto w-full max-w-md px-5 py-16 sm:py-20">
        <div className="rounded-2xl border border-neutral-800 bg-surface/50 p-6 text-center shadow-xl sm:p-8">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Access denied
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The studio is limited to <span className="font-medium text-accent">author</span> and{" "}
            <span className="font-medium text-accent">admin</span> accounts.
            {email ? (
              <>
                {" "}
                You're signed in as <span className="font-medium text-foreground">{email}</span>,
                which doesn't have that role yet.
              </>
            ) : null}{" "}
            Ask a site administrator to grant you access, then re-check below.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              type="button"
              onClick={onRetry}
              disabled={retrying || signingOut}
              className="h-10 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              {retrying ? "Checking access…" : "Re-check access"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSignOut}
              disabled={retrying || signingOut}
              className="h-10 border-neutral-800 bg-transparent text-foreground hover:bg-neutral-800/40"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
          <Link
            to="/"
            className="mt-6 inline-block text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            ← Back to library
          </Link>
        </div>
      </main>
    </div>
  );
}

function AdminLayout() {
  const { user, isAuthor, loading, rolesLoading, refreshRoles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
    }
  }, [loading, user, navigate]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshRoles();
    } finally {
      setRetrying(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate({ to: "/auth", replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  if (loading || !user) {
    return <AdminLoadingScreen label="Loading your studio…" />;
  }

  if (rolesLoading) {
    return <AdminLoadingScreen label="Checking your access…" />;
  }

  if (!isAuthor) {
    return (
      <AccessDenied
        email={user.email ?? null}
        retrying={retrying}
        signingOut={signingOut}
        onRetry={() => void handleRetry()}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  const isNewSeries = pathname === "/admin/series/new";
  const isSeriesActive =
    !isNewSeries &&
    (pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/series/"));

  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <div className="border-b border-neutral-800/60 bg-surface/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <nav aria-label="Studio navigation" className="flex items-center gap-1 overflow-x-auto">
            <Link
              to="/admin"
              className={navLinkClass(isSeriesActive)}
              aria-current={isSeriesActive ? "page" : undefined}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              Series
            </Link>
            <Link
              to="/admin/series/new"
              className={navLinkClass(isNewSeries)}
              aria-current={isNewSeries ? "page" : undefined}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New series
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View site
            </Link>
            <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground md:block">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="h-8 rounded-full border border-neutral-800 px-3 text-xs font-medium text-foreground transition hover:bg-neutral-800/40 disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
