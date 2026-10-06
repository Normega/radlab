-- Interoception wiki (interoception.radlab.zone): research-gap votes and
-- reader suggestions.
--
-- The wiki is a static Quartz site in its own repo (Normega/interoception-wiki).
-- It signs readers in with their radlab.zone account (password grant against
-- this project's Auth) and talks to PostgREST directly with the anon key, so
-- every rule lives here, in RLS.
--
-- Gaps themselves are markdown pages in the wiki repo (wiki/gaps/<slug>.md);
-- this table holds only votes, keyed by that slug. A vote for a slug with no
-- page is harmless: nothing displays it.
--
-- Not participant data: neither table is a response table under CLAUDE.md
-- "Participant data logging", and a vote is meant to be withdrawn freely.

-- ---------------------------------------------------------------------------
-- Votes: one per reader per gap; a reader sees and changes only their own.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_gap_votes (
  gap_slug   text        NOT NULL CHECK (gap_slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  user_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gap_slug, user_id)
);

COMMENT ON TABLE public.wiki_gap_votes IS
  'Interoception wiki research-gap votes. One row per (gap, reader). Totals via wiki_gap_vote_counts().';

ALTER TABLE public.wiki_gap_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wiki_gap_votes FROM anon;
GRANT SELECT, INSERT, DELETE ON public.wiki_gap_votes TO authenticated;

DROP POLICY IF EXISTS "own rows" ON public.wiki_gap_votes;
CREATE POLICY "own rows"
  ON public.wiki_gap_votes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Totals for everyone, signed in or not. Definer so it can count rows RLS
-- would hide; it returns counts only, never who voted.
CREATE OR REPLACE FUNCTION public.wiki_gap_vote_counts()
RETURNS TABLE (gap_slug text, votes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.gap_slug, count(*)::bigint
    FROM public.wiki_gap_votes v
   GROUP BY v.gap_slug
$$;

REVOKE ALL ON FUNCTION public.wiki_gap_vote_counts() FROM public;
GRANT EXECUTE ON FUNCTION public.wiki_gap_vote_counts() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Suggestions: a paper to ingest or a gap to add. Readers insert and read
-- their own; lab members and super admins read all and move them through
-- status. Nothing reaches the wiki without the curator: there is no path from
-- a row here to a published page.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_suggestions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  kind       text        NOT NULL CHECK (kind IN ('paper', 'gap')),
  title      text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 300),
  details    text        NOT NULL DEFAULT '' CHECK (char_length(details) <= 3000),
  doi        text        CHECK (doi IS NULL OR char_length(doi) <= 200),
  status     text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'declined'))
);

COMMENT ON TABLE public.wiki_suggestions IS
  'Interoception wiki reader suggestions (paper to ingest / gap to add). Curator reviews; never auto-published.';

CREATE INDEX IF NOT EXISTS wiki_suggestions_user_recent
  ON public.wiki_suggestions (user_id, created_at DESC);

ALTER TABLE public.wiki_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wiki_suggestions FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.wiki_suggestions TO authenticated;

-- Insert: own rows only, always as 'new', at most 20 in any 24 h.
DROP POLICY IF EXISTS "wiki_suggestions: insert own" ON public.wiki_suggestions;
CREATE POLICY "wiki_suggestions: insert own"
  ON public.wiki_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'new'
    AND (SELECT count(*) FROM public.wiki_suggestions s
          WHERE s.user_id = auth.uid() AND s.created_at > now() - interval '24 hours') < 20
  );

-- COALESCE: my_role() is NULL for a user with no profile row
-- (20260729_null_guard_security_fixes.sql).
DROP POLICY IF EXISTS "wiki_suggestions: read own or lab" ON public.wiki_suggestions;
CREATE POLICY "wiki_suggestions: read own or lab"
  ON public.wiki_suggestions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR COALESCE(public.my_role() = 'lab', false)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "wiki_suggestions: lab update" ON public.wiki_suggestions;
CREATE POLICY "wiki_suggestions: lab update"
  ON public.wiki_suggestions FOR UPDATE TO authenticated
  USING (COALESCE(public.my_role() = 'lab', false) OR public.is_super_admin())
  WITH CHECK (COALESCE(public.my_role() = 'lab', false) OR public.is_super_admin());

-- Verify policies (expect: wiki_gap_votes "own rows" ALL; wiki_suggestions
-- INSERT, SELECT, UPDATE):
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('wiki_gap_votes', 'wiki_suggestions') ORDER BY 1, 3;
-- Verify anon holds no table grant (expect no rows):
--   SELECT table_name, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name IN ('wiki_gap_votes', 'wiki_suggestions') AND grantee = 'anon';
-- Read the queue:
--   SELECT created_at, kind, title, doi, details, status FROM wiki_suggestions
--    WHERE status = 'new' ORDER BY created_at;
