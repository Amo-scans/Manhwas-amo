import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CalendarDays, Hash, Play } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ChapterList } from "@/components/chapter-list";
import { ErrorState } from "@/components/query-states";
import { formatRelativeDate } from "@/components/relative-date";
import { SeriesStatusBadge } from "@/components/series-card";
import { useLastRead } from "@/components/use-last-read";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chaptersQueryOptions,
  publicImageUrl,
  seriesBySlugQueryOptions,
  type SeriesRow,
} from "@/lib/queries";
import {
  absoluteUrl,
  buildPageMeta,
  canonicalLink,
  humanizeSlug,
  SITE_NAME,
  SITE_URL,
  socialImageUrl,
} from "@/lib/seo";

export const Route = createFileRoute("/series/$slug")({
  loader: async ({ context, params }) => {
    // The loader feeds SEO (title, canonical, noindex for missing series).
    // A failed fetch must not kill the page: the component owns the error UI.
    const series = await context.queryClient
      .ensureQueryData(seriesBySlugQueryOptions(params.slug))
      .catch(() => null);
    return { series };
  },
  head: ({ loaderData, params }) => {
    const series = loaderData?.series ?? null;
    const path = `/series/${params.slug}`;
    const cover = series?.cover_url ? publicImageUrl(series.cover_url) : undefined;
    const description = series
      ? (series.synopsis?.trim().slice(0, 155) ??
        `Read ${series.title}, an original manhwa published by ${SITE_NAME}.`)
      : "This series is not available on AMO-SCANS-FR.";

    return {
      meta: buildPageMeta({
        title: series ? `${series.title} — ${SITE_NAME}` : `Series not found — ${SITE_NAME}`,
        description,
        path,
        image: cover,
        type: "book",
        noindex: !series,
      }),
      links: [canonicalLink(path)],
      scripts: series
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(bookJsonLd(series, path, cover)),
            },
          ]
        : [],
    };
  },
  // The loader also runs on client navigations; show the skeleton immediately
  // instead of leaving the previous page on screen.
  pendingComponent: SeriesDetailSkeleton,
  pendingMs: 0,
  pendingMinMs: 250,
  component: SeriesPage,
});

function bookJsonLd(series: SeriesRow, path: string, cover: string | undefined) {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: series.title,
    description: series.synopsis ?? undefined,
    image: cover ? absoluteUrl(cover) : socialImageUrl(),
    url: absoluteUrl(path),
    genre: series.genre ?? undefined,
    inLanguage: "en",
    bookFormat: "https://schema.org/GraphicNovel",
    datePublished: series.created_at,
    dateModified: series.updated_at,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

function SeriesShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}

function SeriesPage() {
  const { slug } = Route.useParams();
  const seriesQuery = useQuery(seriesBySlugQueryOptions(slug));
  const series = seriesQuery.data ?? null;
  const chaptersQuery = useQuery(chaptersQueryOptions(series?.id, true));
  const lastRead = useLastRead(slug);

  const chapters = chaptersQuery.data ?? [];

  if (seriesQuery.isLoading) {
    return (
      <SeriesShell>
        <SeriesDetailSkeleton />
      </SeriesShell>
    );
  }

  if (seriesQuery.isError) {
    return (
      <SeriesShell>
        <div className="mx-auto max-w-3xl px-6 py-20">
          <ErrorState
            title="This series couldn't load"
            message="We could not reach the series details. Please try again."
            onRetry={() => {
              void seriesQuery.refetch();
            }}
          />
        </div>
      </SeriesShell>
    );
  }

  if (!series) {
    return (
      <SeriesShell>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">404</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
            Series not found
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            “{humanizeSlug(slug)}” is not in the library. It may have been renamed, unpublished or
            removed.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-foreground text-background hover:bg-foreground/90">
              <Link to="/">Back to the library</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
            >
              <Link to="/schedule">Release schedule</Link>
            </Button>
          </div>
        </div>
      </SeriesShell>
    );
  }

  const cover = series.cover_url ? publicImageUrl(series.cover_url) : null;
  // `fetchChapters` returns newest first, so the last item is the first chapter.
  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  const latestChapter = chapters.length > 0 ? chapters[0] : null;
  const resumeChapter = lastRead
    ? (chapters.find((chapter) => chapter.number === lastRead.number) ?? null)
    : null;
  const primaryChapter = resumeChapter ?? firstChapter;
  const secondaryChapter =
    latestChapter && latestChapter.number !== primaryChapter?.number
      ? latestChapter
      : firstChapter && firstChapter.number !== primaryChapter?.number
        ? firstChapter
        : null;
  const lastUpdatedAt = latestChapter?.created_at ?? series.updated_at;
  const tags = (series.tags ?? []).filter(Boolean);

  return (
    <SeriesShell>
      <div className="mx-auto max-w-7xl px-6 py-10 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs text-muted-foreground">
            <li>
              <Link
                to="/"
                className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
              >
                Library
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-foreground">
              {series.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 md:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
          <div className="mx-auto w-full max-w-[260px] md:sticky md:top-20 md:self-start">
            <div className="aspect-[2/3] overflow-hidden rounded-lg border border-neutral-800/60 bg-surface">
              {cover ? (
                <img
                  src={cover}
                  alt={`${series.title} cover`}
                  width={520}
                  height={780}
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                  {series.title}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {series.genre ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  {series.genre}
                </p>
              ) : null}
              <SeriesStatusBadge status={series.status} />
            </div>

            <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
              {series.title}
            </h1>

            {series.synopsis ? (
              <p className="mt-5 max-w-prose whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
                {series.synopsis}
              </p>
            ) : null}

            {tags.length > 0 ? (
              <ul aria-label="Tags" className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <li key={tag}>
                    <Badge
                      variant="outline"
                      className="border-neutral-800 bg-surface/60 text-[10px] uppercase tracking-widest text-muted-foreground"
                    >
                      {tag}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-neutral-800/60 py-5 sm:grid-cols-3">
              <div>
                <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Hash aria-hidden="true" className="h-3 w-3" /> Chapters
                </dt>
                <dd className="mt-1 text-lg font-medium tabular-nums text-foreground">
                  {chaptersQuery.isLoading ? "—" : chapters.length}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="h-3 w-3" /> Updated
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatRelativeDate(lastUpdatedAt)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <BookOpen aria-hidden="true" className="h-3 w-3" /> Reading
                </dt>
                <dd className="mt-1 text-sm text-foreground">Vertical scroll</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryChapter ? (
                <Button
                  asChild
                  size="lg"
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  <Link to="/read/$slug/$ep" params={{ slug, ep: String(primaryChapter.number) }}>
                    <Play aria-hidden="true" />
                    {resumeChapter
                      ? `Continue — Ch. ${resumeChapter.number}`
                      : `Start from Ch. ${primaryChapter.number}`}
                  </Link>
                </Button>
              ) : chaptersQuery.isLoading ? (
                <Button size="lg" disabled className="bg-foreground text-background">
                  Loading chapters…
                </Button>
              ) : (
                <Button size="lg" disabled className="bg-foreground text-background">
                  No chapters yet
                </Button>
              )}

              {secondaryChapter ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
                >
                  <Link to="/read/$slug/$ep" params={{ slug, ep: String(secondaryChapter.number) }}>
                    {secondaryChapter.number === latestChapter?.number
                      ? `Latest — Ch. ${secondaryChapter.number}`
                      : `Start from Ch. ${secondaryChapter.number}`}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
            </div>

            {resumeChapter && firstChapter && resumeChapter.number !== firstChapter.number ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Picking the series back up?{" "}
                <Link
                  to="/read/$slug/$ep"
                  params={{ slug, ep: String(firstChapter.number) }}
                  className="rounded-sm text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                >
                  Start from the beginning
                </Link>
                .
              </p>
            ) : null}

            <div className="mt-12">
              {chaptersQuery.isLoading ? (
                <ChapterListSkeleton />
              ) : chaptersQuery.isError ? (
                <ErrorState
                  title="Chapters couldn't load"
                  message="The chapter list is unavailable right now."
                  onRetry={() => {
                    void chaptersQuery.refetch();
                  }}
                />
              ) : (
                <ChapterList
                  chapters={chapters}
                  slug={slug}
                  lastReadChapter={resumeChapter?.number ?? null}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </SeriesShell>
  );
}

function ChapterListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading chapters">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3.5 w-24 bg-surface" />
        <Skeleton className="h-6 w-28 bg-surface" />
      </div>
      <div className="divide-y divide-neutral-800/60 border-y border-neutral-800/60">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 px-2 py-3">
            <Skeleton className="h-3.5 w-40 bg-surface" />
            <Skeleton className="h-3 w-20 bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SeriesDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl px-6 py-10 md:py-16"
      aria-busy="true"
      aria-label="Loading series"
    >
      <Skeleton className="mb-8 h-3.5 w-40 bg-surface" />
      <div className="grid gap-10 md:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <Skeleton className="mx-auto aspect-[2/3] w-full max-w-[260px] rounded-lg bg-surface" />
        <div>
          <Skeleton className="h-3.5 w-24 bg-surface" />
          <Skeleton className="mt-4 h-10 w-3/4 bg-surface" />
          <div className="mt-6 space-y-2">
            <Skeleton className="h-4 w-full bg-surface" />
            <Skeleton className="h-4 w-full bg-surface" />
            <Skeleton className="h-4 w-2/3 bg-surface" />
          </div>
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-10 w-44 bg-surface" />
            <Skeleton className="h-10 w-32 bg-surface" />
          </div>
          <div className="mt-12 space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full bg-surface" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
