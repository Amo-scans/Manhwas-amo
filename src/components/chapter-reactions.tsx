import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import {
  REACTIONS,
  chapterReactionsQueryOptions,
  emptyReactionCounts,
  setChapterReaction,
  type ChapterReactionRow,
  type ReactionKind,
} from "@/lib/reactions";
import { cn } from "@/lib/utils";

/**
 * Emoji reactions shown at the end of a chapter.
 *
 * - visitors see the aggregate counts,
 * - signed-in readers can pick exactly one reaction (clicking it again removes it),
 * - the block hides itself if the `chapter_reactions` table is missing (migration
 *   not applied yet) so the reader never breaks.
 */
export function ChapterReactions({ chapterId }: { chapterId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const options = chapterReactionsQueryOptions(chapterId);
  const reactionsQuery = useQuery(options);
  const queryKey = options.queryKey;

  const rows = reactionsQuery.data ?? [];
  const counts = emptyReactionCounts();
  for (const row of rows) {
    if (row.reaction in counts) counts[row.reaction] += 1;
  }
  const mine = user ? (rows.find((row) => row.user_id === user.id)?.reaction ?? null) : null;
  const total = rows.length;

  const mutation = useMutation({
    mutationFn: async (reaction: ReactionKind | null) => {
      if (!user) throw new Error("Sign in to react to this chapter.");
      await setChapterReaction(chapterId, user.id, reaction);
    },
    onMutate: async (reaction) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChapterReactionRow[]>(queryKey) ?? [];
      const next = previous.filter((row) => row.user_id !== user?.id);
      if (reaction && user) {
        next.push({
          id: `optimistic-${reaction}`,
          chapter_id: chapterId,
          user_id: user.id,
          reaction,
          created_at: new Date().toISOString(),
        });
      }
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (error, _reaction, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
      toast.error(error instanceof Error ? error.message : "Could not save your reaction.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  if (reactionsQuery.isError) return null;

  const handleClick = (kind: ReactionKind) => {
    if (!user) {
      toast.info("Sign in to react to this chapter.");
      return;
    }
    mutation.mutate(mine === kind ? null : kind);
  };

  return (
    <section
      aria-labelledby="chapter-reactions-heading"
      className="mx-auto mt-10 w-full max-w-3xl px-6"
    >
      <div className="rounded-2xl border border-neutral-800 bg-surface/40 px-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="chapter-reactions-heading"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            How was this chapter?
          </h2>
          <p className="text-[11px] text-muted-foreground" aria-live="polite">
            {total === 0 ? "No reaction yet" : `${total} reaction${total > 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {REACTIONS.map((reaction) => {
            const count = counts[reaction.kind];
            const isMine = mine === reaction.kind;
            return (
              <button
                key={reaction.kind}
                type="button"
                onClick={() => handleClick(reaction.kind)}
                aria-pressed={isMine}
                aria-label={`${reaction.label}${count > 0 ? ` (${count})` : ""}`}
                disabled={mutation.isPending}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                  isMine
                    ? "border-accent/60 bg-accent/15 text-foreground"
                    : "border-neutral-800 bg-base text-foreground hover:border-neutral-700 hover:bg-surface",
                  mutation.isPending && "opacity-70",
                )}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {reaction.emoji}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>

        {user ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Heart aria-hidden="true" className="h-3 w-3" />
            {mine ? "Click again to remove your reaction." : "Pick the reaction that fits."}
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            <Link to="/auth" className="text-accent underline underline-offset-2">
              Sign in
            </Link>{" "}
            to react to this chapter.
          </p>
        )}
      </div>
    </section>
  );
}
