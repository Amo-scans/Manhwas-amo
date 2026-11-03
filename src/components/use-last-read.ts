import { useEffect, useState } from "react";

export type LastRead = {
  /** Chapter number the reader last opened for this series. */
  number: number;
  /** Epoch milliseconds, so the series page can show "resume where you left off". */
  readAt: number;
};

const KEY_PREFIX = "amo-scans:last-read:";

function storageKey(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function readLastRead(slug: string): LastRead | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const number = record.number;
    if (typeof number !== "number" || !Number.isFinite(number)) return null;
    const readAt = typeof record.readAt === "number" ? record.readAt : 0;
    return { number, readAt };
  } catch {
    // Storage can be blocked (private mode) or contain stale/corrupt JSON.
    return null;
  }
}

/** Persist "last chapter read" for a series. Safe to call on every chapter view. */
export function markChapterRead(slug: string, number: number): void {
  if (typeof window === "undefined" || !Number.isFinite(number)) return;
  try {
    const payload: LastRead = { number, readAt: Date.now() };
    window.localStorage.setItem(storageKey(slug), JSON.stringify(payload));
  } catch {
    // Ignore quota/security errors — reading must keep working.
  }
}

/**
 * Read the last chapter opened for `slug` from localStorage.
 *
 * The value is resolved in an effect (never during render) so server markup and
 * the first client render stay identical — no hydration mismatch.
 */
export function useLastRead(slug: string): LastRead | null {
  const [lastRead, setLastRead] = useState<LastRead | null>(null);

  useEffect(() => {
    setLastRead(readLastRead(slug));
  }, [slug]);

  return lastRead;
}
