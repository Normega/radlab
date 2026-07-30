-- SECURITY: six SECURITY DEFINER functions were reachable by anonymous callers.
--
-- Found 2026-07-29 while gate-testing the new admin_service_diagnostics() RPC:
-- its `IF NOT is_super_admin() THEN RAISE EXCEPTION 'forbidden'` did not fire
-- for a caller with no identity. The cause is three-valued logic, and it was
-- copied into every guard in the codebase:
--
--     is_super_admin() = SELECT COALESCE(super_admin, false)
--                          FROM profiles WHERE id = auth.uid()
--
-- With no JWT, auth.uid() IS NULL, the query matches NO ROWS, and a SQL function
-- with no rows returns **NULL** — the COALESCE inside never runs. `NOT NULL` is
-- NULL, which is not TRUE, so `IF NOT …` falls through and the body executes.
-- my_role() (`select role from profiles where id = auth.uid()`) is NULL the same
-- way, so `my_role() = 'lab' OR is_super_admin()` was NULL OR false = NULL.
--
-- Confirmed by real HTTP requests carrying only the public anon key — the key
-- that ships inside the client bundle:
--
--   POST /rest/v1/rpc/admin_list_users            -> 200, 184 rows, every email
--   POST /rest/v1/rpc/get_liliana_credit_report   -> 200, participant rows
--                                                    (profile_id, display_name,
--                                                    credit_hours, minutes)
--   get_class_participation / get_checkin_quiz_results / get_checkin_mood_results
--     -> same class: class members' utoronto_email, quiz responses + answer key,
--        mood distributions. Reasoned from identical guard shape, then verified
--        refused after the fix.
--   admin_set_user_role / admin_delete_user / duplicate_study -> same guard
--     shape, NOT probed because they mutate.
--
-- After: all six return forbidden to an anonymous caller (`400 forbidden: super
-- admin only` for the admin_* RPCs, `200 {"error":"forbidden"}` for the report
-- RPCs, which is their own pre-existing convention).
--
-- RLS policies are NOT affected by this class of bug: a policy expression
-- evaluating to NULL filters the row out, so NULL fails closed there. It is only
-- dangerous in `IF NOT …` control flow, where NULL means "don't take the branch".
--
-- The radlab-academic project was swept too and is clean: is_course_staff() /
-- is_course_member() are `select exists(…)`, which returns false rather than NULL
-- (verified live), and review_proposal() / unpublish_page() both raise
-- 'no identity for caller' before any staff check.
--
-- Applied 2026-07-29 as four MCP migrations, in this order:
--   is_super_admin_null_safe
--   duplicate_study_null_safe_guard
--   liliana_credit_report_null_safe_guard
--   checkin_report_guards_null_safe
--
-- Convention going forward: **a boolean helper used in `IF NOT …` must never be
-- able to return NULL.** Wrap the SUBQUERY, not the column, and prefer
-- `select exists(…)`. When combining, COALESCE each nullable comparison.

-- ── 1. The root cause: COALESCE must wrap the subquery, not sit inside it ─────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT super_admin FROM profiles WHERE id = auth.uid()), false);
$$;

-- ── 2-4. Guards that combine my_role() with is_super_admin() ─────────────────
-- Each was applied as a self-patch of the live definition (pg_get_functiondef ->
-- asserted replace -> EXECUTE) so that every other line of these functions is
-- provably byte-identical to what was already running. Re-running is safe: the
-- asserts fail loudly if the target text is already gone.

DO $do$
DECLARE d text; d2 text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'duplicate_study';
  IF d IS NULL THEN RAISE EXCEPTION 'duplicate_study not found'; END IF;

  d2 := replace(d,
    'IF NOT (public.my_role() = ''lab'' OR public.is_super_admin()) THEN',
    'IF NOT (COALESCE(public.my_role(), '''') = ''lab'' OR public.is_super_admin()) THEN');
  IF d2 = d THEN RAISE EXCEPTION 'duplicate_study guard not found verbatim'; END IF;

  EXECUTE d2;
END
$do$;

DO $do$
DECLARE d text; d2 text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_liliana_credit_report';
  IF d IS NULL THEN RAISE EXCEPTION 'get_liliana_credit_report not found'; END IF;

  d2 := replace(d,
    'SELECT my_role() = ''lab'' OR is_super_admin() INTO v_allowed;',
    'SELECT COALESCE(my_role() = ''lab'', false) OR is_super_admin() INTO v_allowed;');
  IF d2 = d THEN RAISE EXCEPTION 'v_allowed assignment not found verbatim'; END IF;

  EXECUTE d2;
END
$do$;

DO $do$
DECLARE
  fn text;
  d  text;
  d2 text;
  n  int := 0;
BEGIN
  FOREACH fn IN ARRAY ARRAY['get_checkin_mood_results',
                            'get_checkin_quiz_results',
                            'get_class_participation']
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO d
      FROM pg_proc p JOIN pg_namespace n2 ON n2.oid = p.pronamespace
      WHERE n2.nspname = 'public' AND p.proname = fn;
    IF d IS NULL THEN RAISE EXCEPTION '% not found', fn; END IF;

    d2 := replace(d,
      'my_role() = ''lab'' OR is_super_admin()',
      'COALESCE(my_role() = ''lab'', false) OR is_super_admin()');
    IF d2 = d THEN RAISE EXCEPTION 'guard expression not found verbatim in %', fn; END IF;

    EXECUTE d2;
    n := n + 1;
  END LOOP;

  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 patches, made %', n; END IF;
END
$do$;

-- Re-verify any time (expect false, false — never NULL):
--   SELECT is_super_admin(), is_super_admin() IS NULL;
-- and from a shell, with the anon key only:
--   curl -s -X POST "$URL/rest/v1/rpc/admin_list_users" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     -H 'Content-Type: application/json' -d '{}'
--   -> {"code":"P0001","message":"forbidden: super admin only"}
