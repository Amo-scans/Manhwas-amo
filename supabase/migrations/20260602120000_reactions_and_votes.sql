-- Emoji reactions at the end of a chapter + like/dislike votes on comments.
-- Safe to run on the existing project: it only adds new objects.

-- ---------------------------------------------------------------- reactions
CREATE TYPE public.reaction_kind AS ENUM ('like', 'love', 'haha', 'wow', 'sad', 'fire');

CREATE TABLE IF NOT EXISTS public.chapter_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction public.reaction_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, user_id)
);

CREATE INDEX IF NOT EXISTS chapter_reactions_chapter_idx
  ON public.chapter_reactions (chapter_id, reaction);

ALTER TABLE public.chapter_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chapter reactions are public" ON public.chapter_reactions;
CREATE POLICY "Chapter reactions are public"
  ON public.chapter_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own chapter reaction" ON public.chapter_reactions;
CREATE POLICY "Users insert own chapter reaction"
  ON public.chapter_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own chapter reaction" ON public.chapter_reactions;
CREATE POLICY "Users update own chapter reaction"
  ON public.chapter_reactions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own chapter reaction" ON public.chapter_reactions;
CREATE POLICY "Users delete own chapter reaction"
  ON public.chapter_reactions FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------- comment votes
CREATE TABLE IF NOT EXISTS public.comment_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_votes_comment_idx
  ON public.comment_votes (comment_id, value);

ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comment votes are public" ON public.comment_votes;
CREATE POLICY "Comment votes are public"
  ON public.comment_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own comment vote" ON public.comment_votes;
CREATE POLICY "Users insert own comment vote"
  ON public.comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own comment vote" ON public.comment_votes;
CREATE POLICY "Users update own comment vote"
  ON public.comment_votes FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own comment vote" ON public.comment_votes;
CREATE POLICY "Users delete own comment vote"
  ON public.comment_votes FOR DELETE USING (auth.uid() = user_id);
