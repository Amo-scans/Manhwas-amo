import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { ChapterReactions } from "@/components/chapter-reactions";
import { CommentsSection } from "@/components/comments-section";
import { EmptyState, ErrorState } from "@/components/query-states";
import { ReaderToolbar, type ReaderWidthMode } from "@/components/reader-toolbar";
import { formatCalendarDate } from "@/components/relative-date";
import { markChapterRead } from "@/components/use-last-read";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chapterByNumberQueryOptions,
  chapterNeighborsQueryOptions,
  chaptersQueryOptions,
  panelsQueryOptions,
  publicImageUrl,
  seriesBySlugQueryOptions,
  type PanelRow,
} from "@/lib/queries";
import { buildPageMeta, canonicalLink, humanizeSlug, SITE_NAME } from "@/lib/seo";
import { cn } from "@/lib/utils";

const READER_WIDTH_KEY = "amo-scans:reader-width";
const BACK_TO_TOP_THRESHOLD = 720;

export const Route = createFileRoute("/read/$slug/$ep")({
  head: ({ params }) => {
    const path = `/read/${params.slug}/${params.ep}`;
    const seriesName = humanizeSlug(params.slug);
    return {
      meta: buildPageMeta({
        title: `Chapter ${params.ep} — ${seriesName} — ${SITE_NAME}`,
        description: `Read chapter ${params.ep} of ${seriesName} on ${SITE_NAME}. Vertical-scroll manhwa, new episodes every week.`,
        path,
        type: "article",
      }),
      links: [canonicalLink(path)],
    };
  },
  component: Reader,
});

function Reader() {
  const { slug, ep } = Route.useParams();
  const navigate = useNavigate();
  const episode = Number(ep);

  const seriesQuery = useQuery(seriesBySlugQueryOptions(slug));
  const series = seriesQuery.data ?? null;
  const chapterQuery = useQuery(chapterByNumberQueryOptions(series?.id, episode));
  const chapter = chapterQuery.data ?? null;
  const panelsQuery = useQuery(panelsQueryOptions(chapter?.id));
  const panels = panelsQuery.data ?? [];
  const neighborsQuery = useQuery(chapterNeighborsQueryOptions(series?.id, episode));
  const previous = neighborsQuery.data?.previous ?? null;
  const next = neighborsQuery.data?.next ?? null;
  const chaptersQuery = useQuery(chaptersQueryOptions(series?.id, true));
  const chapters = chaptersQuery.data ?? [];

  const [widthMode, setWidthMode] = useState<ReaderWidthMode>("fit");
  const [progress, setProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const goToChapter = useCallback(
    (number: number) => {
      if (!Number.isFinite(number) || number === episode) return;
      void navigate({ to: "/read/$slug/$ep", params: { slug, ep: String(number) } });
    },
    [episode, navigate, slug],
  );

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Restore the reader width preference once on mount (SSR-safe).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(READER_WIDTH_KEY) === "full") setWidthMode("full");
    } catch {
      // Storage can be blocked; the default width still works.
    }
  }, []);

  const toggleWidth = useCallback(() => {
    setWidthMode((current) => {
      const nextMode: ReaderWidthMode = current === "fit" ? "full" : "fit";
      try {
        window.localStorage.setItem(READER_WIDTH_KEY, nextMode);
      } catch {
        // Ignore quota/security errors.
      }
      return nextMode;
    });
  }, []);

  // Every chapter starts at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [episode, slug]);

  // Remember where the reader stopped for the "Continue reading" CTA.
  useEffect(() => {
    if (chapter && Number.isFinite(episode)) markChapterRead(slug, chapter.number);
  }, [chapter, episode, slug]);

  // Scroll progress + floating "back to top" visibility (rAF-throttled).
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(
        scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0,
      );
      setShowBackToTop(window.scrollY > BACK_TO_TOP_THRESHOLD);
    };
    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Panels have no reserved height beyond their intrinsic ratio: recompute
    // progress whenever the document grows (image load, width toggle, fonts).
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    resizeObserver?.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      resizeObserver?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [panels.length, widthMode]);

  // Arrow keys = previous / next chapter, unless the user is typing or a menu is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return;
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.closest('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      }

      if (event.key === "ArrowLeft" && previous !== null) {
        event.preventDefault();
        goToChapter(previous);
      } else if (event.key === "ArrowRight" && next !== null) {
        event.preventDefault();
        goToChapter(next);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToChapter, next, previous]);

  if (!Number.isFinite(episode)) {
    return (
      <ReaderShell>
        <ReaderNotice
          eyebrow="Invalid chapter"
          title="This chapter number doesn't exist"
          message="The address does not contain a valid chapter number. Head back to the library to pick an episode."
        >
          <Button asChild className="bg-foreground text-background hover:bg-foreground/90">
            <Link to="/">Back to the library</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
          >
            <Link to="/series/$slug" params={{ slug }}>
              Series details
            </Link>
          </Button>
        </ReaderNotice>
      </ReaderShell>
    );
  }

  if (seriesQuery.isLoading) {
    return (
      <ReaderShell>
        <ReaderSkeleton />
      </ReaderShell>
    );
  }

  if (seriesQuery.isError) {
    return (
      <ReaderShell>
        <div className="mx-auto max-w-3xl px-6 py-20">
          <ErrorState
            title="The reader couldn't load"
            message="We could not reach the series. Please try again."
            onRetry={() => {
              void seriesQuery.refetch();
            }}
          />
        </div>
      </ReaderShell>
    );
  }

  if (!series) {
    return (
      <ReaderShell>
        <ReaderNotice
          eyebrow="Series not found"
          title="This series isn't in the library"
          message={`“${humanizeSlug(slug)}” could not be found. It may have been renamed or removed.`}
        >
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
        </ReaderNotice>
      </ReaderShell>
    );
  }

  if (chapterQuery.isError) {
    return (
      <ReaderShell>
        <div className="mx-auto max-w-3xl px-6 py-20">
          <ErrorState
            title="This chapter couldn't load"
            message={`We could not reach chapter ${episode} of ${series.title}.`}
            onRetry={() => {
              void chapterQuery.refetch();
            }}
          />
        </div>
      </ReaderShell>
    );
  }

  if (!chapterQuery.isLoading && !chapter) {
    const latestChapter = chapters.length > 0 ? chapters[0] : null;
    return (
      <ReaderShell>
        <ReaderNotice
          eyebrow="Chapter missing"
          title={`Chapter ${episode} not found`}
          message={`This episode of ${series.title} is not published yet, or the chapter number is incorrect.`}
        >
          <Button asChild className="bg-foreground text-background hover:bg-foreground/90">
            <Link to="/series/$slug" params={{ slug }}>
              Back to {series.title}
            </Link>
          </Button>
          {latestChapter ? (
            <Button
              asChild
              variant="outline"
              className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
            >
              <Link to="/read/$slug/$ep" params={{ slug, ep: String(latestChapter.number) }}>
                Latest chapter
              </Link>
            </Button>
          ) : null}
        </ReaderNotice>
      </ReaderShell>
    );
  }

  // Draft previews can load a chapter that is absent from the published list;
  // keep the picker consistent by prepending the chapter being read.
  const chapterOptions =
    chapter && !chapters.some((entry) => entry.id === chapter.id)
      ? [chapter, ...chapters]
      : chapters;

  return (
    <ReaderShell>
      <ReaderToolbar
        slug={slug}
        seriesTitle={series.title}
        chapterNumber={episode}
        chapterTitle={chapter?.title ?? null}
        chapters={chapterOptions}
        progress={progress}
        widthMode={widthMode}
        onToggleWidth={toggleWidth}
        previous={previous}
        next={next}
        onNavigate={goToChapter}
      />

      <article aria-labelledby="chapter-heading" className="pb-16">
        <header className="mx-auto max-w-3xl px-6 pb-8 pt-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            Now reading
          </p>
          <h1
            id="chapter-heading"
            className="mt-3 text-balance font-display text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl"
          >
            <Link
              to="/series/$slug"
              params={{ slug }}
              className="rounded-sm transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              {series.title}
            </Link>
            <span className="text-muted-foreground"> · Ch. {episode}</span>
          </h1>
          {chapter?.title ? (
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{chapter.title}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {chapter ? (
              <time dateTime={chapter.created_at}>{formatCalendarDate(chapter.created_at)}</time>
            ) : null}
            {panels.length > 0 ? (
              <span>
                {panels.length} panel{panels.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className="text-muted-foreground/70">← / → to switch chapters</span>
          </div>
        </header>

        <div
          className={cn(
            "mx-auto flex flex-col",
            widthMode === "fit" ? "max-w-3xl" : "w-full max-w-none",
          )}
        >
          {chapterQuery.isLoading || panelsQuery.isLoading ? (
            <PanelsSkeleton />
          ) : panelsQuery.isError ? (
            <ErrorState
              className="mx-6 mt-2 max-w-xl sm:mx-auto"
              title="Panels couldn't load"
              message="The pages of this chapter failed to load. Please try again."
              onRetry={() => {
                void panelsQuery.refetch();
              }}
            />
          ) : panels.length === 0 ? (
            <EmptyState
              className="mx-6 mt-2"
              title="No panels yet"
              message="The art for this chapter has not been uploaded. Check back soon."
            />
          ) : (
            panels.map((panel, index) => (
              <ReaderPanel key={panel.id} panel={panel} eager={index === 0} />
            ))
          )}
        </div>

        <ChapterEndNav
          slug={slug}
          seriesTitle={series.title}
          previous={previous}
          next={next}
          onNavigate={goToChapter}
          onBackToTop={scrollToTop}
        />
      </article>

      {chapter?.id ? <ChapterReactions chapterId={chapter.id} /> : null}

      <CommentsSection slug={slug} episode={chapter?.number ?? episode} />

      {showBackToTop ? (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-6 right-6 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 bg-surface/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <ArrowUp aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </ReaderShell>
  );
}

function ReaderShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <main id="main-content">{children}</main>
    </div>
  );
}

function ReaderPanel({ panel, eager }: { panel: PanelRow; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = publicImageUrl(panel.image_url);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`Panel ${panel.position} failed to load`}
        className="flex min-h-40 items-center justify-center border-y border-neutral-800/60 bg-surface/40 px-6 py-10 text-center"
      >
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Panel {panel.position} could not be loaded
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Panel ${panel.position}`}
      width={panel.width ?? undefined}
      height={panel.height ?? undefined}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
      className="block h-auto w-full bg-surface/20"
    />
  );
}

function ReaderNotice({
  eyebrow,
  title,
  message,
  children,
}: {
  eyebrow: string;
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}

function ChapterEndNav({
  slug,
  seriesTitle,
  previous,
  next,
  onNavigate,
  onBackToTop,
}: {
  slug: string;
  seriesTitle: string;
  previous: number | null;
  next: number | null;
  onNavigate: (chapter: number) => void;
  onBackToTop: () => void;
}) {
  return (
    <div className="mx-auto mt-12 max-w-3xl px-6">
      <div className="rounded-xl border border-neutral-800/60 bg-surface/30 px-6 py-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          End of chapter
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {next !== null
            ? "Keep going — the next chapter is ready."
            : "You're all caught up. This is the latest chapter; new episodes drop weekly."}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={previous === null}
            onClick={() => previous !== null && onNavigate(previous)}
            className="border-neutral-800 bg-base/60 text-foreground hover:bg-neutral-800/60"
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
          {next !== null ? (
            <Button
              type="button"
              size="lg"
              onClick={() => onNavigate(next)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Next chapter
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <Link to="/series/$slug" params={{ slug }}>
                Back to {seriesTitle}
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <Link
            to="/series/$slug"
            params={{ slug }}
            className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            All chapters
          </Link>
          <Link
            to="/schedule"
            className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Release schedule
          </Link>
          <button
            type="button"
            onClick={onBackToTop}
            className="rounded-sm uppercase tracking-widest transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Back to top
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading panels" className="flex flex-col gap-3 px-3 sm:px-0">
      <Skeleton className="h-72 w-full bg-surface" />
      <Skeleton className="h-96 w-full bg-surface" />
      <Skeleton className="h-80 w-full bg-surface" />
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12" aria-busy="true" aria-label="Loading chapter">
      <Skeleton className="mx-auto h-3 w-28 bg-surface" />
      <Skeleton className="mx-auto mt-4 h-9 w-2/3 bg-surface" />
      <Skeleton className="mx-auto mt-2 h-3 w-40 bg-surface" />
      <div className="mt-10 flex flex-col gap-3">
        <Skeleton className="h-72 w-full bg-surface" />
        <Skeleton className="h-96 w-full bg-surface" />
        <Skeleton className="h-80 w-full bg-surface" />
      </div>
    </div>
  );
}
