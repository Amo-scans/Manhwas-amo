import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TagInputProps = {
  /** Visible label. Defaults to "Tags". */
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxTagLength?: number;
  hint?: string;
  disabled?: boolean;
  /** Optional explicit id (otherwise one is generated). */
  id?: string;
};

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Accessible chip input for `series.tags` (`TEXT[]`).
 *
 * - Enter or comma adds the drafted tag (never submits the surrounding form).
 * - Backspace on an empty input removes the last tag.
 * - Escape clears the draft.
 */
export function TagInput({
  label = "Tags",
  value,
  onChange,
  placeholder = "Add a tag and press Enter",
  maxTags = 12,
  maxTagLength = 24,
  hint,
  disabled = false,
  id,
}: TagInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addTag = () => {
    if (disabled) return;
    const candidate = normalizeTag(draft);
    if (!candidate) {
      setDraft("");
      return;
    }
    if (candidate.length > maxTagLength) {
      setError(`Tags must be ${maxTagLength} characters or fewer.`);
      return;
    }
    if (value.length >= maxTags) {
      setError(`You can add up to ${maxTags} tags.`);
      return;
    }
    if (value.some((tag) => tag.toLowerCase() === candidate.toLowerCase())) {
      setDraft("");
      setError(null);
      return;
    }
    onChange([...value, candidate]);
    setDraft("");
    setError(null);
  };

  const removeTag = (tag: string) => {
    if (disabled) return;
    onChange(value.filter((current) => current !== tag));
    setError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      removeTag(value[value.length - 1]);
      return;
    }
    if (event.key === "Escape") {
      setDraft("");
      setError(null);
    }
  };

  const description = error ?? hint ?? "Press Enter or comma to add a tag.";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={inputId}
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          {label}
        </Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {value.length}/{maxTags}
        </span>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800/60 py-1 pl-2 pr-1 text-xs text-foreground"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={`Remove tag ${tag}`}
                className="rounded p-0.5 text-muted-foreground transition hover:bg-neutral-700/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        id={inputId}
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={placeholder}
        maxLength={maxTagLength + 1}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId}
        className={cn("h-9 border-neutral-800 bg-surface text-sm")}
      />

      <p
        id={descriptionId}
        role={error ? "alert" : undefined}
        className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
      >
        {description}
      </p>
    </div>
  );
}
