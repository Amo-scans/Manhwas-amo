import { ThumbsDown, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CommentVoteTally, CommentVoteValue } from "@/lib/reactions";

type CommentVotesProps = {
  tally: CommentVoteTally;
  disabled?: boolean;
  onVote: (value: CommentVoteValue | null) => void;
};

/** Like / dislike control displayed under a comment. */
export function CommentVotes({ tally, disabled = false, onVote }: CommentVotesProps) {
  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={tally.mine === 1}
        aria-label={`Like this comment${tally.likes > 0 ? ` (${tally.likes})` : ""}`}
        title="Like"
        onClick={() => onVote(tally.mine === 1 ? null : 1)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          tally.mine === 1
            ? "text-accent"
            : "text-muted-foreground hover:bg-surface hover:text-foreground",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="tabular-nums">{tally.likes}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        aria-pressed={tally.mine === -1}
        aria-label={`Dislike this comment${tally.dislikes > 0 ? ` (${tally.dislikes})` : ""}`}
        title="Dislike"
        onClick={() => onVote(tally.mine === -1 ? null : -1)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          tally.mine === -1
            ? "text-destructive"
            : "text-muted-foreground hover:bg-surface hover:text-foreground",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <ThumbsDown aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="tabular-nums">{tally.dislikes}</span>
      </button>
    </div>
  );
}
