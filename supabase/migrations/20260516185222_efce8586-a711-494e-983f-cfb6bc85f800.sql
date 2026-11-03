
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

-- CHAPTERS policies — visibility based on parent series
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
