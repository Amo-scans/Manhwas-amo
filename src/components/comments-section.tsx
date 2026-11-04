import { useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommentVotes } from "@/components/comment-votes";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, EmptyState } from "@/components/query-states";
import { formatCalendarDate, formatRelativeDate } from "@/components/relative-date";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { commentsQueryOptions, type CommentWithProfile, type ProfileSummary } from "@/lib/queries";
import {
  commentVotesQueryOptions,
  setCommentVote,
  tallyCommentVotes,
  type CommentVoteRow,
  type CommentVoteValue,
} from "@/lib/reactions";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;
const COUNTER_WARNING_THRESHOLD = 1800;

type CommentList = CommentWithProfile[];
type Rollback = { previous: CommentList | undefined };

function profileFromUser(user: User): ProfileSummary {
  const metadata = user.user_metadata as Record<string, unknown> | null | undefined;
  const fromMetadata =
    typeof metadata?.display_name === "string" && metadata.display_name.trim()
      ? metadata.display_name
      : typeof metadata?.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name
        : null;
  return {
    display_name: fromMetadata ?? user.email?.split("@")[0] ?? "Reader",
    avatar_url: typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null,
  };
}

function initialsFromName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const raw =
    parts.length >= 2
      ? `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`
      : trimmed.slice(0, 2);
  return raw ? raw.toUpperCase() : "?";
}

type CommentsSectionProps = {
  slug: string;
  episode: number;
};

export function CommentsSection({ slug, episode }: CommentsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const commentsQuery = useQuery(commentsQueryOptions(slug, episode));
  const queryKey = commentsQueryOptions(slug, episode).queryKey;

  const [content, setContent] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const comments = commentsQuery.data ?? [];
  const trimmed = content.trim();
  const canPost = Boolean(user) && trimmed.length > 0 && !commentsQuery.isLoading;

  /* -------- like / dislike on comments -------- */
  const commentIds = useMemo(
    () => comments.filter((comment) => !comment.id.startsWith("optimistic-")).map((c) => c.id),
    [comments],
  );
  const votesOptions = commentVotesQueryOptions(commentIds);
  const votesQuery = useQuery(votesOptions);
  const voteTallies = useMemo(
    () => tallyCommentVotes(votesQuery.data ?? [], user?.id),
    [votesQuery.data, user?.id],
  );
  // If the votes table is missing (migration not applied), hide the controls.
  const votesAvailable = !votesQuery.isError;

  const voteMutation = useMutation({
    mutationFn: async (input: { commentId: string; value: CommentVoteValue | null }) => {
      if (!user) throw new Error("Sign in to vote on comments.");
      await setCommentVote(input.commentId, user.id, input.value);
    },
    onMutate: async ({ commentId, value }) => {
      await queryClient.cancelQueries({ queryKey: votesOptions.queryKey });
      const previous = queryClient.getQueryData<CommentVoteRow[]>(votesOptions.queryKey) ?? [];
      const next = previous.filter(
        (vote) => !(vote.comment_id === commentId && vote.user_id === user?.id),
      );
      if (value && user) {
        next.push({ comment_id: commentId, user_id: user.id, value });
      }
      queryClient.setQueryData(votesOptions.queryKey, next);
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context) queryClient.setQueryData(votesOptions.queryKey, context.previous);
      toast.error(error instanceof Error ? error.message : "Could not save your vote.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: votesOptions.queryKey });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (value: string) => {
      if (!user) throw new Error("You need to be signed in to comment.");
      const { error } = await supabase.from("comments").insert({
        series_slug: slug,
        episode,
        user_id: user.id,
        content: value,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async (value): Promise<Rollback> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentList>(queryKey);
      if (user) {
        const optimistic: CommentWithProfile = {
          id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          series_slug: slug,
          episode,
          user_id: user.id,
          content: value,
          created_at: new Date().toISOString(),
          profile: profileFromUser(user),
        };
        queryClient.setQueryData<CommentList>(queryKey, [optimistic, ...(previous ?? [])]);
      }
      return { previous };
    },
    onError: (error, _value, context) => {
      if (context) queryClient.setQueryData<CommentList>(queryKey, context.previous ?? []);
      toast.error(error instanceof Error ? error.message : "Could not post your comment.");
    },
    onSuccess: () => {
      setContent("");
      toast.success("Comment posted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async (id): Promise<Rollback> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentList>(queryKey);
      queryClient.setQueryData<CommentList>(
        queryKey,
        (previous ?? []).filter((comment) => comment.id !== id),
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context) queryClient.setQueryData<CommentList>(queryKey, context.previous ?? []);
      toast.error(error instanceof Error ? error.message : "Could not delete the comment.");
    },
    onSuccess: () => {
      toast.success("Comment deleted");
    },
    onSettled: () => {
      setConfirmingDeleteId(null);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canPost || postMutation.isPending) return;
    postMutation.mutate(trimmed);
  };

  return (
    <section aria-labelledby="comments-heading" className="mx-auto max-w-3xl px-6 pb-24 pt-4">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2
          id="comments-heading"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Comments <span className="text-foreground">({comments.length})</span>
        </h2>
        <p className="hidden text-[11px] text-muted-foreground sm:block">
          Be kind. Spoilers deserve a warning.
        </p>
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <label htmlFor="comment-content" className="sr-only">
            Your comment
          </label>
          <Textarea
            id="comment-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share your thoughts on this chapter…"
            maxLength={MAX_LENGTH}
            rows={3}
            aria-describedby="comment-counter"
            className="min-h-24 resize-none border-neutral-800 bg-surface text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-accent"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              id="comment-counter"
              className={cn(
                "text-[11px] tabular-nums text-muted-foreground",
                content.length >= COUNTER_WARNING_THRESHOLD && "text-destructive",
              )}
            >
              {content.length} / {MAX_LENGTH}
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={!canPost || postMutation.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {postMutation.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {postMutation.isPending ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-8 rounded-xl border border-neutral-800 bg-surface/40 px-6 py-6 text-center">
          <MessageSquare aria-hidden="true" className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">Join the conversation</p>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to comment on this chapter.</p>
          <Button
            asChild
            size="sm"
            className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      )}

      {commentsQuery.isLoading ? (
        <ul className="flex flex-col gap-5" aria-busy="true" aria-label="Loading comments">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex animate-pulse gap-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-surface" />
              <div className="flex-1">
                <div className="h-3 w-32 rounded bg-surface" />
                <div className="mt-2 h-3 w-full rounded bg-surface" />
                <div className="mt-1.5 h-3 w-4/5 rounded bg-surface" />
              </div>
            </li>
          ))}
        </ul>
      ) : commentsQuery.isError ? (
        <ErrorState
          title="Comments couldn't load"
          message="We couldn't reach the comment thread. Check your connection and try again."
          onRetry={() => {
            void commentsQuery.refetch();
          }}
        />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          message="Be the first reader to react to this chapter."
        />
      ) : (
        <ul className="flex flex-col gap-6">
          {comments.map((comment) => {
            const isOwn = Boolean(user) && user?.id === comment.user_id;
            const isOptimistic = comment.id.startsWith("optimistic-");
            const isConfirming = confirmingDeleteId === comment.id;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === comment.id;

            return (
              <li key={comment.id} className="flex gap-3">
                <Avatar className="mt-0.5 h-9 w-9 border border-neutral-800 bg-surface">
                  {comment.profile?.avatar_url ? (
                    <AvatarImage src={comment.profile.avatar_url} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-surface text-[11px] font-semibold text-foreground">
                    {initialsFromName(comment.profile?.display_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-foreground">
                      {comment.profile?.display_name ?? "Reader"}
                    </span>
                    <time
                      dateTime={comment.created_at}
                      title={formatCalendarDate(comment.created_at)}
                      className="text-[11px] text-muted-foreground"
                    >
                      {isOptimistic ? "Posting…" : formatRelativeDate(comment.created_at)}
                    </time>
                    {isOwn ? (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                        You
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                    {comment.content}
                  </p>

                  {!isOptimistic && votesAvailable ? (
                    <CommentVotes
                      tally={voteTallies.get(comment.id) ?? { likes: 0, dislikes: 0, mine: 0 }}
                      disabled={!user || isOwn || voteMutation.isPending}
                      onVote={(value) => voteMutation.mutate({ commentId: comment.id, value })}
                    />
                  ) : null}

                  {isOwn && !isOptimistic ? (
                    <div className="mt-1.5 flex items-center gap-3">
                      {isConfirming ? (
                        <span
                          role="group"
                          aria-label="Confirm deletion"
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="text-muted-foreground">Delete this comment?</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => deleteMutation.mutate(comment.id)}
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            {isDeleting ? "Deleting…" : "Delete"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingDeleteId(null)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:bg-surface hover:text-foreground"
                          >
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(comment.id)}
                          aria-label="Delete your comment"
                          className="inline-flex items-center gap-1 rounded-sm text-[11px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                        >
                          <Trash2 aria-hidden="true" className="h-3 w-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
