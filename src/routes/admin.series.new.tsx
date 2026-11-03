import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { TagInput } from "@/components/admin/tag-input";
import { invalidateSeriesCaches } from "@/components/admin/cache";
import {
  MAX_SLUG_LENGTH,
  SLUG_PATTERN,
  isSlugTaken,
  slugError,
  slugify,
} from "@/components/admin/slug";
import { SERIES_STATUS_OPTIONS, type SeriesStatus } from "@/components/admin/series-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/series/new")({
  component: NewSeries,
});

const MAX_TITLE_LENGTH = 160;
const MAX_GENRE_LENGTH = 80;
const MAX_SYNOPSIS_LENGTH = 5000;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;

const newSeriesSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(MAX_TITLE_LENGTH, `Keep the title under ${MAX_TITLE_LENGTH} characters.`),
  slug: z
    .string()
    .trim()
    .max(MAX_SLUG_LENGTH, `Keep the slug under ${MAX_SLUG_LENGTH} characters.`)
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens (e.g. my-series)."),
  genre: z
    .string()
    .trim()
    .max(MAX_GENRE_LENGTH, `Keep the genre under ${MAX_GENRE_LENGTH} characters.`),
  synopsis: z
    .string()
    .trim()
    .max(MAX_SYNOPSIS_LENGTH, `Keep the synopsis under ${MAX_SYNOPSIS_LENGTH} characters.`),
  tags: z
    .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
    .max(MAX_TAGS, `Use at most ${MAX_TAGS} tags.`),
  status: z.enum(["ongoing", "completed", "hiatus"]),
});

type FieldName = "title" | "slug" | "genre" | "synopsis" | "tags" | "status";
type FieldErrors = Partial<Record<FieldName, string>>;
type SlugStatus = "idle" | "checking" | "available" | "taken" | "error";

function NewSeries() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [genre, setGenre] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<SeriesStatus>("ongoing");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty =
    title.trim().length > 0 ||
    slug.trim().length > 0 ||
    genre.trim().length > 0 ||
    synopsis.trim().length > 0 ||
    tags.length > 0 ||
    status !== "ongoing";

  /* Debounced availability check so writers see slug conflicts before submitting. */
  useEffect(() => {
    const validation = slugError(slug);
    if (!slug || validation) {
      setSlugStatus("idle");
      return;
    }
    let cancelled = false;
    setSlugStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const taken = await isSlugTaken(slug);
        if (!cancelled) setSlugStatus(taken ? "taken" : "available");
      } catch {
        if (!cancelled) setSlugStatus("error");
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  const validateField = (field: FieldName) => {
    const parsed = newSeriesSchema.safeParse({ title, slug, genre, synopsis, tags, status });
    if (parsed.success) {
      setErrors((current) => ({ ...current, [field]: undefined }));
      return;
    }
    const message = parsed.error.issues.find((issue) => issue.path[0] === field)?.message;
    setErrors((current) => ({ ...current, [field]: message }));
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setErrors((current) => ({ ...current, title: undefined }));
    setFormError(null);
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugEdited(true);
    setErrors((current) => ({ ...current, slug: undefined }));
    setFormError(null);
  };

  const handleStatusChange = (value: string) => {
    const match = SERIES_STATUS_OPTIONS.find((option) => option.value === value);
    if (match) setStatus(match.value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setFormError(null);

    const parsed = newSeriesSchema.safeParse({ title, slug, genre, synopsis, tags, status });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const nextErrors: FieldErrors = {};
      for (const field of Object.keys(fieldErrors) as FieldName[]) {
        const message = fieldErrors[field]?.[0];
        if (message) nextErrors[field] = message;
      }
      setErrors(nextErrors);
      return;
    }

    if (!userId) {
      setFormError("Your session expired — sign in again to create a series.");
      return;
    }

    const values = parsed.data;
    setBusy(true);
    try {
      const taken = await isSlugTaken(values.slug);
      if (taken) {
        setErrors((current) => ({
          ...current,
          slug: "This slug is already used by another series.",
        }));
        setSlugStatus("taken");
        return;
      }

      const { error } = await supabase.from("series").insert({
        author_id: userId,
        title: values.title,
        slug: values.slug,
        genre: values.genre || null,
        synopsis: values.synopsis || null,
        tags: values.tags,
        status: values.status,
        published: false,
        featured: false,
      });

      if (error) {
        if (error.code === "23505") {
          setErrors((current) => ({
            ...current,
            slug: "This slug is already used by another series.",
          }));
          setSlugStatus("taken");
          return;
        }
        throw new Error(error.message);
      }

      await invalidateSeriesCaches(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["admin", "series"] });
      toast.success("Series created — add your first chapter.");
      navigate({ to: "/admin/series/$slug", params: { slug: values.slug } });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not create the series. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) setDiscardOpen(true);
    else navigate({ to: "/admin" });
  };

  const slugPreview = slug.trim() || "my-series";
  const slugValidation = errors.slug ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/admin"
        className="text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
      >
        ← All series
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Create a new series
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        New series start as drafts. Add chapters and publish once the first episode is ready.
      </p>

      {formError ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-6 flex flex-col gap-5 rounded-xl border border-neutral-800 bg-surface/40 p-5 sm:p-6"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="series-title"
            className="text-xs uppercase tracking-widest text-muted-foreground"
          >
            Title
          </Label>
          <Input
            id="series-title"
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            onBlur={() => validateField("title")}
            placeholder="The Last Sovereign of Void"
            maxLength={MAX_TITLE_LENGTH + 40}
            disabled={busy}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "series-title-error" : undefined}
            className="h-10 border-neutral-800 bg-base text-sm"
          />
          {errors.title ? (
            <p id="series-title-error" role="alert" className="text-xs text-destructive">
              {errors.title}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {title.trim().length}/{MAX_TITLE_LENGTH} characters
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label
              htmlFor="series-slug"
              className="text-xs uppercase tracking-widest text-muted-foreground"
            >
              URL slug
            </Label>
            <button
              type="button"
              onClick={() => {
                setSlug(slugify(title));
                setSlugEdited(false);
                setErrors((current) => ({ ...current, slug: undefined }));
              }}
              disabled={busy || title.trim().length === 0}
              className="text-[11px] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              Generate from title
            </button>
          </div>
          <Input
            id="series-slug"
            value={slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            onBlur={() => validateField("slug")}
            placeholder="the-last-sovereign-of-void"
            maxLength={MAX_SLUG_LENGTH + 20}
            disabled={busy}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={errors.slug ? "series-slug-error" : "series-slug-hint"}
            className="h-10 border-neutral-800 bg-base font-mono text-sm"
          />
          <p id="series-slug-hint" className="text-xs text-muted-foreground">
            Public URL: <span className="font-mono text-foreground/80">/series/{slugPreview}</span>
          </p>
          {errors.slug ? (
            <p id="series-slug-error" role="alert" className="text-xs text-destructive">
              {errors.slug}
            </p>
          ) : slugStatus === "checking" ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Checking availability…
            </p>
          ) : slugStatus === "available" ? (
            <p className="flex items-center gap-1 text-xs text-emerald-400" role="status">
              <Check className="h-3 w-3" aria-hidden="true" />
              This slug is available.
            </p>
          ) : slugStatus === "taken" ? (
            <p className="flex items-center gap-1 text-xs text-destructive" role="status">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              This slug is already used by another series.
            </p>
          ) : slugStatus === "error" ? (
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t check availability right now — you can still try creating the series.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="series-genre"
              className="text-xs uppercase tracking-widest text-muted-foreground"
            >
              Genre
            </Label>
            <Input
              id="series-genre"
              value={genre}
              onChange={(event) => {
                setGenre(event.target.value);
                setErrors((current) => ({ ...current, genre: undefined }));
              }}
              onBlur={() => validateField("genre")}
              placeholder="Dark fantasy, action…"
              maxLength={MAX_GENRE_LENGTH + 20}
              disabled={busy}
              aria-invalid={errors.genre ? true : undefined}
              aria-describedby={errors.genre ? "series-genre-error" : undefined}
              className="h-10 border-neutral-800 bg-base text-sm"
            />
            {errors.genre ? (
              <p id="series-genre-error" role="alert" className="text-xs text-destructive">
                {errors.genre}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="series-status"
              className="text-xs uppercase tracking-widest text-muted-foreground"
            >
              Status
            </Label>
            <Select value={status} onValueChange={handleStatusChange} disabled={busy}>
              <SelectTrigger id="series-status" className="h-10 border-neutral-800 bg-base text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-neutral-800 bg-surface">
                {SERIES_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {SERIES_STATUS_OPTIONS.find((option) => option.value === status)?.description}
            </p>
          </div>
        </div>

        <TagInput
          value={tags}
          onChange={(nextTags) => {
            setTags(nextTags);
            setErrors((current) => ({ ...current, tags: undefined }));
          }}
          maxTags={MAX_TAGS}
          maxTagLength={MAX_TAG_LENGTH}
          disabled={busy}
          hint={`Up to ${MAX_TAGS} tags — they show on the series page and the home hero.`}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="series-synopsis"
              className="text-xs uppercase tracking-widest text-muted-foreground"
            >
              Synopsis
            </Label>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                synopsis.length > MAX_SYNOPSIS_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {synopsis.length}/{MAX_SYNOPSIS_LENGTH}
            </span>
          </div>
          <Textarea
            id="series-synopsis"
            value={synopsis}
            onChange={(event) => {
              setSynopsis(event.target.value);
              setErrors((current) => ({ ...current, synopsis: undefined }));
            }}
            onBlur={() => validateField("synopsis")}
            placeholder="What is this manhwa about?"
            rows={6}
            maxLength={MAX_SYNOPSIS_LENGTH}
            disabled={busy}
            aria-invalid={errors.synopsis ? true : undefined}
            aria-describedby={errors.synopsis ? "series-synopsis-error" : undefined}
            className="resize-y border-neutral-800 bg-base text-sm"
          />
          {errors.synopsis ? (
            <p id="series-synopsis-error" role="alert" className="text-xs text-destructive">
              {errors.synopsis}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-800 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={busy}
            className="h-10 border-neutral-800 bg-transparent text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="h-10 bg-accent px-5 text-sm text-accent-foreground hover:bg-accent/90"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? "Creating…" : "Create series"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this series?"
        description="Your changes haven't been saved. Leaving now will lose the title, synopsis and tags you entered."
        confirmLabel="Discard draft"
        tone="destructive"
        onConfirm={() => {
          setDiscardOpen(false);
          navigate({ to: "/admin" });
        }}
      />
    </main>
  );
}
