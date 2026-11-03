import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  ALLOWED_IMAGE_LABEL,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  formatBytes,
  removeStoredImage,
  uploadImage,
  validateImageFile,
  type UploadedImage,
} from "@/components/admin/storage";
import { cn } from "@/lib/utils";

export type ImageFieldProps = {
  label: string;
  hint?: string;
  value: string | null;
  /** Portrait for covers, wide for hero banners. */
  aspect: "portrait" | "wide";
  /** Storage folder, e.g. `${userId}/${seriesId}/covers`. */
  prefix: string;
  disabled?: boolean;
  onUploaded: (image: UploadedImage) => Promise<void> | void;
  onRemoved: () => Promise<void> | void;
};

/**
 * Image picker with preview, upload state, inline errors and a confirmation
 * before deleting the current image. The parent persists the URL.
 */
export function ImageField({
  label,
  hint,
  value,
  aspect,
  prefix,
  disabled = false,
  onUploaded,
  onRemoved,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled || busy) return;
    const validation = validateImageFile(file);
    if (validation) {
      setError(validation);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    setBusy("upload");
    const previousUrl = value;
    try {
      const uploaded = await uploadImage(file, prefix);
      await onUploaded(uploaded);
      if (previousUrl && previousUrl !== uploaded.url) {
        await removeStoredImage(previousUrl);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.",
      );
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (disabled) return;
    setBusy("remove");
    const previousUrl = value;
    try {
      await onRemoved();
      await removeStoredImage(previousUrl);
      setConfirmRemove(false);
      setError(null);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove the image. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            disabled={busy !== null || disabled}
            aria-label={`Remove ${label.toLowerCase()}`}
            title={`Remove ${label.toLowerCase()}`}
            className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-dashed border-neutral-800 bg-surface",
          aspect === "portrait" ? "aspect-[2/3] w-full" : "aspect-[21/9] w-full",
        )}
      >
        {value ? (
          <img
            src={value}
            alt={`${label} preview`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            <span className="px-4 text-center text-xs">No image yet</span>
          </div>
        )}

        {busy ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base/75 text-xs text-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {busy === "upload" ? "Uploading…" : "Removing…"}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy !== null || disabled}
          onClick={() => inputRef.current?.click()}
          className="h-8 border-neutral-800 bg-surface text-xs"
        >
          {value ? "Replace image" : "Upload image"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {ALLOWED_IMAGE_LABEL} · max {formatBytes(MAX_IMAGE_BYTES)}
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={busy !== null || disabled}
        onChange={(event) => void handleFile(event.target.files?.[0])}
        aria-label={`Upload ${label.toLowerCase()}`}
        className="sr-only"
      />

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${label.toLowerCase()}?`}
        description="The current image will be deleted from this series. You can upload a new one at any time."
        confirmLabel="Remove image"
        tone="destructive"
        onConfirm={handleRemove}
      />
    </div>
  );
}
