import { supabase } from "@/integrations/supabase/client";

/** Longest slug we accept. Keeps URLs readable and safely under URL limits. */
export const MAX_SLUG_LENGTH = 80;

/** Lowercase alphanumeric segments separated by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Characters that do not decompose under `NFKD` but have a sensible ASCII
 * equivalent (common in French / Nordic / German titles).
 */
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ß: "ss",
};

/**
 * Turn a human title into a URL-safe slug.
 *
 * Handles accents (`é` → `e`), ligatures (`œ` → `oe`), punctuation and repeated
 * separators. The result always matches {@link SLUG_PATTERN} unless it is empty.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[æœøłđðþß]/g, (character) => TRANSLITERATIONS[character] ?? character)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/** Human readable validation error for a slug, or `null` when it is valid. */
export function slugError(slug: string): string | null {
  const value = slug.trim();
  if (!value) return "A URL slug is required.";
  if (value.length > MAX_SLUG_LENGTH) {
    return `Keep the slug under ${MAX_SLUG_LENGTH} characters.`;
  }
  if (!SLUG_PATTERN.test(value)) {
    return "Use lowercase letters, numbers and single hyphens (e.g. my-series).";
  }
  return null;
}

/**
 * Whether another series already uses this slug.
 *
 * RLS can hide drafts that belong to other authors, so a `false` result is not
 * a hard guarantee — inserts are still guarded against unique violations.
 */
export async function isSlugTaken(slug: string, excludeSeriesId?: string): Promise<boolean> {
  let query = supabase.from("series").select("id").eq("slug", slug).limit(1);
  if (excludeSeriesId) query = query.neq("id", excludeSeriesId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not check that slug — ${error.message}`);
  return (data ?? []).length > 0;
}
