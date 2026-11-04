import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type ReactionKind = Database["public"]["Enums"]["reaction_kind"];
export type ChapterReactionRow = Tables["chapter_reactions"]["Row"];
export type CommentVoteRow = Pick<
  Tables["comment_votes"]["Row"],
  "comment_id" | "user_id" | "value"
>;
export type CommentVoteValue = 1 | -1;

export const REACTIONS: ReadonlyArray<{ kind: ReactionKind; emoji: string; label: string }> = [
  { kind: "like", emoji: "👍", label: "Like" },
  { kind: "love", emoji: "❤️", label: "Love" },
  { kind: "haha", emoji: "😂", label: "Haha" },
  { kind: "wow", emoji: "😮", label: "Wow" },
  { kind: "sad", emoji: "😢", label: "Sad" },
  kind: "fire", emoji: "🔥", label: "Fire" },
];

export function emptyReactionCounts(): Record<ReactionKind, number> {
  return { like: 0, love: 0, haha: 0, wow: 0, sad: 0, fire: 0 };
}

/** O(1) lookup of a reaction's display metadata (emoji + label) from its kind. */
export const REACTION_BY_KIND = Object.fromEntries(
  REACTIONS.map((reaction) => [reaction.kind, { emoji: reaction.emoji, label: reaction.label }]),
) as unknown as Readonly<Record<ReactionKind, { emoji: string; label: string }>>;

/* ------------------------------------------------------------------ */
/* Chapter reactions                                                  */
/* ------------------------------------------------------------------ */

export async function fetchChapterReactions(chapterId: string): Promise<ChapterReactionRow[]> {
  const { data, error } = await supabase
    .from("chapter_reactions")
    .select("*")
    .eq("chapter_id", chapterId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const chapterReactionsQueryOptions = (chapterId: string | undefined) =>
  queryOptions({
    queryKey: ["chapter-reactions", chapterId],
    queryFn: () => fetchChapterReactions(chapterId as string),
    enabled: Boolean(chapterId),
    // A missing table (migration not applied yet) must not break the reader.
    retry: false,
    staleTime: 30_000,
  });

export async function setChapterReaction(
  chapterId: string,
  userId: string,
  reaction: ReactionKind | null,
): Promise<void> {
  if (reaction === null) {
    const { error } = await supabase
      .from("chapter_reactions")
      .delete()
      .eq("chapter_id", chapterId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("chapter_reactions")
    .upsert(
      { chapter_id: chapterId, user_id: userId, reaction },
      { onConflict: "chapter_id,user_id" },
    );
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Comment votes                                                      */
/* ------------------------------------------------------------------ */

export async function fetchCommentVotes(commentIds: string[]): Promise<CommentVoteRow[]> {
  if (commentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("comment_votes")
    .select("comment_id,user_id,value")
    .in("comment_id", commentIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    comment_id: row.comment_id,
    user_id: row.user_id,
    value: row.value,
  }));
}

export const commentVotesQueryOptions = (commentIds: string[]) =>
  queryOptions({
    queryKey: ["comment-votes", [...commentIds].sort()],
    queryFn: () => fetchCommentVotes(commentIds),
    enabled: commentIds.length > 0,
    retry: false,
    staleTime: 30_000,
  });

export async function setCommentVote(
  commentId: string,
  userId: string,
  value: CommentVoteValue | null,
): Promise<void> {
  if (value === null) {
    const { error } = await supabase
      .from("comment_votes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("comment_votes")
    .upsert(
      { comment_id: commentId, user_id: userId, value },
      { onConflict: "comment_id,user_id" },
    );
  if (error) throw new Error(error.message);
}

export type CommentVoteTally = { likes: number; dislikes: number; mine: CommentVoteValue | 0 };

export function tallyCommentVotes(
  votes: CommentVoteRow[],
  userId: string | undefined,
): Map<string, CommentVoteTally> {
  const tallies = new Map<string, CommentVoteTally>();
  for (const vote of votes) {
    const current = tallies.get(vote.comment_id) ?? { likes: 0, dislikes: 0, mine: 0 };
    if (vote.value === 1) current.likes += 1;
    else if (vote.value === -1) current.dislikes += 1;
    if (userId && vote.user_id === userId && (vote.value === 1 || vote.value === -1)) {
      current.mine = vote.value;
    }
    tallies.set(vote.comment_id, current);
  }
  return tallies;
}
