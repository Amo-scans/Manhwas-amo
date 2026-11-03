import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type SeriesRow = Tables["series"]["Row"];
export type ChapterRow = Tables["chapters"]["Row"];
export type PanelRow = Tables["panels"]["Row"];
export type CommentRow = Tables["comments"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];

export type ProfileSummary = Pick<ProfileRow, "display_name" | "avatar_url">;
export type CommentWithProfile = CommentRow & { profile: ProfileSummary | null };
export type SeriesRef = Pick<SeriesRow, "slug" | "title" | "cover_url">;
export type LatestChapter = Pick<ChapterRow, "id" | "number" | "title" | "created_at"> & {
  series: SeriesRef;
};
export type ChapterNeighbors = {
  previous: number | null;
  next: number | null;
  total: number;
};

export const STORAGE_BUCKET = "manhwa";
/** Number of latest chapter releases surfaced on the home page. */
export const LATEST_RELEASES_LIMIT = 8;

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context} — ${error.message}`);
}

function ensure<T>(
  data: T | null | undefined,
  error: { message: string } | null,
  context: string,
): T {
  if (error) fail(context, error);
  if (data == null) throw new Error(`${context} — empty response`);
  return data;
}

/** Same as `ensure`, but a missing row is a valid outcome (e.g. `maybeSingle`). */
function ensureMaybe<T>(
  data: T | null | undefined,
  error: { message: string } | null,
  context: string,
): T | null {
  if (error) fail(context, error);
  return data ?? null;
}

/* ------------------------------------------------------------------ */
/* Reads                                                              */
/* ------------------------------------------------------------------ */

export async function fetchPublishedSeries(): Promise<SeriesRow[]> {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) fail("Could not load series", error);
  return data ?? [];
}

export async function fetchFeaturedSeries(): Promise<SeriesRow | null> {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("published", true)
    .eq("featured", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ensureMaybe(data, error, "Could not load the featured series");
}

export async function fetchSeriesBySlug(slug: string): Promise<SeriesRow | null> {
  const { data, error } = await supabase.from("series").select("*").eq("slug", slug).maybeSingle();
  return ensureMaybe(data, error, "Could not load this series");
}

export async function fetchChapters(seriesId: string, onlyPublished = true): Promise<ChapterRow[]> {
  let query = supabase.from("chapters").select("*").eq("series_id", seriesId);
  if (onlyPublished) query = query.eq("published", true);
  const { data, error } = await query.order("number", { ascending: false });
  if (error) fail("Could not load chapters", error);
  return data ?? [];
}

export async function fetchChapterByNumber(
  seriesId: string,
  number: number,
): Promise<ChapterRow | null> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("series_id", seriesId)
    .eq("number", number)
    .maybeSingle();
  return ensureMaybe(data, error, "Could not load this chapter");
}

export async function fetchPanels(chapterId: string): Promise<PanelRow[]> {
  const { data, error } = await supabase
    .from("panels")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: true });
  if (error) fail("Could not load panels", error);
  return data ?? [];
}

/**
 * Latest published chapters across every published series.
 * Uses an inner join so drafts (series or chapter) never leak into the list.
 */
export async function fetchLatestChapters(limit = LATEST_RELEASES_LIMIT): Promise<LatestChapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, number, title, created_at, series!inner(slug, title, cover_url)")
    .eq("published", true)
    .eq("series.published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Could not load latest releases", error);
  return (data ?? []) as unknown as LatestChapter[];
}

export async function fetchChapterNeighbors(
  seriesId: string,
  number: number,
): Promise<ChapterNeighbors> {
  const { data, error } = await supabase
    .from("chapters")
    .select("number")
    .eq("series_id", seriesId)
    .eq("published", true)
    .order("number", { ascending: true });
  if (error) fail("Could not load chapter navigation", error);
  const numbers = (data ?? []).map((row) => row.number);
  const index = numbers.indexOf(number);
  return {
    previous: index > 0 ? numbers[index - 1] : null,
    next: index >= 0 && index < numbers.length - 1 ? numbers[index + 1] : null,
    total: numbers.length,
  };
}

/**
 * Comments for one episode, enriched with the author profile.
 *
 * `comments.user_id` and `profiles.id` both point at `auth.users`, so there is no
 * PostgREST relationship to embed — profiles are fetched in a second round trip.
 */
export async function fetchComments(slug: string, episode: number): Promise<CommentWithProfile[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("series_slug", slug)
    .eq("episode", episode)
    .order("created_at", { ascending: false });
  if (error) fail("Could not load comments", error);

  const comments = data ?? [];
  if (comments.length === 0) return [];

  const userIds = [...new Set(comments.map((comment) => comment.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  // A profile lookup failure must not hide the comments themselves.
  if (profilesError) console.warn("[comments] profiles unavailable", profilesError.message);
  const byId = new Map<string, ProfileSummary>(
    (profiles ?? []).map((profile) => [
      profile.id,
      { display_name: profile.display_name, avatar_url: profile.avatar_url },
    ]),
  );

  return comments.map((comment) => ({
    ...comment,
    profile: byId.get(comment.user_id) ?? null,
  }));
}

/** Public URL for an object stored in the `manhwa` bucket (accepts an absolute URL too). */
export function publicImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ------------------------------------------------------------------ */
/* React Query options                                                */
/* ------------------------------------------------------------------ */

export const seriesListQueryOptions = () =>
  queryOptions({
    queryKey: ["series", "published"],
    queryFn: fetchPublishedSeries,
  });

export const featuredSeriesQueryOptions = () =>
  queryOptions({
    queryKey: ["series", "featured"],
    queryFn: fetchFeaturedSeries,
  });

export const seriesBySlugQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["series", slug],
    queryFn: () => fetchSeriesBySlug(slug),
    enabled: Boolean(slug),
  });

export const chaptersQueryOptions = (seriesId: string | undefined, onlyPublished = true) =>
  queryOptions({
    queryKey: ["chapters", seriesId, { onlyPublished }],
    queryFn: () => fetchChapters(seriesId as string, onlyPublished),
    enabled: Boolean(seriesId),
  });

export const chapterByNumberQueryOptions = (seriesId: string | undefined, number: number) =>
  queryOptions({
    queryKey: ["chapter", seriesId, number],
    queryFn: () => fetchChapterByNumber(seriesId as string, number),
    enabled: Boolean(seriesId) && Number.isFinite(number),
  });

export const panelsQueryOptions = (chapterId: string | undefined) =>
  queryOptions({
    queryKey: ["panels", chapterId],
    queryFn: () => fetchPanels(chapterId as string),
    enabled: Boolean(chapterId),
  });

export const latestChaptersQueryOptions = (limit = LATEST_RELEASES_LIMIT) =>
  queryOptions({
    queryKey: ["chapters", "latest", limit],
    queryFn: () => fetchLatestChapters(limit),
  });

export const chapterNeighborsQueryOptions = (seriesId: string | undefined, number: number) =>
  queryOptions({
    queryKey: ["chapter-neighbors", seriesId, number],
    queryFn: () => fetchChapterNeighbors(seriesId as string, number),
    enabled: Boolean(seriesId) && Number.isFinite(number),
  });

export const commentsQueryOptions = (slug: string, episode: number) =>
  queryOptions({
    queryKey: ["comments", slug, episode],
    queryFn: () => fetchComments(slug, episode),
    enabled: Boolean(slug) && Number.isFinite(episode),
  });
