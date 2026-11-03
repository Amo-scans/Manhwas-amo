import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ErrorState, EmptyState } from "@/components/query-states";
import { formatRelativeDate, formatWeekday } from "@/components/relative-date";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { latestChaptersQueryOptions, publicImageUrl, type LatestChapter } from "@/lib/queries";
import { buildPageMeta, canonicalLink, SITE_NAME } from "@/lib/seo";

/** Releases inspected to infer each series' weekly rhythm. */
const SCHEDULE_SAMPLE_SIZE = 50;

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayName = (typeof WEEKDAYS)[number];

type ScheduledSeries = {
  day: DayName;
  slug: string;
  title: string;
  cover: string | null;
  chapterNumber: number;
  chapterTitle: string | null;
  releasedAt: string;
};

function isDayName(value: string): value is DayName {
  return (WEEKDAYS as readonly string[]).includes(value);
}

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: buildPageMeta({
      title: `Release schedule — ${SITE_NAME}`,
      description:
        "Weekly release rhythm for AMO-SCANS-FR original manhwa, derived from real chapter dates.",
      path: "/schedule",
    }),
    links: [canonicalLink("/schedule")],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const latestQuery = useQuery(latestChaptersQueryOptions(SCHEDULE_SAMPLE_SIZE));

  const schedule = useMemo<ScheduledSeries[]>(() => {
    const releases = latestQuery.data ?? [];
    const bySeries = new Map<string, { latest: LatestChapter; dayCounts: Map<string, number> }>();

    for (const release of releases) {
      const day = formatWeekday(release.created_at);
      const existing = bySeries.get(release.series.slug);
      if (existing) {
        existing.dayCounts.set(day, (existing.dayCounts.get(day) ?? 0) + 1);
      } else {
        bySeries.set(release.series.slug, {
          latest: release,
          dayCounts: new Map([[day, 1]]),
        });
      }
    }

    const entries: ScheduledSeries[] = [];
    for (const { latest, dayCounts } of bySeries.values()) {
      // Most frequent weekday wins; ties keep the first (most recent) insertion.
      let bestDay = "";
      let bestCount = 0;
      for (const [day, count] of dayCounts) {
        if (count > bestCount) {
          bestDay = day;
          bestCount = count;
        }
      }
      if (!isDayName(bestDay)) continue;
      entries.push({
        day: bestDay,
        slug: latest.series.slug,
        title: latest.series.title,
        cover: latest.series.cover_url ? publicImageUrl(latest.series.cover_url) : null,
        chapterNumber: latest.number,
        chapterTitle: latest.title,
        releasedAt: latest.created_at,
      });
    }

    return entries;
  }, [latestQuery.data]);

  const totalReleases = latestQuery.data?.length ?? 0;

  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <main id="main-content" className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <header className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            Release rhythm
          </p>
          <h1
            id="schedule-heading"
            className="mt-3 text-balance font-display text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl"
          >
            Release schedule
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            When new episodes usually land. This page is derived from the real publication dates of
            the latest chapters — a snapshot of the studio's cadence, not a promise.
          </p>
          {!latestQuery.isLoading && totalReleases > 0 ? (
            <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Based on the last {totalReleases} releases
            </p>
          ) : null}
        </header>

        <div className="mt-10">
          {latestQuery.isLoading ? (
            <ScheduleSkeleton />
          ) : latestQuery.isError ? (
            <ErrorState
              title="The schedule couldn't load"
              message="We could not load the latest releases. Please try again."
              onRetry={() => {
                void latestQuery.refetch();
              }}
            />
          ) : schedule.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No releases recorded yet"
              message="Once chapters are published, their weekly rhythm appears here. The library is open in the meantime."
              action={
                <Button asChild size="sm" className="bg-accent text-accent-foreground">
                  <Link to="/">Browse the library</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {WEEKDAYS.map((day) => {
                const entries = schedule.filter((entry) => entry.day === day);
                return (
                  <section
                    key={day}
                    aria-labelledby={`day-${day}`}
                    className="rounded-xl border border-neutral-800/60 bg-surface/25 p-5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h2
                        id={`day-${day}`}
                        className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground"
                      >
                        {day}
                      </h2>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                        {entries.length === 0 ? "Quiet" : `${entries.length} series`}
                      </span>
                    </div>

                    {entries.length === 0 ? (
                      <p className="mt-4 text-xs text-muted-foreground/70">
                        No release recorded on this day yet.
                      </p>
                    ) : (
                      <ul className="mt-4 flex flex-col gap-3">
                        {entries.map((entry) => (
                          <li key={entry.slug} className="flex items-center gap-3">
                            <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-neutral-900">
                              {entry.cover ? (
                                <img
                                  src={entry.cover}
                                  alt=""
                                  width={80}
                                  height={112}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                to="/series/$slug"
                                params={{ slug: entry.slug }}
                                className="block truncate rounded-sm text-sm font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                              >
                                {entry.title}
                              </Link>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                <Link
                                  to="/read/$slug/$ep"
                                  params={{
                                    slug: entry.slug,
                                    ep: String(entry.chapterNumber),
                                  }}
                                  className="rounded-sm text-accent underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                >
                                  Latest: Ch. {entry.chapterNumber}
                                </Link>
                                <time dateTime={entry.releasedAt}>
                                  {formatRelativeDate(entry.releasedAt)}
                                </time>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-neutral-800/60 pt-8">
          <p className="text-sm text-muted-foreground">Looking for something to read right now?</p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
          >
            <Link to="/">
              Browse the library <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the schedule" className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="rounded-xl border border-neutral-800/60 bg-surface/20 p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20 bg-surface" />
            <Skeleton className="h-2.5 w-16 bg-surface" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Skeleton className="h-14 w-10 rounded bg-surface" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-3/4 bg-surface" />
              <Skeleton className="mt-2 h-3 w-1/2 bg-surface" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
