/**
 * Small date helpers shared by the public pages.
 *
 * All values come from Postgres as ISO strings; `parseISO` + `isValid` keep a
 * malformed value from crashing a whole page.
 */
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

/** "3 hours ago" / "in 2 days" — "Unknown date" when the value is unusable. */
export function formatRelativeDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "Unknown date";
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 45_000) return "Just now";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** "Apr 12, 2025" — stable, human date for chapter lists and metadata. */
export function formatCalendarDate(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "MMM d, yyyy") : "—";
}

/** "Monday" — used to group releases by weekday on the schedule page. */
export function formatWeekday(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "EEEE") : "Unscheduled";
}
