import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", label: "Library", exact: true },
  { to: "/schedule", label: "Schedule", exact: false },
  { to: "/about", label: "About", exact: false },
] as const;

const desktopLinkClass =
  "relative rounded-sm px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base";

const desktopLinkActiveClass =
  "relative rounded-sm px-1 py-0.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base after:absolute after:inset-x-0 after:-bottom-[7px] after:h-px after:bg-accent after:content-['']";

const mobileLinkClass =
  "flex items-center rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset";

const mobileLinkActiveClass =
  "flex items-center rounded-md bg-surface px-3 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset";

/** Two-letter initials from the account email, e.g. "amo.reader@mail.co" -> "AR". */
function initialsFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const raw =
    parts.length >= 2
      ? `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`
      : local.slice(0, 2);
  return raw ? raw.toUpperCase() : "?";
}

export function SiteNav() {
  const { user, signOut, loading, isAuthor } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const initials = initialsFromEmail(user?.email);
  const avatarUrl = (user?.user_metadata as { avatar_url?: unknown } | undefined)?.avatar_url;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-200",
        scrolled
          ? "border-neutral-800 bg-base/95 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]"
          : "border-neutral-800/50 bg-base/80",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-xs focus:font-medium focus:text-accent-foreground"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6 lg:gap-8">
          <Link
            to="/"
            className="shrink-0 rounded-sm text-sm font-semibold uppercase tracking-tighter text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            AMO-SCANS-FR
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: link.exact }}
                className={desktopLinkClass}
                activeProps={{ className: desktopLinkActiveClass }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthor ? (
            <Link
              to="/admin"
              className="hidden rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base sm:inline-flex"
            >
              Admin
            </Link>
          ) : null}

          {loading ? (
            <div
              aria-hidden="true"
              className="h-8 w-8 animate-pulse rounded-full bg-surface sm:h-8 sm:w-20 sm:rounded-full"
            />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                >
                  <Avatar className="h-8 w-8 border border-neutral-800 bg-surface">
                    {typeof avatarUrl === "string" ? <AvatarImage src={avatarUrl} alt="" /> : null}
                    <AvatarFallback className="bg-surface text-[11px] font-semibold text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-60 border-neutral-800 bg-surface text-foreground"
              >
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user.email ?? "Signed in"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-800" />
                {isAuthor ? (
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-neutral-800/60">
                    <Link to="/admin">Studio admin</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => {
                    void signOut();
                  }}
                  className="cursor-pointer text-muted-foreground focus:bg-neutral-800/60 focus:text-foreground"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              className="inline-flex h-8 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground ring-1 ring-accent/60 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              Sign in
            </Link>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-800 bg-surface/60 text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base md:hidden"
              >
                <Menu aria-hidden="true" className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent
              id="mobile-nav"
              side="right"
              className="w-72 border-neutral-800 bg-base px-5"
            >
              <SheetHeader className="text-left">
                <SheetTitle className="text-sm font-semibold uppercase tracking-tighter text-foreground">
                  AMO-SCANS-FR
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Site navigation and account actions
                </SheetDescription>
              </SheetHeader>

              <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    activeOptions={{ exact: link.exact }}
                    onClick={closeMobile}
                    className={mobileLinkClass}
                    activeProps={{ className: mobileLinkActiveClass }}
                  >
                    {link.label}
                  </Link>
                ))}
                {isAuthor ? (
                  <Link
                    to="/admin"
                    onClick={closeMobile}
                    className="flex items-center rounded-md px-3 py-2.5 text-sm text-accent transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  >
                    Admin studio
                  </Link>
                ) : null}
              </nav>

              <div className="mt-6 border-t border-neutral-800 pt-5">
                {user ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-neutral-800 bg-surface">
                        {typeof avatarUrl === "string" ? (
                          <AvatarImage src={avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="bg-surface text-xs font-semibold text-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <p className="min-w-0 truncate text-xs text-muted-foreground">
                        {user.email ?? "Signed in"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        closeMobile();
                        void signOut();
                      }}
                      className="h-9 rounded-md border border-neutral-800 bg-surface text-xs font-medium text-foreground transition-colors hover:bg-neutral-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/auth"
                    onClick={closeMobile}
                    className="flex h-10 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
