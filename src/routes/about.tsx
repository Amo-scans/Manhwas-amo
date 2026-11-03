import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Keyboard, Mail, Palette, PenLine } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  absoluteUrl,
  buildPageMeta,
  canonicalLink,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

const SUPPORT_EMAIL = "support@amo-scans.fr";

const pillars = [
  {
    icon: PenLine,
    title: "Story first",
    body: "Every arc starts as a written outline — stakes, twists, quiet character beats — before a single panel is drawn.",
  },
  {
    icon: Palette,
    title: "One hand, one vision",
    body: "Writing, pencils, inks, colour and lettering are all done in-house. No assembly line, no shift hand-offs.",
  },
  {
    icon: CalendarDays,
    title: "A weekly rhythm",
    body: "Episodes ship on a weekly cadence. When a chapter needs more time, it gets more time — quality over quotas.",
  },
] as const;

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: buildPageMeta({
      title: `About — ${SITE_NAME}`,
      description:
        "AMO-SCANS-FR is a solo manhwa studio: original dark fantasy webcomics written, drawn and lettered in-house.",
      path: "/about",
    }),
    links: [canonicalLink("/about")],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: `About ${SITE_NAME}`,
          url: absoluteUrl("/about"),
          description: SITE_DESCRIPTION,
          inLanguage: "en",
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
          about: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
          },
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-base">
      <SiteNav />

      <main id="main-content">
        <section aria-labelledby="about-heading" className="border-b border-neutral-800/60">
          <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              About
            </p>
            <h1
              id="about-heading"
              className="mt-4 text-balance font-display text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl"
            >
              A solo studio, drawing into the late hours.
            </h1>
            <div className="mt-6 space-y-4 text-pretty leading-relaxed text-muted-foreground">
              <p>
                {SITE_NAME} is the publishing home for original manhwa. Every series here is
                written, illustrated, lettered and shipped by one person — from the first outline to
                the last sound effect.
              </p>
              <p>
                No licensed catalogue, no reposts. Just original stories built for vertical scroll:
                wide establishing shots, deliberate silence, and panels that hit when you reach
                them.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                <Link to="/">
                  Start reading <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
              >
                <Link to="/schedule">See the release schedule</Link>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="craft-heading" className="border-b border-neutral-800/60">
          <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
            <h2
              id="craft-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent"
            >
              The craft
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {pillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <article
                    key={pillar.title}
                    className="rounded-xl border border-neutral-800/60 bg-surface/30 p-6"
                  >
                    <Icon aria-hidden="true" className="h-5 w-5 text-accent" />
                    <h3 className="mt-4 text-base font-medium tracking-tight text-foreground">
                      {pillar.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {pillar.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-labelledby="reading-heading" className="border-b border-neutral-800/60">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <h2
              id="reading-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent"
            >
              How to read
            </h2>
            <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
              The reader is built for immersion: no sidebars, no ads, no interruptions. A few things
              that make it smoother.
            </p>
            <ol className="mt-8 space-y-6">
              <li className="flex gap-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-surface text-xs font-semibold text-accent">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Scroll, don't tap</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Episodes are one continuous vertical strip. Scroll at your own pace; the
                    progress bar above the reader tracks how far you are.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-surface text-xs font-semibold text-accent">
                  2
                </span>
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    Keyboard shortcuts
                    <Keyboard aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Press{" "}
                    <kbd className="rounded border border-neutral-800 bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      ←
                    </kbd>{" "}
                    and{" "}
                    <kbd className="rounded border border-neutral-800 bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      →
                    </kbd>{" "}
                    to jump between chapters, or use the chapter picker in the reader toolbar.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-surface text-xs font-semibold text-accent">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Pick up where you left off
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    The last chapter you opened is remembered on this device, so each series page
                    can offer a direct “continue reading” link.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section aria-labelledby="support-heading" className="border-b border-neutral-800/60">
          <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
            <h2
              id="support-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent"
            >
              Support the work
            </h2>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              There is no subscription and no paywall. If the stories resonate, the best support is
              attention — and telling someone else.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-neutral-800/60 bg-surface/30 p-6">
                <h3 className="text-sm font-medium text-foreground">Keep reading</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Every read tells the studio the series is worth continuing.
                </p>
                <Link
                  to="/"
                  className="mt-4 inline-flex items-center gap-1 rounded-sm text-xs font-medium uppercase tracking-widest text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Library <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="rounded-xl border border-neutral-800/60 bg-surface/30 p-6">
                <h3 className="text-sm font-medium text-foreground">Share an episode</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Send a chapter link to someone who would enjoy a slow-burn dark fantasy.
                </p>
                <Link
                  to="/schedule"
                  className="mt-4 inline-flex items-center gap-1 rounded-sm text-xs font-medium uppercase tracking-widest text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  What's next <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="rounded-xl border border-neutral-800/60 bg-surface/30 p-6">
                <h3 className="text-sm font-medium text-foreground">Write to the studio</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Feedback, bug reports and series suggestions are all read personally.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="mt-4 inline-flex items-center gap-1 rounded-sm text-xs font-medium uppercase tracking-widest text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Mail aria-hidden="true" className="h-3.5 w-3.5" /> Contact
                </a>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="rounded-2xl border border-neutral-800/60 bg-gradient-to-br from-surface/70 via-surface/30 to-base px-8 py-12 text-center">
            <h2
              id="cta-heading"
              className="text-balance font-display text-2xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              Pick a series and fall into it.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              Every story is free, complete as it ships, and best read in one sitting.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                <Link to="/">
                  Browse the library <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-neutral-800 bg-base/60 text-foreground hover:bg-surface"
              >
                <Link to="/schedule">Release schedule</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
