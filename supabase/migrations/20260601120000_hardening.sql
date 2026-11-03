-- Hardening pass: data integrity, storage limits and query performance.
-- Purely additive: constraints are NOT VALID so legacy rows are not re-checked,
-- while every new write is validated from now on.
--
-- Apply with: supabase db push   (or paste in the SQL editor of the project)

-- ---------------------------------------------------------------- series
ALTER TABLE public.series
  ADD CONSTRAINT series_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') NOT VALID,
  ADD CONSTRAINT series_status_check CHECK (status IN ('ongoing', 'completed', 'hiatus', 'cancelled')) NOT VALID,
  ADD CONSTRAINT series_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 200) NOT VALID;

CREATE INDEX IF NOT EXISTS series_featured_idx
  ON public.series (published, featured, updated_at DESC);

-- ---------------------------------------------------------------- chapters
ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_number_positive CHECK (number > 0) NOT VALID,
  ADD CONSTRAINT chapters_title_length CHECK (title IS NULL OR char_length(title) <= 200) NOT VALID;

-- "Latest releases" on the home page: published chapters ordered by freshness.
CREATE INDEX IF NOT EXISTS chapters_latest_idx
  ON public.chapters (published, created_at DESC);

-- ---------------------------------------------------------------- panels
ALTER TABLE public.panels
  ADD CONSTRAINT panels_position_non_negative CHECK (position >= 0) NOT VALID;

-- ---------------------------------------------------------------- comments
ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_not_blank CHECK (btrim(content) <> '') NOT VALID;

-- ---------------------------------------------------------------- storage
-- Cap uploads to keep the free plan healthy (20 MB per file) and only accept images.
UPDATE storage.buckets
SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
WHERE id = 'manhwa';

-- ---------------------------------------------------------------- freshness
-- Publishing/editing a chapter should bump its series' updated_at so that
-- "recently updated" ordering stays meaningful.
CREATE OR REPLACE FUNCTION public.touch_series_from_chapter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.series
  SET updated_at = now()
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_series_from_chapter() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chapters_touch_series ON public.chapters;
CREATE TRIGGER chapters_touch_series
  AFTER INSERT OR UPDATE OR DELETE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.touch_series_from_chapter();
