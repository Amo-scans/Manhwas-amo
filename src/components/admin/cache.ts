import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate every public cache that displays series metadata (home page
 * featured hero, library grid, series page, sitemap…).
 */
export async function invalidateSeriesCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["series"] }),
    queryClient.invalidateQueries({ queryKey: ["featured"] }),
  ]);
}

/**
 * Invalidate chapter related caches: admin chapter list, public chapter list,
 * single chapter and reader navigation (plus the home "latest releases" feed,
 * which lives under the `chapters` prefix).
 *
 * The `chapters_touch_series` trigger bumps the parent series' `updated_at`, so
 * series caches are refreshed too (admin header date, library ordering).
 */
export async function invalidateChapterCaches(
  queryClient: QueryClient,
  seriesId?: string,
): Promise<void> {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: ["chapters"] }),
    queryClient.invalidateQueries({ queryKey: ["chapter"] }),
    queryClient.invalidateQueries({ queryKey: ["chapter-neighbors"] }),
    queryClient.invalidateQueries({ queryKey: ["series"] }),
    queryClient.invalidateQueries({ queryKey: ["featured"] }),
  ];
  if (seriesId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["admin", "chapters", seriesId] }));
  }
  await Promise.all(tasks);
}

/** Invalidate the pages of a chapter (admin panel manager + public reader). */
export async function invalidatePanelCaches(
  queryClient: QueryClient,
  chapterId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["panels", chapterId] }),
    queryClient.invalidateQueries({ queryKey: ["panels"] }),
  ]);
}

/** Invalidate the studio dashboard's series list. */
export async function invalidateAdminSeriesList(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ["admin", "series"] });
}
