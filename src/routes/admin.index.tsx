import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeriesRow } from "@/lib/queries";
import { formatDate, seriesStatusLabel } from "@/components/admin/series-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  component: AdminIndex,
});

type PublicationFilter = "all" | "live" | "draft" | "featured";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-surface/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function SeriesCard({ series }: { series: SeriesRow }) {
  const tags = series.tags ?? [];
  return (
    <Link
      to="/admin/series/$slug"
      params={{ slug: series.slug }}
      className="group overflow-hidden rounded-lg border border-neutral-800 bg-surface/50 transition hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-neutral-900">
        {series.cover_url ? (
          <img
            src={series.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-3xl font-semibold text-muted-foreground">
            {series.title.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              series.published
                ? "bg-accent/20 text-accent"
                : "bg-neutral-800 text-muted-foreground",
            )}
          >
            {series.published ? "Live" : "Draft"}
          </span>
          {series.featured ? (
            <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Featured
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5 p-3">
        <h2 className="truncate text-sm font-medium text-foreground transition group-hover:text-accent">
          {series.title}
        </h2>
        <p className="truncate text-xs text-muted-foreground">
          {series.genre ?? "No genre"} · {seriesStatusLabel(series.status)}
        </p>
        {tags.length > 0 ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {tags.slice(0, 3).join(" · ")}
            {tags.length > 3 ? ` +${tags.length - 3}` : ""}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">Updated {formatDate(series.updated_at)}</p>
      </div>
    </Link>
  );
}

function AdminIndex() {
  const { user, isAdmin, rolesLoading } = useAuth();
  const userId = user?.id;
  const [searchTerm, setSearchTerm] = useState("");
  const [publicationFilter, setPublicationFilter] = useState<PublicationFilter>("all");

  const {
    data: series = [],
    isPending,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "series", userId, isAdmin],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase.from("series").select("*").order("created_at", { ascending: false });
      if (!isAdmin) query = query.eq("author_id", userId);
      const { data, error: queryError } = await query;
      if (queryError) throw new Error(queryError.message);
      return data ?? [];
    },
    enabled: Boolean(userId) && !rolesLoading,
  });

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return series.filter((item) => {
      if (publicationFilter === "live" && !item.published) return false;
      if (publicationFilter === "draft" && item.published) return false;
      if (publicationFilter === "featured" && !item.featured) return false;
      if (!needle) return true;
      const haystack = [item.title, item.slug, item.genre ?? "", ...(item.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [series, publicationFilter, searchTerm]);

  const liveCount = series.filter((item) => item.published).length;
  const draftCount = series.length - liveCount;
  const hasFilters = searchTerm.trim().length > 0 || publicationFilter !== "all";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your series</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Every series across the studio" : "Series you author"}
            {!isPending ? ` · ${series.length} total` : null}
          </p>
        </div>
        <Button
          asChild
          className="h-9 bg-accent px-4 text-sm text-accent-foreground hover:bg-accent/90"
        >
          <Link to="/admin/series/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New series
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard label="Total" value={series.length} />
        <StatCard label="Live" value={liveCount} />
        <StatCard label="Drafts" value={draftCount} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by title, slug, genre or tag…"
            aria-label="Search series"
            className="h-9 border-neutral-800 bg-surface pl-9 pr-9 text-sm"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <Select
          value={publicationFilter}
          onValueChange={(value) => setPublicationFilter(value as PublicationFilter)}
        >
          <SelectTrigger
            aria-label="Filter by publication status"
            className="h-9 w-full border-neutral-800 bg-surface text-sm sm:w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-neutral-800 bg-surface">
            <SelectItem value="all">All series</SelectItem>
            <SelectItem value="live">Live only</SelectItem>
            <SelectItem value="draft">Drafts only</SelectItem>
            <SelectItem value="featured">Featured only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div
          className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-busy="true"
          aria-label="Loading your series"
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-neutral-800 bg-surface/40"
            >
              <Skeleton className="aspect-[2/3] w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <span>Could not load your series — {error.message}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Try again
          </Button>
        </div>
      ) : series.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-800 bg-surface/30 p-10 text-center sm:p-14">
          <h2 className="text-lg font-semibold text-foreground">No series yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Create your first series, upload a cover and start adding chapters. Everything stays a
            draft until you publish it.
          </p>
          <Button
            asChild
            className="mt-6 h-10 bg-accent px-5 text-sm text-accent-foreground hover:bg-accent/90"
          >
            <Link to="/admin/series/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create your first series
            </Link>
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-800 bg-surface/30 p-10 text-center">
          <h2 className="text-base font-medium text-foreground">No series match your filters</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different search term or reset the publication filter.
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setPublicationFilter("all");
              }}
              className="mt-4 text-sm text-accent transition hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <SeriesCard key={item.id} series={item} />
          ))}
        </div>
      )}
    </main>
  );
}
