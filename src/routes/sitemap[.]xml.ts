import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/seo";

type SitemapEntry = {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

/** Escape XML text nodes (series slugs are user-supplied). */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function collectEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/schedule", changefreq: "weekly", priority: "0.5" },
    { path: "/about", changefreq: "monthly", priority: "0.3" },
  ];

  const { data: series, error } = await supabase
    .from("series")
    .select("id, slug, updated_at")
    .eq("published", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const item of series ?? []) {
    entries.push({
      path: `/series/${item.slug}`,
      lastmod: item.updated_at,
      changefreq: "weekly",
      priority: "0.8",
    });

    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("number, created_at")
      .eq("series_id", item.id)
      .eq("published", true);
    if (chaptersError) throw new Error(chaptersError.message);

    for (const chapter of chapters ?? []) {
      entries.push({
        path: `/read/${item.slug}/${chapter.number}`,
        lastmod: chapter.created_at,
        changefreq: "monthly",
        priority: "0.6",
      });
    }
  }

  return entries;
}

function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) =>
    [
      "  <url>",
      `    <loc>${xmlEscape(`${SITE_URL}${entry.path}`)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let entries: SitemapEntry[];
        try {
          entries = await collectEntries();
        } catch (error) {
          // A database hiccup must not take the whole sitemap down.
          console.error("Sitemap dynamic entries failed", error);
          entries = [
            { path: "/", changefreq: "daily", priority: "1.0" },
            { path: "/schedule", changefreq: "weekly", priority: "0.5" },
            { path: "/about", changefreq: "monthly", priority: "0.3" },
          ];
        }

        return new Response(renderSitemap(entries), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
