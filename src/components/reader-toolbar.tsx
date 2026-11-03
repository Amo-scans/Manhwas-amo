import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChapterRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type ReaderWidthMode = "fit" | "full";

type ReaderToolbarProps = {
  slug: string;
  seriesTitle: string;
  chapterNumber: number;
  chapterTitle: string | null;
  chapters: ChapterRow[];
  /** Scroll progress through the current chapter, 0–100. */
  progress: number;
  widthMode: ReaderWidthMode;
  onToggleWidth: () => void;
  previous: number | null;
  next: number | null;
  onNavigate: (chapter: number) => void;
};

/**
 * Sticky reader controls: scroll progress, chapter picker, previous/next and
 * reading width. Sits directly under the site nav (h-14).
 */
export function ReaderToolbar({
  slug,
  seriesTitle,
  chapterNumber,
  chapterTitle,
  chapters,
  progress,
  widthMode,
  onToggleWidth,
  previous,
  next,
  onNavigate,
}: ReaderToolbarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const roundedProgress = Math.round(clampedProgress);

  return (
    <div className="sticky top-14 z-40 border-b border-neutral-800/70 bg-base/90 backdrop-blur-md">
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedProgress}
        aria-valuetext={`${roundedProgress}% of the chapter`}
        className="h-0.5 w-full bg-neutral-800"
      >
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      <div
        aria-label="Reader controls"
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6"
      >
        <Link
          to="/series/$slug"
          params={{ slug }}
          aria-label={`Back to ${seriesTitle}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Series</span>
        </Link>

        <p className="hidden min-w-0 flex-1 truncate text-sm text-foreground md:block">
          {seriesTitle}
          <span className="text-muted-foreground">
            {" "}
            · Ch. {chapterNumber}
            {chapterTitle ? ` — ${chapterTitle}` : ""}
          </span>
        </p>

        <div className="ml-auto flex items-center gap-1.5">
          {chapters.length > 0 ? (
            <Select
              value={String(chapterNumber)}
              onValueChange={(value) => {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) onNavigate(parsed);
              }}
            >
              <SelectTrigger
                aria-label="Jump to chapter"
                className="h-8 w-28 border-neutral-800 bg-surface/70 text-xs text-foreground focus:ring-accent sm:w-56"
              >
                <SelectValue placeholder="Chapter" />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-neutral-800 bg-surface text-foreground">
                {chapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={String(chapter.number)} className="text-xs">
                    Ch. {chapter.number}
                    {chapter.title ? ` — ${chapter.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="px-1 text-xs tabular-nums text-muted-foreground">
              Ch. {chapterNumber}
            </span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={previous === null}
            onClick={() => previous !== null && onNavigate(previous)}
            aria-label={previous === null ? "This is the first chapter" : "Previous chapter"}
            title={previous === null ? "This is the first chapter" : "Previous chapter"}
            className="h-8 w-8 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={next === null}
            onClick={() => next !== null && onNavigate(next)}
            aria-label={next === null ? "This is the latest chapter" : "Next chapter"}
            title={next === null ? "This is the latest chapter" : "Next chapter"}
            className="h-8 w-8 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <ChevronRight aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleWidth}
            aria-pressed={widthMode === "full"}
            aria-label={
              widthMode === "full" ? "Switch to fitted image width" : "Switch to full image width"
            }
            title={widthMode === "full" ? "Fitted width" : "Full width"}
            className={cn(
              "h-8 w-8 text-muted-foreground hover:bg-surface hover:text-foreground",
              widthMode === "full" && "text-accent",
            )}
          >
            {widthMode === "full" ? (
              <Minimize2 aria-hidden="true" />
            ) : (
              <Maximize2 aria-hidden="true" />
            )}
          </Button>

          <span className="hidden w-10 text-right text-[11px] tabular-nums text-muted-foreground sm:inline">
            {roundedProgress}%
          </span>
        </div>
      </div>
    </div>
  );
}
