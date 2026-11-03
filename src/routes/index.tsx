import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SeriesCard, SeriesCardSkeleton, SeriesStatusBadge } from "@/components/series-card";
import { LatestReleaseCard, LatestReleaseSkeleton } from "@/components/latest-releases";
import { ErrorState, EmptyState } from "@/components/query-states";
import { formatRelativeDate } from "@/components/relative-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chaptersQueryOptions,
  featuredSeriesQueryOptions,
  LATEST_RELEASES_LIMIT,
  latestChaptersQueryOptions,
  publicImageUrl,
  seriesListQueryOptions,
} from "@/lib/queries";
import {
  absoluteUrl,
  buildPageMeta,
  canonicalLink,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

const LIBRARY_SKELETON_COUNT = 10;
const LATEST_SKELETON_COUNT = 4;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: buildPageMeta({
      title: `${SITE_NAME} — Original Manhwa`,
      description: SITE_DESCRIPTION,
      path: "/",
    }),
    links: [canonicalLink("/")],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: absoluteUrl("/"),
          description: SITE_DESCRIPTION,
          inLanguage: "en",
          publisher: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
          },
        }),
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <main id="main-content">
        <FeaturedHero />
        <LatestReleases />
        <Library />
      </main>
      <SiteFooter />
    </div>
  );
}

function FeaturedHero() {
  const featuredQuery = useQuery(featuredSeriesQueryOptions());
  const featured = featuredQuery.data ?? null;
  const chaptersQuery = useQuery(chaptersQueryOptions(featured?.id, true));
  const latestChapter = chaptersQuery.data?.[0] ?? null;
  const heroSrc = featured?.hero_url
    ? publicImageUrl(featured.hero_url)
    : featured?.cover_url
      ? publicImageUrl(featured.cover_url)
      : null;

  if (featuredQuery.isLoading) {
    return (
      <section aria-hidden="true" className="border-b border-neutral-800/60 bg-surface/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-24 md:pb-16">
          <Skeleton className="h-4 w-28 bg-surface" />
          <Skeleton className="mt-4 h-12 w-3/4 max-w-xl bg-surface" />
          <Skeleton className="mt-5 h-4 w-full max-w-lg bg-surface" />
          <Skeleton className="mt-2 h-4 w-2/3 max-w-md bg-surface" />
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-10 w-36 bg-surface" />
            <Skeleton className="h-10 w-36 bg-surface" />
          </div>
        </div>
      </section>
    );
  }

  if (featuredQuery.isError) {
    return (
      <section className="border-b border-neutral-800/60 px-6 py-10">
        <ErrorState
          className="mx-auto max-w-3xl"
          title="Featured series unavailable"
          message="We could not load today's featured series. The library below is still available."
          onRetry={() => {
            void featuredQuery.refetch();
          }}
        />
      </section>
    );
  }

  if (!featured) {
    return (
      <section className="border-b border-neutral-800/60 bg-surface/20">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center md:py-28">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            Independent studio
          </p>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
            Original manhwa. Vertical. Unhurried.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground">
            A new spotlight series is being prepared — until then, the whole library is open below.
            Vertical scroll, original stories, no paywall.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <a href="#library-heading">
                Browse the library <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-neutral-800 bg-base/60 text-foreground hover:bg-surface"
            >
              <Link to="/about">About the studio</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const tags = (featured.tags ?? []).filter(Boolean).slice(0, 4);

  return (
    <section
      aria-labelledby="featured-heading"
      className="relative isolate overflow-hidden border-b border-neutral-800/60"
    >
      {heroSrc ? (
        <img
          src={heroSrc}
          alt={`${featured.title} key art`}
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-70"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-base to-base"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-base via-base/60 to-base/10"
      />

      <div className="mx-auto flex min-h-[440px] max-w-7xl flex-col justify-end px-6 pb-12 pt-24 md:min-h-[560px] md:pb-16">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-base/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent backdrop-blur-sm">
            <Sparkles aria-hidden="true" className="h-3 w-3" />
            Featured original
          </span>
          <SeriesStatusBadge status={featured.status} />
          {featured.genre ? (
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {featured.genre}
            </span>
          ) : null}
        </div>

        <h1
          id="featured-heading"
          className="mt-5 max-w-[20ch] text-balance font-display text-4xl font-semibold leading-none tracking-tight text-foreground md:text-6xl"
        >
          {featured.title}
        </h1>

        {featured.synopsis ? (
          <p className="mt-5 max-w-[52ch] text-pretty leading-relaxed text-muted-foreground">
            {featured.synopsis}
          </p>
        ) : null}

        {tags.length > 0 || latestChapter ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
            {latestChapter ? (
              <span className="text-muted-foreground/80">
                Latest chapter {formatRelativeDate(latestChapter.created_at)}
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <Link to="/series/$slug" params={{ slug: featured.slug }}>
              Read series <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          {latestChapter ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-neutral-700 bg-base/60 text-foreground backdrop-blur hover:bg-neutral-800/60"
            >
              <Link
                to="/read/$slug/$ep"
                params={{ slug: featured.slug, ep: String(latestChapter.number) }}
              >
                Latest — Ch. {latestChapter.number}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LatestReleases() {
  const latestQuery = useQuery(latestChaptersQueryOptions(LATEST_RELEASES_LIMIT));
  const releases = latestQuery.data ?? [];

  return (
    <section
      aria-labelledby="latest-heading"
      className="border-b border-neutral-800/60 py-14 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              Fresh drops
            </p>
            <h2
              id="latest-heading"
              className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
            >
              Latest releases
            </h2>
          </div>
          <Link
            to="/schedule"
            className="inline-flex items-center gap-1.5 rounded-sm text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            Release schedule <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </header>

        {latestQuery.isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading latest releases"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {Array.from({ length: LATEST_SKELETON_COUNT }, (_, index) => (
              <LatestReleaseSkeleton key={index} />
            ))}
          </div>
        ) : latestQuery.isError ? (
          <ErrorState
            title="Latest releases couldn't load"
            message="The newest chapters are unavailable right now."
            onRetry={() => {
              void latestQuery.refetch();
            }}
          />
        ) : releases.length === 0 ? (
          <EmptyState
            title="No releases yet"
            message="The first chapters are being prepared. Check the schedule for upcoming drops."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {releases.map((release) => (
              <LatestReleaseCard key={release.id} release={release} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Library() {
  const seriesQuery = useQuery(seriesListQueryOptions());
  const [search, setSearch] = useState("");

  const allSeries = useMemo(() => seriesQuery.data ?? [], [seriesQuery.data]);
  const filteredSeries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allSeries;
    return allSeries.filter((series) =>
      [series.title, series.genre ?? "", series.status, ...(series.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [allSeries, search]);

  return (
    <section aria-labelledby="library-heading" className="py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              The library
            </p>
            <h2
              id="library-heading"
              className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
            >
              All series
            </h2>
            {!seriesQuery.isLoading ? (
              <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                {filteredSeries.length} of {allSeries.length} series
                {search.trim() ? ` matching “${search.trim()}”` : ""}
              </p>
            ) : null}
          </div>

          <div className="relative w-full md:w-80">
            <label htmlFor="series-search" className="sr-only">
              Search series by title, genre or tag
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="series-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, genre or tag"
              className="h-10 border-neutral-800 bg-surface/60 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-accent"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {seriesQuery.isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading the library"
            className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {Array.from({ length: LIBRARY_SKELETON_COUNT }, (_, index) => (
              <SeriesCardSkeleton key={index} />
            ))}
          </div>
        ) : seriesQuery.isError ? (
          <ErrorState
            title="The library couldn't load"
            message="We could not reach the catalogue. Please try again."
            onRetry={() => {
              void seriesQuery.refetch();
            }}
          />
        ) : allSeries.length === 0 ? (
          <EmptyState
            title="The library is empty"
            message="No series have been published yet. The studio is working on the first episodes."
            action={
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
              >
                <Link to="/about">About the studio</Link>
              </Button>
            }
          />
        ) : filteredSeries.length === 0 ? (
          <EmptyState
            title="No series match your search"
            message={`Nothing matches “${search.trim()}”. Try a genre such as fantasy, romance or action.`}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSearch("")}
                className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
              >
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredSeries.map((series, index) => (
              <SeriesCard key={series.id} series={series} priority={index < 5} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
