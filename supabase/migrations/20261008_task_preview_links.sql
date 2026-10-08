-- Task preview links — share a no-save preview of a lab task with someone
-- outside the lab (website.md §25a, admin "Task Library").
--
-- A lab member issues a link from /admin/tasks; it opens /preview/:token,
-- which needs no account. The preview page runs the game against a stub
-- database client that never reaches Supabase, so nothing the viewer does is
-- saved — the only write a link ever causes is the open counter below.
--
-- The token is stored in the clear (not hashed like buddy_sends) so a lab
-- member can copy an issued link again later. It grants nothing but the
-- right to play a game whose results go nowhere, and the table is lab-only.

CREATE TABLE IF NOT EXISTS public.task_preview_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token          text NOT NULL UNIQUE
                   DEFAULT pg_catalog.encode(extensions.gen_random_bytes(16), 'hex'),
  game_slug      text NOT NULL CHECK (game_slug ~ '^[a-z_]+$'),  -- activities.subcategory
  recipient      text CHECK (char_length(recipient) <= 200),     -- the lab's own note of who it went to
  quick_demo     boolean NOT NULL DEFAULT false,                 -- 20 s session timer (src/lib/demoMode.js)
  created_by     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  open_count     integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz
);

CREATE INDEX IF NOT EXISTS task_preview_links_created_at
  ON public.task_preview_links (created_at DESC);

ALTER TABLE public.task_preview_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_preview_links: lab full access" ON public.task_preview_links;
CREATE POLICY "task_preview_links: lab full access"
  ON public.task_preview_links FOR ALL TO authenticated
  USING      (COALESCE(public.my_role() = 'lab', false) OR public.is_super_admin())
  WITH CHECK (COALESCE(public.my_role() = 'lab', false) OR public.is_super_admin());

-- ── open_task_preview — the token is the credential (anon + authenticated) ──
-- Returns { state: 'ok', game_slug, quick_demo, expires_at } for a live link,
-- otherwise { state: 'not_found' | 'expired' | 'revoked' }. Counts the open on
-- 'ok' only. Mail scanners that pre-open links (UofT Safe Links) count too, so
-- open_count is an upper bound on people, not a headcount.
CREATE OR REPLACE FUNCTION public.open_task_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.task_preview_links%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  SELECT * INTO v_link FROM public.task_preview_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('state', 'revoked');
  END IF;
  IF v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('state', 'expired');
  END IF;

  UPDATE public.task_preview_links
     SET open_count = open_count + 1, last_opened_at = now()
   WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'state',      'ok',
    'game_slug',  v_link.game_slug,
    'quick_demo', v_link.quick_demo,
    'expires_at', v_link.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_task_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_task_preview(text) TO anon, authenticated;
