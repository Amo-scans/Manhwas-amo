import { Link } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate } from "@/components/relative-date";
import { publicImageUrl, type LatestChapter } from "@/lib/queries";
import { cn } from "@/lib/utils";

type LatestReleaseCardProps = {
  release: LatestChapter;
  className?: string;
};

/** Compact "series + chapter" card used by the home page's latest releases row. */
export function LatestReleaseCard({ release, className }: LatestReleaseCardProps) {
  const cover = release.series.cover_url ? publicImageUrl(release.series.cover_url) : null;

  return (
    <Link
      to="/read/$slug/$ep"
      params={{ slug: release.series.slug, ep: String(release.number) }}
      aria-label={`Read chapter ${release.number} of ${release.series.title}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-neutral-800/60 bg-surface/40 p-3 transition-colors hover:border-neutral-700 hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
        className,
      )}
    >
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-neutral-900">
        {cover ? (
          <img
            src={cover}
            alt=""
            width={88}
            height={128}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent">
          {release.series.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Chapter {release.number}
          {release.title ? ` — ${release.title}` : ""}
        </p>
        <time
          dateTime={release.created_at}
          className="mt-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70"
        >
          {formatRelativeDate(release.created_at)}
        </time>
      </div>
    </Link>
  );
}

export function LatestReleaseSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-800/60 bg-surface/30 p-3">
      <Skeleton className="h-16 w-11 shrink-0 rounded bg-surface" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-3/4 bg-surface" />
        <Skeleton className="mt-2 h-3 w-1/2 bg-surface" />
        <Skeleton className="mt-2 h-2.5 w-1/4 bg-surface" />
      </div>
    </div>
  );
}
