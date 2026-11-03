import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/query-states";
import { formatCalendarDate } from "@/components/relative-date";
import type { ChapterRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Above this count the list collapses so the page header stays reachable. */
const COLLAPSE_THRESHOLD = 30;

type SortOrder = "desc" | "asc";

type ChapterListProps = {
  chapters: ChapterRow[];
  slug: string;
  /** Chapter number remembered in localStorage, highlighted with a badge. */
  lastReadChapter?: number | null;
  className?: string;
};

export function ChapterList({
  chapters,
  slug,
  lastReadChapter = null,
  className,
}: ChapterListProps) {
  const [order, setOrder] = useState<SortOrder>("desc");
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...chapters];
    copy.sort((a, b) => (order === "desc" ? b.number - a.number : a.number - b.number));
    return copy;
  }, [chapters, order]);

  const collapsible = sorted.length > COLLAPSE_THRESHOLD;
  const visible = collapsible && !expanded ? sorted.slice(0, COLLAPSE_THRESHOLD) : sorted;

  if (chapters.length === 0) {
    return (
      <EmptyState
        className={className}
        icon={BookOpen}
        title="No chapters yet"
        message="The first episode has not been published. The release schedule shows when new chapters are expected."
        action={
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
          >
            <Link to="/schedule">Release schedule</Link>
          </Button>
        }
      />
    );
  }

  return (
    <section className={className} aria-labelledby="chapters-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2
          id="chapters-heading"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Chapters <span className="text-foreground">({chapters.length})</span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOrder((current) => (current === "desc" ? "asc" : "desc"))}
          aria-pressed={order === "asc"}
          aria-label={`Sort chapters: ${order === "desc" ? "newest first" : "oldest first"}. Activate to reverse.`}
          className="gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {order === "desc" ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
          {order === "desc" ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      <ul className="divide-y divide-neutral-800/60 border-y border-neutral-800/60">
        {visible.map((chapter) => (
          <li key={chapter.id}>
            <Link
              to="/read/$slug/$ep"
              params={{ slug, ep: String(chapter.number) }}
              aria-label={`Read chapter ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ""}`}
              className="group flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-accent">
                  Ch. {chapter.number}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    chapter.title ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {chapter.title ?? "Untitled chapter"}
                </span>
                {lastReadChapter === chapter.number ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-accent/40 bg-accent/10 text-[10px] uppercase tracking-wider text-accent"
                  >
                    Last read
                  </Badge>
                ) : null}
              </span>
              <time
                dateTime={chapter.created_at}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {formatCalendarDate(chapter.created_at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>

      {collapsible ? (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
          >
            {expanded ? "Show fewer chapters" : `Show all ${sorted.length} chapters`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
