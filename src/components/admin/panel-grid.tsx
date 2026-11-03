import { ArrowDown, ArrowUp, ExternalLink, Loader2, Trash2 } from "lucide-react";
import type { PanelRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type PanelGridProps = {
  /** Panels sorted by ascending position. */
  panels: PanelRow[];
  movingPanelId: string | null;
  onMovePanel: (panel: PanelRow, direction: -1 | 1) => void;
  onRequestDelete: (panel: PanelRow) => void;
};

const actionButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-neutral-800 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

/** Thumbnail grid with reorder / preview / delete controls for a chapter's pages. */
export function PanelGrid({ panels, movingPanelId, onMovePanel, onRequestDelete }: PanelGridProps) {
  if (panels.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-800 p-6 text-center text-sm text-muted-foreground">
        No pages yet. Upload the first batch below.
      </p>
    );
  }

  const isBusy = movingPanelId !== null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {panels.map((panel, index) => {
        const moving = movingPanelId === panel.id;
        return (
          <li
            key={panel.id}
            className={cn(
              "overflow-hidden rounded-md border border-neutral-800 bg-base transition",
              moving && "border-accent/60",
            )}
          >
            <div className="relative aspect-[3/4] bg-neutral-900">
              <img
                src={panel.image_url}
                alt={`Page ${index + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-1.5 top-1.5 rounded bg-base/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
                #{index + 1}
              </span>
              {moving ? (
                <div className="absolute inset-0 flex items-center justify-center bg-base/60">
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" aria-hidden="true" />
                  <span className="sr-only">Saving new order…</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-1 border-t border-neutral-800 p-1.5">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, -1)}
                  disabled={index === 0 || isBusy}
                  aria-label={`Move page ${index + 1} up`}
                  title="Move up"
                  className={actionButtonClass}
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, 1)}
                  disabled={index === panels.length - 1 || isBusy}
                  aria-label={`Move page ${index + 1} down`}
                  title="Move down"
                  className={actionButtonClass}
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-0.5">
                <a
                  href={panel.image_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open page ${index + 1} in a new tab`}
                  title="Open full size"
                  className={actionButtonClass}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => onRequestDelete(panel)}
                  disabled={isBusy}
                  aria-label={`Delete page ${index + 1}`}
                  title="Delete page"
                  className={cn(
                    actionButtonClass,
                    "hover:bg-destructive/10 hover:text-destructive",
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
