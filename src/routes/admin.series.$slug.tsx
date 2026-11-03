import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  chaptersQueryOptions,
  seriesBySlugQueryOptions,
  type ChapterRow,
  type SeriesRow,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ChapterEditor } from "@/components/admin/chapter-editor";
import { ImageField } from "@/components/admin/image-field";
import { TagInput } from "@/components/admin/tag-input";
import {
  invalidateAdminSeriesList,
  invalidateChapterCaches,
  invalidateSeriesCaches,
} from "@/components/admin/cache";
import { MAX_SLUG_LENGTH, isSlugTaken, slugError } from "@/components/admin/slug";
import {
  SERIES_STATUS_OPTIONS,
  formatDate,
  seriesStatusLabel,
} from "@/components/admin/series-meta";
import type { UploadedImage } from "@/components/admin/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/series/$slug")({
  component: EditSeries,
});

const MAX_TITLE_LENGTH = 160;
const MAX_GENRE_LENGTH = 80;
const MAX_SYNOPSIS_LENGTH = 5000;
const MAX_CHAPTER_TITLE_LENGTH = 120;

type SlugStatus = "idle" | "checking" | "available" | "taken" | "error";

function formatUpdatedAt(value: string): string {
  return `Updated ${formatDate(value)}`;
}

function EditSeries() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const userId = user?.id;

  const seriesQuery = useQuery(seriesBySlugQueryOptions(slug));
  const series = seriesQuery.data;
  const seriesId = series?.id;

  const chaptersQuery = useQuery(chaptersQueryOptions(seriesId, false));
  const chapters = useMemo(() => chaptersQuery.data ?? [], [chaptersQuery.data]);

  /* Draft fields (synced to the server value when a different series loads). */
  const [titleDraft, setTitleDraft] = useState("");
  const [genreDraft, setGenreDraft] = useState("");
  const [synopsisDraft, setSynopsisDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);
  const [slugDraft, setSlugDraft] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugSaving, setSlugSaving] = useState(false);
  const [tagsSaving, setTagsSaving] = useState(false);
  const [synopsisSaving, setSynopsisSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [publishSaving, setPublishSaving] = useState(false);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [publishedValue, setPublishedValue] = useState<boolean | null>(null);
  const [featuredValue, setFeaturedValue] = useState<boolean | null>(null);

  const [newChapterNumber, setNewChapterNumber] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [addingChapter, setAddingChapter] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishAllOpen, setPublishAllOpen] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<ChapterRow | null>(null);
  const [seriesDeleteOpen, setSeriesDeleteOpen] = useState(false);

  useEffect(() => {
    if (!series) return;
    setTitleDraft(series.title);
    setGenreDraft(series.genre ?? "");
    setSynopsisDraft(series.synopsis ?? "");
    setTagsDraft(series.tags ?? []);
    setSlugDraft(series.slug);
    setSlugDirty(false);
    setSlugStatus("idle");
    setPublishedValue(null);
    setFeaturedValue(null);
    // Only reset the drafts when a different series is loaded — server refetches
    // after a save must not overwrite what the author is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series?.id]);

  /* Debounced slug availability check while the author edits the URL. */
  useEffect(() => {
    if (!series || !slugDirty) {
      setSlugStatus("idle");
      return;
    }
    if (slugError(slugDraft) || slugDraft === series.slug) {
      setSlugStatus("idle");
      return;
    }
    let cancelled = false;
    setSlugStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const taken = await isSlugTaken(slugDraft, series.id);
        if (!cancelled) setSlugStatus(taken ? "taken" : "available");
      } catch {
        if (!cancelled) setSlugStatus("error");
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slugDraft, slugDirty, series]);

  const nextChapterNumber = useMemo(
    () => chapters.reduce((max, chapter) => Math.max(max, chapter.number), 0) + 1,
    [chapters],
  );
  const chapterNumbers = useMemo(() => chapters.map((chapter) => chapter.number), [chapters]);
  const unpublishedCount = chapters.filter((chapter) => !chapter.published).length;

  const canManage = Boolean(series) && Boolean(userId) && (isAdmin || series?.author_id === userId);

  /* ------------------------------------------------------------------ */
  /* Mutations                                                          */
  /* ------------------------------------------------------------------ */

  const saveSeriesFields = async (
    patch: Partial<SeriesRow>,
    successMessage?: string,
  ): Promise<boolean> => {
    if (!series) return false;
    const { error } = await supabase.from("series").update(patch).eq("id", series.id);
    if (error) {
      toast.error(`Could not save — ${error.message}`);
      return false;
    }
    await invalidateSeriesCaches(queryClient);
    await invalidateAdminSeriesList(queryClient);
    if (successMessage) toast.success(successMessage);
    return true;
  };

  const saveTitle = async (next: string): Promise<boolean> => {
    if (!series) return false;
    if (next.length < 2) {
      toast.error("The title needs at least 2 characters.");
      return false;
    }
    return saveSeriesFields({ title: next }, "Title updated.");
  };

  const saveGenre = async (next: string): Promise<boolean> => {
    if (!series) return false;
    if (next.length > MAX_GENRE_LENGTH) {
      toast.error(`Keep the genre under ${MAX_GENRE_LENGTH} characters.`);
      return false;
    }
    return saveSeriesFields({ genre: next || null }, "Genre updated.");
  };

  const saveSlug = async () => {
    if (!series || !slugDirty || slugSaving) return;
    const next = slugDraft.trim();
    const validation = slugError(next);
    if (validation) {
      toast.error(validation);
      return;
    }
    if (next === series.slug) {
      setSlugDirty(false);
      return;
    }
    setSlugSaving(true);
    try {
      const taken = await isSlugTaken(next, series.id);
      if (taken) {
        setSlugStatus("taken");
        toast.error("That slug is already used by another series.");
        return;
      }
      const { error } = await supabase.from("series").update({ slug: next }).eq("id", series.id);
      if (error) {
        if (error.code === "23505") {
          setSlugStatus("taken");
          toast.error("That slug is already used by another series.");
          return;
        }
        throw new Error(error.message);
      }
      await invalidateSeriesCaches(queryClient);
      await invalidateAdminSeriesList(queryClient);
      setSlugDirty(false);
      setSlugStatus("idle");
      toast.success("Series URL updated — redirecting…");
      await queryClient.invalidateQueries({ queryKey: ["series", next] });
      navigate({ to: "/admin/series/$slug", params: { slug: next }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the slug.");
    } finally {
      setSlugSaving(false);
    }
  };

  const saveTags = async () => {
    if (!series || tagsSaving) return;
    const normalized = tagsDraft.map((tag) => tag.trim()).filter(Boolean);
    const current = (series.tags ?? []).join("|");
    if (normalized.join("|") === current) return;
    setTagsSaving(true);
    const ok = await saveSeriesFields({ tags: normalized }, "Tags saved.");
    if (!ok) setTagsDraft(series.tags ?? []);
    setTagsSaving(false);
  };

  const saveSynopsis = async () => {
    if (!series || synopsisSaving) return;
    const next = synopsisDraft.trim();
    if (next.length > MAX_SYNOPSIS_LENGTH) {
      toast.error(`Keep the synopsis under ${MAX_SYNOPSIS_LENGTH} characters.`);
      return;
    }
    setSynopsisSaving(true);
    const ok = await saveSeriesFields({ synopsis: next || null }, "Synopsis saved.");
    if (!ok) setSynopsisDraft(series.synopsis ?? "");
    setSynopsisSaving(false);
  };

  const saveStatus = async (value: string) => {
    if (!series || statusSaving) return;
    const match = SERIES_STATUS_OPTIONS.find((option) => option.value === value);
    if (!match || match.value === series.status) return;
    setStatusSaving(true);
    await saveSeriesFields({ status: match.value }, "Status updated.");
    setStatusSaving(false);
  };

  const togglePublished = async (next: boolean) => {
    if (!series || publishSaving) return;
    setPublishSaving(true);
    setPublishedValue(next);
    const ok = await saveSeriesFields(
      { published: next },
      next ? "Series published — readers can see it now." : "Series moved back to draft.",
    );
    if (!ok) setPublishedValue(null);
    setPublishSaving(false);
  };

  const toggleFeatured = async (next: boolean) => {
    if (!series || featureSaving) return;
    if (next && !(publishedValue ?? series.published)) {
      toast.warning("Featured series only appear on the home page once the series is published.");
    }
    setFeatureSaving(true);
    setFeaturedValue(next);
    const ok = await saveSeriesFields(
      { featured: next },
      next ? "Series featured on the home page." : "Series removed from the home hero.",
    );
    if (!ok) setFeaturedValue(null);
    setFeatureSaving(false);
  };

  const handleCoverUploaded = async (image: UploadedImage) => {
    const ok = await saveSeriesFields({ cover_url: image.url }, "Cover updated.");
    if (!ok)
      throw new Error("The image uploaded but its URL could not be saved. Please try again.");
  };

  const handleCoverRemoved = async () => {
    const ok = await saveSeriesFields({ cover_url: null }, "Cover removed.");
    if (!ok) throw new Error("Could not remove the cover. Please try again.");
  };

  const handleHeroUploaded = async (image: UploadedImage) => {
    const ok = await saveSeriesFields({ hero_url: image.url }, "Hero banner updated.");
    if (!ok) {
      throw new Error("The image uploaded but its URL could not be saved. Please try again.");
    }
  };

  const handleHeroRemoved = async () => {
    const ok = await saveSeriesFields({ hero_url: null }, "Hero banner removed.");
    if (!ok) throw new Error("Could not remove the hero banner. Please try again.");
  };

  const handleAddChapter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!series || addingChapter) return;
    setChapterError(null);

    const rawNumber = newChapterNumber.trim();
    const parsedNumber = rawNumber === "" ? nextChapterNumber : Number(rawNumber);
    if (
      !Number.isInteger(parsedNumber) ||
      parsedNumber < 1 ||
      (rawNumber !== "" && String(parsedNumber) !== rawNumber)
    ) {
      setChapterError("Enter a whole chapter number (1 or more).");
      return;
    }
    if (chapters.some((chapter) => chapter.number === parsedNumber)) {
      setChapterError(`Chapter ${parsedNumber} already exists.`);
      return;
    }

    setAddingChapter(true);
    try {
      const { error } = await supabase.from("chapters").insert({
        series_id: series.id,
        number: parsedNumber,
        title: newChapterTitle.trim() || null,
        published: false,
      });
      if (error) {
        if (error.code === "23505") {
          setChapterError(`Chapter ${parsedNumber} already exists.`);
          return;
        }
        throw new Error(error.message);
      }
      await invalidateChapterCaches(queryClient, series.id);
      setNewChapterNumber("");
      setNewChapterTitle("");
      toast.success(`Chapter ${parsedNumber} created as a draft.`);
    } catch (error) {
      setChapterError(error instanceof Error ? error.message : "Could not create the chapter.");
    } finally {
      setAddingChapter(false);
    }
  };

  const publishAllChapters = async () => {
    if (!series || publishingAll) return;
    setPublishingAll(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({ published: true })
        .eq("series_id", series.id)
        .eq("published", false);
      if (error) throw new Error(error.message);
      await invalidateChapterCaches(queryClient, series.id);
      toast.success(`${unpublishedCount} chapter${unpublishedCount === 1 ? "" : "s"} published.`);
      setPublishAllOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the chapters.");
    } finally {
      setPublishingAll(false);
    }
  };

  const deleteChapter = async () => {
    if (!series || !chapterToDelete) return;
    try {
      const { error } = await supabase.from("chapters").delete().eq("id", chapterToDelete.id);
      if (error) throw new Error(error.message);
      await invalidateChapterCaches(queryClient, series.id);
      toast.success(`Chapter ${chapterToDelete.number} deleted.`);
      setChapterToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the chapter.");
    }
  };

  const deleteSeries = async () => {
    if (!series) return;
    try {
      const { error } = await supabase.from("series").delete().eq("id", series.id);
      if (error) throw new Error(error.message);
      await invalidateSeriesCaches(queryClient);
      await invalidateAdminSeriesList(queryClient);
      toast.success("Series deleted.");
      setSeriesDeleteOpen(false);
      navigate({ to: "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the series.");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (seriesQuery.isPending) {
    return <EditorSkeleton />;
  }

  if (seriesQuery.error) {
    return (
      <StatusCard
        title="Could not load this series"
        description={seriesQuery.error.message}
        action={
          <Button
            type="button"
            onClick={() => void seriesQuery.refetch()}
            disabled={seriesQuery.isFetching}
            className="h-9 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {seriesQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Try again
          </Button>
        }
      />
    );
  }

  if (!series) {
    return (
      <StatusCard
        title="Series not found"
        description="This series doesn't exist, or your account doesn't have access to it."
      />
    );
  }

  if (!canManage || !userId) {
    return (
      <StatusCard
        title="You can't edit this series"
        description="Only the author of this series (or an administrator) can edit it."
      />
    );
  }

  const tagList = series.tags ?? [];
  const tagsDirty = tagsDraft.join("|") !== tagList.join("|");
  const synopsisDirty = synopsisDraft.trim() !== (series.synopsis ?? "").trim();
  const slugValidation = slugDirty ? slugError(slugDraft) : null;
  const statusIsKnown = SERIES_STATUS_OPTIONS.some((option) => option.value === series.status);
  const statusDescription = statusSaving
    ? "Saving…"
    : (SERIES_STATUS_OPTIONS.find((option) => option.value === series.status)?.description ??
      `Stored status: ${seriesStatusLabel(series.status)}`);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            All series
          </Link>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">
            {series.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded px-2 py-0.5 font-semibold uppercase tracking-wider",
                series.published
                  ? "bg-accent/20 text-accent"
                  : "bg-neutral-800 text-muted-foreground",
              )}
            >
              {series.published ? "Live" : "Draft"}
            </span>
            {series.featured ? (
              <span className="rounded bg-amber-400/15 px-2 py-0.5 font-semibold uppercase tracking-wider text-amber-300">
                Featured
              </span>
            ) : null}
            <span className="rounded bg-neutral-800 px-2 py-0.5 uppercase tracking-wider text-muted-foreground">
              {seriesStatusLabel(series.status)}
            </span>
            <span className="text-muted-foreground">{formatUpdatedAt(series.updated_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/series/$slug"
            params={{ slug: series.slug }}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-800 bg-surface px-3 text-sm text-foreground transition hover:bg-neutral-800/40"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View public page
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-neutral-800 bg-surface/40 p-4">
            <h2 className="text-sm font-semibold text-foreground">Artwork</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Portrait covers appear in the library; the wide banner is used on the home hero.
            </p>
            <div className="mt-4 flex flex-col gap-5">
              <ImageField
                label="Cover"
                aspect="portrait"
                value={series.cover_url}
                prefix={`${userId}/${series.id}/covers`}
                onUploaded={handleCoverUploaded}
                onRemoved={handleCoverRemoved}
                hint="Recommended 2:3 portrait, e.g. 800×1200."
              />
              <ImageField
                label="Hero banner"
                aspect="wide"
                value={series.hero_url}
                prefix={`${userId}/${series.id}/hero`}
                onUploaded={handleHeroUploaded}
                onRemoved={handleHeroRemoved}
                hint="Recommended 21:9 wide, e.g. 2100×900."
              />
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-surface/40 p-4">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            <div className="mt-4 flex flex-col gap-4">
              <InlineField
                id="edit-title"
                label="Title"
                value={series.title}
                maxLength={MAX_TITLE_LENGTH}
                placeholder="Series title"
                validate={(next) => (next.length < 2 ? "Use at least 2 characters." : null)}
                onSave={saveTitle}
              />
              <InlineField
                id="edit-genre"
                label="Genre"
                value={series.genre ?? ""}
                maxLength={MAX_GENRE_LENGTH}
                placeholder="Dark fantasy, action…"
                onSave={saveGenre}
              />

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="edit-slug"
                    className="text-xs uppercase tracking-widest text-muted-foreground"
                  >
                    URL slug
                  </Label>
                  {slugDirty ? (
                    <span className="text-[10px] uppercase tracking-wider text-amber-300/80">
                      Unsaved
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="edit-slug"
                    value={slugDraft}
                    onChange={(event) => {
                      setSlugDraft(event.target.value);
                      setSlugDirty(true);
                      setSlugStatus("idle");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveSlug();
                      }
                    }}
                    maxLength={MAX_SLUG_LENGTH + 20}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    disabled={slugSaving}
                    aria-invalid={slugValidation ? true : undefined}
                    aria-describedby="edit-slug-help"
                    className="h-9 border-neutral-800 bg-base font-mono text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void saveSlug()}
                    disabled={!slugDirty || Boolean(slugValidation) || slugSaving}
                    aria-label="Save URL slug"
                    className="h-9 shrink-0"
                  >
                    {slugSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </Button>
                </div>
                <p id="edit-slug-help" className="text-xs text-muted-foreground">
                  /series/{slugDraft || "…"} — changing this breaks existing links.
                </p>
                {slugValidation ? (
                  <p role="alert" className="text-xs text-destructive">
                    {slugValidation}
                  </p>
                ) : slugStatus === "checking" ? (
                  <p
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    role="status"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Checking availability…
                  </p>
                ) : slugStatus === "available" ? (
                  <p className="text-xs text-emerald-400" role="status">
                    This slug is available.
                  </p>
                ) : slugStatus === "taken" ? (
                  <p className="text-xs text-destructive" role="status">
                    This slug is already used by another series.
                  </p>
                ) : slugStatus === "error" ? (
                  <p className="text-xs text-muted-foreground">
                    Couldn&apos;t check availability right now.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <TagInput
                  value={tagsDraft}
                  onChange={setTagsDraft}
                  disabled={tagsSaving}
                  hint="Tags appear on the series page and the home hero."
                />
                {tagsDirty ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveTags()}
                      disabled={tagsSaving}
                      className="h-8"
                    >
                      {tagsSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Save tags
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="edit-synopsis"
                    className="text-xs uppercase tracking-widest text-muted-foreground"
                  >
                    Synopsis
                  </Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      synopsisDraft.length > MAX_SYNOPSIS_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {synopsisDraft.length}/{MAX_SYNOPSIS_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="edit-synopsis"
                  value={synopsisDraft}
                  onChange={(event) => setSynopsisDraft(event.target.value)}
                  rows={5}
                  maxLength={MAX_SYNOPSIS_LENGTH}
                  disabled={synopsisSaving}
                  placeholder="What is this manhwa about?"
                  className="resize-y border-neutral-800 bg-base text-sm"
                />
                {synopsisDirty ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveSynopsis()}
                      disabled={synopsisSaving}
                      className="h-8"
                    >
                      {synopsisSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Save synopsis
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-surface/40 p-4">
            <h2 className="text-sm font-semibold text-foreground">Publication</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="edit-status"
                  className="text-xs uppercase tracking-widest text-muted-foreground"
                >
                  Status
                </Label>
                <Select
                  value={series.status}
                  onValueChange={(value) => void saveStatus(value)}
                  disabled={statusSaving}
                >
                  <SelectTrigger
                    id="edit-status"
                    className="h-9 border-neutral-800 bg-base text-sm"
                  >
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent className="border-neutral-800 bg-surface">
                    {SERIES_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    {!statusIsKnown ? (
                      <SelectItem value={series.status}>
                        {seriesStatusLabel(series.status)}
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{statusDescription}</p>
              </div>

              <div className="flex items-start justify-between gap-3 rounded-md border border-neutral-800 bg-base/60 p-3">
                <div>
                  <Label htmlFor="edit-published" className="text-sm font-medium text-foreground">
                    Published
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    When live, the series and its published chapters are visible to readers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {publishSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  <Switch
                    id="edit-published"
                    checked={publishedValue ?? series.published}
                    onCheckedChange={(next) => void togglePublished(next)}
                    disabled={publishSaving}
                    aria-label="Publish series"
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 rounded-md border border-neutral-800 bg-base/60 p-3">
                <div>
                  <Label htmlFor="edit-featured" className="text-sm font-medium text-foreground">
                    Featured on home
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Highlights the series in the home page hero. It must be published to appear.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {featureSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  <Switch
                    id="edit-featured"
                    checked={featuredValue ?? series.featured}
                    onCheckedChange={(next) => void toggleFeatured(next)}
                    disabled={featureSaving}
                    aria-label="Feature series on the home page"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold text-foreground">Danger zone</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Deleting the series also deletes every chapter and page. This can&apos;t be undone.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSeriesDeleteOpen(true)}
              className="mt-3 h-9 w-full border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete series
            </Button>
          </section>
        </aside>

        <section aria-labelledby="chapters-heading" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="chapters-heading" className="text-lg font-semibold text-foreground">
                Chapters
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {chaptersQuery.isPending
                  ? "Loading chapters…"
                  : `${chapters.length} chapter${chapters.length === 1 ? "" : "s"} · ${unpublishedCount} draft${unpublishedCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPublishAllOpen(true)}
              disabled={unpublishedCount === 0 || publishingAll || chaptersQuery.isPending}
              className="h-9 border-neutral-800 bg-surface text-sm"
            >
              {publishingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {unpublishedCount > 0
                ? `Publish all (${unpublishedCount})`
                : "All chapters published"}
            </Button>
          </div>

          <form
            onSubmit={(event) => void handleAddChapter(event)}
            className="mt-4 rounded-xl border border-neutral-800 bg-surface/40 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Add a chapter</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="new-chapter-number"
                  className="text-xs uppercase tracking-widest text-muted-foreground"
                >
                  Number
                </Label>
                <Input
                  id="new-chapter-number"
                  type="number"
                  min={1}
                  value={newChapterNumber}
                  onChange={(event) => {
                    setNewChapterNumber(event.target.value);
                    setChapterError(null);
                  }}
                  placeholder={String(nextChapterNumber)}
                  disabled={addingChapter}
                  className="h-9 border-neutral-800 bg-base text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="new-chapter-title"
                  className="text-xs uppercase tracking-widest text-muted-foreground"
                >
                  Title (optional)
                </Label>
                <Input
                  id="new-chapter-title"
                  value={newChapterTitle}
                  onChange={(event) => setNewChapterTitle(event.target.value)}
                  placeholder="The void awakens"
                  maxLength={MAX_CHAPTER_TITLE_LENGTH}
                  disabled={addingChapter}
                  className="h-9 border-neutral-800 bg-base text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={addingChapter}
                  className="h-9 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {addingChapter ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  Add chapter
                </Button>
              </div>
            </div>
            {chapterError ? (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {chapterError}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Chapters are created as drafts. Leave the number empty to use {nextChapterNumber}.
              </p>
            )}
          </form>

          {chaptersQuery.isPending ? (
            <div className="mt-4 flex flex-col gap-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : chaptersQuery.error ? (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <span>Could not load the chapters — {chaptersQuery.error.message}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void chaptersQuery.refetch()}
                disabled={chaptersQuery.isFetching}
                className="mt-3 h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                {chaptersQuery.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Try again
              </Button>
            </div>
          ) : chapters.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-800 bg-surface/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No chapters yet. Add the first one above, then upload its pages.
              </p>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {chapters.map((chapter) => (
                <ChapterEditor
                  key={chapter.id}
                  chapter={chapter}
                  seriesId={series.id}
                  seriesSlug={series.slug}
                  uploadPrefix={`${userId}/${series.id}/${chapter.id}`}
                  chapterNumbers={chapterNumbers}
                  onRequestDelete={setChapterToDelete}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={publishAllOpen}
        onOpenChange={setPublishAllOpen}
        title="Publish every draft chapter?"
        description={`${unpublishedCount} draft chapter${unpublishedCount === 1 ? "" : "s"} will become visible to readers immediately. You can still unpublish them individually afterwards.`}
        confirmLabel="Publish all"
        onConfirm={publishAllChapters}
      />

      <ConfirmDialog
        open={chapterToDelete !== null}
        onOpenChange={(next) => {
          if (!next) setChapterToDelete(null);
        }}
        title={chapterToDelete ? `Delete chapter ${chapterToDelete.number}?` : "Delete chapter?"}
        description="The chapter and all of its pages will be permanently deleted. This cannot be undone."
        confirmLabel="Delete chapter"
        tone="destructive"
        onConfirm={deleteChapter}
      />

      <ConfirmDialog
        open={seriesDeleteOpen}
        onOpenChange={setSeriesDeleteOpen}
        title={`Delete “${series.title}”?`}
        description="This permanently deletes the series, every chapter and every uploaded page. This cannot be undone."
        confirmLabel="Delete series"
        tone="destructive"
        onConfirm={deleteSeries}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Local UI helpers                                                    */
/* ------------------------------------------------------------------ */

type InlineFieldProps = {
  id: string;
  label: string;
  value: string;
  onSave: (next: string) => Promise<boolean>;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  validate?: (next: string) => string | null;
};

function InlineField({
  id,
  label,
  value,
  onSave,
  placeholder,
  maxLength = 160,
  hint,
  validate,
}: InlineFieldProps) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descriptionId = `${id}-error`;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const trimmed = draft.trim();
  const dirty = trimmed !== value.trim();

  const save = async () => {
    if (!dirty || saving) return;
    const validation = validate?.(trimmed) ?? null;
    if (validation) {
      setError(validation);
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`Keep it under ${maxLength} characters.`);
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await onSave(trimmed);
    if (!ok) setError("Could not save — please try again.");
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </Label>
        {dirty && !saving ? (
          <span className="text-[10px] uppercase tracking-wider text-amber-300/80">Unsaved</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
          onBlur={() => void save()}
          placeholder={placeholder}
          maxLength={maxLength + 40}
          disabled={saving}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? descriptionId : undefined}
          className="h-9 border-neutral-800 bg-base text-sm"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || saving}
          aria-label={`Save ${label.toLowerCase()}`}
          className="h-9 shrink-0"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>
      {error ? (
        <p id={descriptionId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" aria-busy="true">
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading the series…
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}

function StatusCard({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-16 sm:py-20">
      <div className="rounded-2xl border border-neutral-800 bg-surface/50 p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-6 flex flex-col items-center gap-3">{action}</div> : null}
        <Link
          to="/admin"
          className="mt-6 inline-block text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
        >
          ← All series
        </Link>
      </div>
    </main>
  );
}
