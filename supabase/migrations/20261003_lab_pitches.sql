-- lab_pitches: the "Pitch Us Something" form on /lab/contact.
--
-- Anyone can submit, but never directly: api/pitch.js validates, rate-limits
-- and inserts with the service key. So there is deliberately NO insert policy
-- for anon or authenticated, and anon holds no table grant at all. Lab members
-- may read pitches and move them through status; nobody may delete one through
-- the API (the service role still can, for test-row cleanup).
--
-- ip_hash is a salted SHA-256 of the submitter's IP (same scheme as
-- api/roster-join.js), kept only so the endpoint can cap submissions per IP.

CREATE TABLE IF NOT EXISTS public.lab_pitches (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email         text        NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  role          text        NOT NULL CHECK (role IN ('undergrad', 'grad', 'postdoc', 'other')),
  build_what    text        NOT NULL CHECK (char_length(build_what) BETWEEN 1 AND 3000),
  values_fit    text        NOT NULL CHECK (char_length(values_fit) BETWEEN 1 AND 3000),
  portfolio_url text        NOT NULL CHECK (char_length(portfolio_url) <= 500 AND portfolio_url ~* '^https?://'),
  ip_hash       text,
  status        text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'archived'))
);

COMMENT ON TABLE public.lab_pitches IS
  'Pitches from /lab/contact. Inserted only by api/pitch.js (service key); lab role reads and updates status.';

-- The rate limit counts one IP's rows in the last 24 h.
CREATE INDEX IF NOT EXISTS lab_pitches_ip_recent
  ON public.lab_pitches (ip_hash, created_at DESC);

ALTER TABLE public.lab_pitches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lab_pitches FROM anon;

-- COALESCE: my_role() is NULL for a user with no profile row, and
-- NULL OR false is NULL, not false (20260729_null_guard_security_fixes.sql).
DROP POLICY IF EXISTS "lab_pitches: lab read" ON public.lab_pitches;
CREATE POLICY "lab_pitches: lab read"
  ON public.lab_pitches FOR SELECT TO authenticated
  USING (COALESCE(public.my_role() = 'lab', false) OR public.is_super_admin());

DROP POLICY IF EXISTS "lab_pitches: lab update" ON public.lab_pitches;
CREATE POLICY "lab_pitches: lab update"
  ON public.lab_pitches FOR UPDATE TO authenticated
  USING (COALESCE(public.my_role() = 'lab', false) OR public.is_super_admin())
  WITH CHECK (COALESCE(public.my_role() = 'lab', false) OR public.is_super_admin());

-- Verify (expect two rows: SELECT and UPDATE, both authenticated):
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'lab_pitches';
-- Verify anon has no grant (expect no rows):
--   SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE table_name = 'lab_pitches' AND grantee = 'anon';
