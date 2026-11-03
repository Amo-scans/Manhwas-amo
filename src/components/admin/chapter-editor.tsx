import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { panelsQueryOptions, type ChapterRow, type PanelRow } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PanelGrid } from "@/components/admin/panel-grid";
import { invalidateChapterCaches, invalidatePanelCaches } from "@/components/admin/cache";
import {
  ALLOWED_IMAGE_LABEL,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_BATCH,
  formatBytes,
  uploadImage,
  validateImageFile,
} from "@/components/admin/storage";

export type ChapterEditorProps = {
  chapter: ChapterRow;
  seriesId: string;
  seriesSlug: string;
  /** Storage folder for this chapter's pages, e.g. `${userId}/${seriesId}/${chapterId}`. */
  uploadPrefix: string;
  /** Every chapter number in the series (including this one) — used for uniqueness checks. */
  chapterNumbers: number[];
  defaultOpen?: boolean;
  onRequestDelete: (chapter: ChapterRow) => void;
};

type UploadStatus = "queued" | "uploading" | "done" | "error";

type UploadItem = {
  id: string;
  name: string;
  status: UploadStatus;
  error?: string;
};

const MAX_TITLE_LENGTH = 120;

const panelCountLabel = (count: number) => `${count} ${count === 1 ? "page" : "pages"}`;

/**
 * One chapter row in the studio editor: inline title/number rename, publish
 * toggle, expandable page manager with multi-file upload and progress.
 */
export function ChapterEditor({
  chapter,
  seriesId,
  seriesSlug,
  uploadPrefix,
  chapterNumbers,
  defaultOpen = false,
  onRequestDelete,
}: ChapterEditorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState(chapter.title ?? "");
  const [titleSaving, setTitleSaving] = useState(false);
  const [number, setNumber] = useState(String(chapter.number));
  const [numberSaving, setNumberSaving] = useState(false);
  const [publishSaving, setPublishSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [movingPanelId, setMovingPanelId] = useState<string | null>(null);
  const [panelToDelete, setPanelToDelete] = useState<PanelRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: panels = [],
    isPending: panelsLoading,
    error: panelsError,
  } = useQuery({
    ...panelsQueryOptions(chapter.id),
    enabled: open,
  });

  useEffect(() => {
    setTitle(chapter.title ?? "");
  }, [chapter.title]);

  useEffect(() => {
    setNumber(String(chapter.number));
  }, [chapter.number]);

  const trimmedTitle = title.trim();
  const titleDirty = trimmedTitle !== (chapter.title ?? "").trim();
  const titleInvalid = trimmedTitle.length > MAX_TITLE_LENGTH;

  const parsedNumber = Number(number);
  const numberDirty = Number.isInteger(parsedNumber) && parsedNumber !== chapter.number;
  const numberInvalid =
    number.trim() === "" ||
    !Number.isInteger(parsedNumber) ||
    parsedNumber < 1 ||
    String(parsedNumber) !== number.trim();
  const duplicateNumber =
    !numberInvalid &&
    chapterNumbers.some((value) => value === parsedNumber && value !== chapter.number);
  const numberError = numberInvalid
    ? "Use a whole number (1 or more)."
    : duplicateNumber
      ? `Chapter ${parsedNumber} already exists.`
      : null;

  const saveTitle = async () => {
    if (!titleDirty || titleInvalid || titleSaving) return;
    setTitleSaving(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({ title: trimmedTitle || null })
        .eq("id", chapter.id);
      if (error) throw new Error(error.message);
      await invalidateChapterCaches(queryClient, seriesId);
      toast.success("Chapter title updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the chapter title.");
    } finally {
      setTitleSaving(false);
    }
  };

  const saveNumber = async () => {
    if (!numberDirty || numberError || numberSaving) return;
    setNumberSaving(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({ number: parsedNumber })
        .eq("id", chapter.id);
      if (error) throw new Error(error.message);
      await invalidateChapterCaches(queryClient, seriesId);
      toast.success(`Chapter updated to number ${parsedNumber}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the chapter number.");
    } finally {
      setNumberSaving(false);
    }
  };

  const togglePublished = async (next: boolean) => {
    if (publishSaving) return;
    setPublishSaving(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({ published: next })
        .eq("id", chapter.id);
      if (error) throw new Error(error.message);
      await invalidateChapterCaches(queryClient, seriesId);
      toast.success(
        next
          ? `Chapter ${chapter.number} is now published.`
          : `Chapter ${chapter.number} was unpublished.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the publication status.",
      );
    } finally {
      setPublishSaving(false);
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0 || uploading) return;
    if (files.length > MAX_IMAGES_PER_BATCH) {
      toast.error(`Upload up to ${MAX_IMAGES_PER_BATCH} pages at a time.`);
      return;
    }

    const prepared = files.map((file) => {
      const error = validateImageFile(file);
      const item: UploadItem = {
        id: crypto.randomUUID(),
        name: file.name,
        status: error ? "error" : "queued",
        error: error ?? undefined,
      };
      return { file, item, error };
    });
    const queue = prepared.filter((entry) => entry.error === null);
    const items = prepared.map((entry) => entry.item);
    const invalidCount = files.length - queue.length;

    setUploads(items);
    if (queue.length === 0) {
      toast.error(
        `None of those files could be uploaded — ${ALLOWED_IMAGE_LABEL}, max ${formatBytes(MAX_IMAGE_BYTES)} each.`,
      );
      return;
    }
    if (invalidCount > 0) {
      toast.warning(
        `${invalidCount} file${invalidCount === 1 ? "" : "s"} skipped (unsupported type or too large).`,
      );
    }

    setUploading(true);
    setUploadTotal(queue.length);
    setUploadDone(0);
    let nextPosition = panels.reduce((max, panel) => Math.max(max, panel.position), 0) + 1;
    let succeeded = 0;
    let failed = 0;

    for (const entry of queue) {
      const item = entry.item;
      setUploads((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? { ...currentItem, status: "uploading" } : currentItem,
        ),
      );
      try {
        const uploaded = await uploadImage(entry.file, uploadPrefix);
        const { error } = await supabase.from("panels").insert({
          chapter_id: chapter.id,
          position: nextPosition,
          image_url: uploaded.url,
          width: uploaded.width,
          height: uploaded.height,
        });
        if (error) throw new Error(error.message);
        nextPosition += 1;
        succeeded += 1;
        setUploads((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id ? { ...currentItem, status: "done" } : currentItem,
          ),
        );
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Upload failed.";
        setUploads((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, status: "error", error: message }
              : currentItem,
          ),
        );
      } finally {
        setUploadDone((count) => count + 1);
      }
    }

    setUploading(false);
    await invalidatePanelCaches(queryClient, chapter.id);
    if (succeeded > 0) {
      toast.success(`${succeeded} page${succeeded === 1 ? "" : "s"} uploaded.`);
    }
    if (failed > 0) {
      toast.error(`${failed} page${failed === 1 ? "" : "s"} failed to upload.`);
    }
  };

  const movePanel = async (panel: PanelRow, direction: -1 | 1) => {
    if (movingPanelId) return;
    const ordered = panels;
    const index = ordered.findIndex((entry) => entry.id === panel.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

    setMovingPanelId(panel.id);
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    try {
      for (let position = 0; position < next.length; position += 1) {
        const entry = next[position];
        if (entry.position === position + 1) continue;
        const { error } = await supabase
          .from("panels")
          .update({ position: position + 1 })
          .eq("id", entry.id);
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reorder the pages.");
    } finally {
      setMovingPanelId(null);
      await invalidatePanelCaches(queryClient, chapter.id);
    }
  };

  const confirmPanelDelete = async () => {
    if (!panelToDelete) return;
    try {
      const { error } = await supabase.from("panels").delete().eq("id", panelToDelete.id);
      if (error) throw new Error(error.message);
      await invalidatePanelCaches(queryClient, chapter.id);
      toast.success("Page deleted.");
      setPanelToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that page.");
    }
  };

  const uploadPercent =
    uploadTotal === 0 ? 0 : Math.round((Math.min(uploadDone, uploadTotal) / uploadTotal) * 100);
  const deletePanelIndex = panelToDelete
    ? panels.findIndex((panel) => panel.id === panelToDelete.id)
    : -1;

  return (
    <li className="overflow-hidden rounded-lg border border-neutral-800 bg-surface/40">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={`chapter-panels-${chapter.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-medium text-foreground">
            Chapter {chapter.number}
            {chapter.title ? ` — ${chapter.title}` : ""}
          </span>
          {open && !panelsLoading && !panelsError ? (
            <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {panelCountLabel(panels.length)}
            </span>
          ) : null}
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={`chapter-published-${chapter.id}`}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Switch
              id={`chapter-published-${chapter.id}`}
              checked={chapter.published}
              onCheckedChange={(next) => void togglePublished(next)}
              disabled={publishSaving}
              aria-label={`Publish chapter ${chapter.number}`}
            />
            <span className={cn(publishSaving && "opacity-70")}>
              {publishSaving ? "Saving…" : chapter.published ? "Published" : "Draft"}
            </span>
          </label>

          <Link
            to="/read/$slug/$ep"
            params={{ slug: seriesSlug, ep: String(chapter.number) }}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent transition hover:underline"
          >
            Preview
          </Link>

          <button
            type="button"
            onClick={() => onRequestDelete(chapter)}
            aria-label={`Delete chapter ${chapter.number}`}
            title="Delete chapter"
            className="rounded p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open ? (
        <div
          id={`chapter-panels-${chapter.id}`}
          className="space-y-4 border-t border-neutral-800 p-3 md:p-4"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`chapter-title-${chapter.id}`}
                className="text-xs uppercase tracking-widest text-muted-foreground"
              >
                Chapter title
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`chapter-title-${chapter.id}`}
                  value={title}
                  maxLength={MAX_TITLE_LENGTH}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveTitle();
                    }
                  }}
                  onBlur={() => void saveTitle()}
                  placeholder="Optional title"
                  disabled={titleSaving}
                  aria-invalid={titleInvalid ? true : undefined}
                  className="h-9 border-neutral-800 bg-base text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveTitle()}
                  disabled={!titleDirty || titleInvalid || titleSaving}
                  aria-label="Save chapter title"
                  className="h-9 shrink-0"
                >
                  {titleSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Button>
              </div>
              {titleDirty && !titleInvalid ? (
                <p className="text-[11px] text-muted-foreground">
                  Unsaved changes — press Enter or click save.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`chapter-number-${chapter.id}`}
                className="text-xs uppercase tracking-widest text-muted-foreground"
              >
                Number
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`chapter-number-${chapter.id}`}
                  type="number"
                  min={1}
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveNumber();
                    }
                  }}
                  onBlur={() => void saveNumber()}
                  disabled={numberSaving}
                  aria-invalid={numberDirty && Boolean(numberError) ? true : undefined}
                  className="h-9 w-20 border-neutral-800 bg-base text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveNumber()}
                  disabled={!numberDirty || Boolean(numberError) || numberSaving}
                  aria-label="Save chapter number"
                  className="h-9 shrink-0"
                >
                  {numberSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Button>
              </div>
              {numberDirty && numberError ? (
                <p role="alert" className="text-[11px] text-destructive">
                  {numberError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium text-foreground">Pages</h4>
                <p className="text-xs text-muted-foreground">
                  {panels.length > 0 ? `${panelCountLabel(panels.length)} · ` : ""}
                  {ALLOWED_IMAGE_LABEL}, max {formatBytes(MAX_IMAGE_BYTES)} each
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  disabled={uploading}
                  onChange={(event) => void handleFiles(event.target.files)}
                  className="sr-only"
                  aria-label={`Upload pages for chapter ${chapter.number}`}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {uploading ? "Uploading…" : "Upload pages"}
                </Button>
              </div>
            </div>

            {uploads.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-md border border-neutral-800 bg-base/60 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">
                    {uploading
                      ? `Uploading ${Math.min(uploadDone + 1, uploadTotal)} of ${uploadTotal}…`
                      : "Upload finished"}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{uploadPercent}%</span>
                </div>
                <Progress
                  value={uploadPercent}
                  className="h-1.5 bg-neutral-800"
                  aria-label="Page upload progress"
                />
                <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
                  {uploads.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2">
                      <span className="truncate text-muted-foreground" title={item.name}>
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1",
                          item.status === "done" && "text-emerald-400",
                          item.status === "error" && "text-destructive",
                          (item.status === "queued" || item.status === "uploading") &&
                            "text-muted-foreground",
                        )}
                      >
                        {item.status === "done" ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : item.status === "error" ? (
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        ) : item.status === "uploading" ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : null}
                        {item.status === "done"
                          ? "Uploaded"
                          : item.status === "uploading"
                            ? "Uploading"
                            : item.status === "queued"
                              ? "Queued"
                              : (item.error ?? "Failed")}
                      </span>
                    </li>
                  ))}
                </ul>
                {!uploading ? (
                  <button
                    type="button"
                    onClick={() => setUploads([])}
                    className="self-end text-[11px] text-muted-foreground transition hover:text-foreground"
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            ) : null}

            {panelsLoading ? (
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                aria-hidden="true"
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-[3/4] animate-pulse rounded-md bg-neutral-800/60"
                  />
                ))}
              </div>
            ) : panelsError ? (
              <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <span>
                  Could not load the pages —{" "}
                  {panelsError instanceof Error ? panelsError.message : "unknown error"}.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: ["panels", chapter.id] })
                  }
                  className="h-8 w-fit border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <PanelGrid
                panels={panels}
                movingPanelId={movingPanelId}
                onMovePanel={(panel, direction) => void movePanel(panel, direction)}
                onRequestDelete={(panel) => setPanelToDelete(panel)}
              />
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={panelToDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPanelToDelete(null);
        }}
        title="Delete this page?"
        description={
          panelToDelete
            ? `Page #${deletePanelIndex + 1} will be permanently removed from chapter ${chapter.number}. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete page"
        tone="destructive"
        onConfirm={confirmPanelDelete}
      />
    </li>
  );
}
