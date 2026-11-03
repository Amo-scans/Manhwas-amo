/**
 * Centralised SEO helpers.
 *
 * Set `VITE_SITE_URL` at build time (e.g. `https://<user>.github.io/<repo>`) so
 * canonical / Open Graph URLs are absolute, as required by crawlers.
 * When unset we fall back to the canonical GitHub Pages location of the project.
 */

export const SITE_NAME = "AMO-SCANS-FR";
export const SITE_TAGLINE = "Original manhwa, read vertically.";
export const SITE_DESCRIPTION =
  "Read original manhwa series published by AMO-SCANS-FR: cinematic dark fantasy webcomics, vertical-scroll reader, new chapters every week.";

const FALLBACK_SITE_URL = "https://assia123y.github.io/amo-scans-fr";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const SITE_URL = trimTrailingSlash(
  (import.meta.env.VITE_SITE_URL as string | undefined) || FALLBACK_SITE_URL,
);

/** Absolute URL for a route path (path must start with `/`). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute URL for the default social preview image (1200×630 JPEG). */
export function socialImageUrl(path = "/og-image.jpg"): string {
  return absoluteUrl(path);
}

export type PageMetaInput = {
  title: string;
  description: string;
  /** Route path, used for `og:url` and `canonical`. */
  path: string;
  image?: string;
  type?: "website" | "article" | "book" | "profile";
  noindex?: boolean;
  publishedAt?: string;
};

export type MetaEntry =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

/**
 * Build the full meta descriptor list for a page. Routes spread the result in
 * their `head().meta` array:
 *
 * ```ts
 * head: () => ({ meta: buildPageMeta({ ... }), links: [...] })
 * ```
 */
export function buildPageMeta({
  title,
  description,
  path,
  image = "/og-image.jpg",
  type = "website",
  noindex = false,
  publishedAt,
}: PageMetaInput): MetaEntry[] {
  const url = absoluteUrl(path);
  const meta: MetaEntry[] = [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:image", content: absoluteUrl(image) },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: absoluteUrl(image) },
  ];

  if (publishedAt) {
    meta.push({ property: "article:published_time", content: publishedAt });
  }
  if (noindex) {
    meta.push({ name: "robots", content: "noindex,nofollow" });
  }

  return meta;
}

/** Canonical link descriptor (relative is fine once `og:url` is absolute). */
export function canonicalLink(path: string) {
  return { rel: "canonical", href: path };
}

/** Turn `the-last-sovereign-of-void` into `The Last Sovereign Of Void`. */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
