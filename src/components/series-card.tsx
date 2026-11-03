import { Link } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { publicImageUrl, type SeriesRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "On hiatus",
  cancelled: "Cancelled",
  upcoming: "Upcoming",
};

/** "ongoing" -> "Ongoing"; unknown values are shown as stored. */
function seriesStatusLabel(status: string | null | undefined): string {
  if (!status) return "Ongoing";
  const trimmed = status.trim();
  if (!trimmed) return "Ongoing";
  return STATUS_LABELS[trimmed.toLowerCase()] ?? trimmed;
}

export function SeriesStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const label = seriesStatusLabel(status);
  const tone =
    label === "Completed" || label === "Cancelled"
      ? "border-neutral-700/80 bg-base/80 text-muted-foreground"
      : "border-accent/40 bg-base/80 text-accent";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}

type SeriesCardProps = {
  series: SeriesRow;
  /** Load the cover eagerly — use for the first row above the fold. */
  priority?: boolean;
  className?: string;
};

export function SeriesCard({ series, priority = false, className }: SeriesCardProps) {
  const cover = series.cover_url ? publicImageUrl(series.cover_url) : null;

  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      aria-label={`${series.title} — series details`}
      className={cn(
        "group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-base",
        className,
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md border border-neutral-800/60 bg-surface">
        {cover ? (
          <img
            src={cover}
            alt={`${series.title} cover`}
            width={400}
            height={600}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs uppercase tracking-widest text-muted-foreground">
            {series.title}
          </div>
        )}
        <SeriesStatusBadge status={series.status} className="absolute left-2 top-2" />
      </div>
      <h3 className="mt-3 truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent">
        {series.title}
      </h3>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{series.genre ?? "Original"}</p>
    </Link>
  );
}

export function SeriesCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("block", className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-md bg-surface" />
      <Skeleton className="mt-3 h-3.5 w-4/5 bg-surface" />
      <Skeleton className="mt-2 h-3 w-2/5 bg-surface" />
    </div>
  );
}
