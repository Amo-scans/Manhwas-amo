import { Link } from "@tanstack/react-router";

import { SITE_NAME } from "@/lib/seo";

const SUPPORT_EMAIL = "support@amo-scans.fr";

const exploreLinks = [
  { to: "/", label: "Library" },
  { to: "/schedule", label: "Release schedule" },
  { to: "/about", label: "About the studio" },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-neutral-900 bg-base">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link
              to="/"
              className="rounded-sm text-sm font-semibold uppercase tracking-tighter text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              {SITE_NAME}
            </Link>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Original manhwa, written and drawn in-house. Cinematic dark fantasy published in
              vertical-scroll episodes, one arc at a time.
            </p>
          </div>

          <nav aria-labelledby="footer-explore">
            <h2
              id="footer-explore"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Explore
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {exploreLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Contact
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                >
                  Support
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Series suggestion")}`}
                  className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                >
                  Suggest a series
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Bug report")}`}
                  className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                >
                  Report a bug
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-neutral-900 pt-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE_NAME}. All rights reserved.
          </p>
          <p className="text-muted-foreground/70">Built for vertical reading.</p>
        </div>
      </div>
    </footer>
  );
}
