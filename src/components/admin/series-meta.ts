/** Shared series metadata used by the studio list, the create form and the editor. */

export const SERIES_STATUS_OPTIONS = [
  { value: "ongoing", label: "Ongoing", description: "New chapters are being released." },
  { value: "completed", label: "Completed", description: "The story is finished." },
  { value: "hiatus", label: "Hiatus", description: "Paused for now." },
] as const;

export type SeriesStatus = (typeof SERIES_STATUS_OPTIONS)[number]["value"];

const STATUS_LABELS: Readonly<Record<string, string>> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "Hiatus",
  cancelled: "Cancelled",
};

/** Human label for any stored status value (unknown values are shown as-is). */
export function seriesStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Deterministic date formatting (identical on the server and in the browser). */
export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
}
