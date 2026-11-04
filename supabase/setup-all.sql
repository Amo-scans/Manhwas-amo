-- ============================================================================
-- AMO-SCANS-FR — installation complète de la base Supabase
-- Généré automatiquement depuis supabase/migrations/ (ordre chronologique).
-- Usage : Supabase Dashboard > SQL Editor > New query > coller > Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 20260516184635_db1c8574-1624-41d3-b1eb-2d91abc18424.sql
-- ----------------------------------------------------------------------------

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'author', 'reader');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_slug TEXT NOT NULL,
  episode INT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_series_ep_idx ON public.comments(series_slug, episode, created_at DESC);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- profiles: public read, owner update
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles: users can see their own; admins can see all
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- comments
CREATE POLICY "Comments readable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments or admins" ON public.comments FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'reader');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 20260516184647_5e227b0f-1a91-4ef9-b6a3-a44a303c3327.sql
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 20260516185222_efce8586-a711-494e-983f-cfb6bc85f800.sql
-- ----------------------------------------------------------------------------

-- SERIES
CREATE TABLE public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  genre TEXT,
  synopsis TEXT,
  cover_url TEXT,
  hero_url TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ongoing',
  published BOOLEAN NOT NULL DEFAULT false,
  featured BOOLEAN NOT NULL DEFAULT false,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX series_published_idx ON public.series(published, created_at DESC);

CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  number INT NOT NULL,
  title TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_id, number)
);
CREATE INDEX chapters_series_idx ON public.chapters(series_id, number);

CREATE TABLE public.panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  position INT NOT NULL,
  image_url TEXT NOT NULL,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX panels_chapter_idx ON public.panels(chapter_id, position);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER series_updated BEFORE UPDATE ON public.series FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

-- SERIES policies
CREATE POLICY "Published series visible to all" ON public.series FOR SELECT
  USING (published = true OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors create own series" ON public.series FOR INSERT
  WITH CHECK (auth.uid() = author_id AND (public.has_role(auth.uid(), 'author') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Authors update own series" ON public.series FOR UPDATE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors delete own series" ON public.series FOR DELETE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- CHAPTERS policies â€” visibility based on parent series
CREATE POLICY "Published chapters visible" ON public.chapters FOR SELECT
  USING (
    published = true AND EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND s.published = true)
    OR EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND (s.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Authors manage own chapters" ON public.chapters FOR ALL
  USING (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND (s.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND (s.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- PANELS policies
CREATE POLICY "Published panels visible" ON public.panels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chapters c JOIN public.series s ON s.id = c.series_id
      WHERE c.id = chapter_id
        AND ((c.published AND s.published) OR s.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "Authors manage own panels" ON public.panels FOR ALL
  USING (EXISTS (SELECT 1 FROM public.chapters c JOIN public.series s ON s.id = c.series_id WHERE c.id = chapter_id AND (s.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chapters c JOIN public.series s ON s.id = c.series_id WHERE c.id = chapter_id AND (s.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- STORAGE bucket for manhwa images
INSERT INTO storage.buckets (id, name, public) VALUES ('manhwa', 'manhwa', true);

CREATE POLICY "Manhwa images public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'manhwa');
CREATE POLICY "Authors upload manhwa images" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'manhwa'
    AND auth.uid() IS NOT NULL
    AND (public.has_role(auth.uid(), 'author') OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "Authors update own manhwa images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'manhwa' AND owner = auth.uid());
CREATE POLICY "Authors delete own manhwa images" ON storage.objects FOR DELETE
  USING (bucket_id = 'manhwa' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));


-- ----------------------------------------------------------------------------
-- 20260516185239_59d0b6fe-3d62-4bfd-b235-7c7f2e934c4e.sql
-- ----------------------------------------------------------------------------

UPDATE storage.buckets SET public = false WHERE id = 'manhwa';
-- SELECT policy already permits reading any object in the bucket via direct URL, which keeps getPublicUrl working,
-- but disabling the public flag prevents the bucket-listing endpoint from enumerating objects.


-- ----------------------------------------------------------------------------
-- 20260516185249_db659527-495e-450f-9f73-a26e9c7dd23c.sql
-- ----------------------------------------------------------------------------

UPDATE storage.buckets SET public = true WHERE id = 'manhwa';


-- ----------------------------------------------------------------------------
-- 20260516185320_4858ca60-5637-4d34-b6e4-e557a69e79c7.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'reader');
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'author');
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 20260522185257_10a2c630-2a3b-49db-8c77-8f0a3fc282b4.sql
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 20260601120000_hardening.sql
-- ----------------------------------------------------------------------------
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


