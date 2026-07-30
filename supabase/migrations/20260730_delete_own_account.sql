-- delete_own_account() — self-serve account deletion for the Settings page.
--
-- Mirrors admin_delete_user's explicit-ordered-delete approach (see
-- 20260712_admin_delete_cascade.sql for why explicit deletes rather than
-- blanket ON DELETE CASCADE), but with a much narrower blast radius:
--
--   PUBLIC TIER ONLY. A participant's rows are study data — deleting them
--   mid-study silently corrupts someone's dataset, and withdrawal is an
--   RA-mediated process, not a button. A lab member authors content
--   (questionnaires, VAS scales, classes, displays) whose FKs are NO ACTION
--   against profiles, so a self-delete would either fail or orphan it. Both
--   are refused here and told to contact the lab.
--
-- Every delete is keyed on auth.uid() rather than a parameter — there is no
-- target argument, so this function cannot be pointed at another account.
--
-- Table list derived 2026-07-30 by enumerating every public table with a
-- user_id/profile_id column and checking its FK delete action. Tables whose FK
-- already CASCADEs from profiles or auth.users are noted but still deleted
-- explicitly where the ordering matters; tables with NO FK at all (pond_watch
-- _results, zerin_daily_checkins, liliana_midpoint_feedback) would otherwise
-- leave orphaned rows carrying a dangling user_id, so they are deleted too.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
  v_me    public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such profile';
  END IF;

  -- Guardrails. These are the whole point of the function being separate from
  -- admin_delete_user; loosen them only with a deliberate decision.
  IF COALESCE(v_me.super_admin, false) THEN
    RAISE EXCEPTION 'super admins cannot self-delete';
  END IF;
  IF COALESCE(v_me.role, 'public') <> 'public' THEN
    RAISE EXCEPTION 'only public accounts can self-delete';
  END IF;

  -- Belt and braces. The role guard above is the real gate, and as of
  -- 2026-07-30 no public-tier profile has a row in any of these. But nothing
  -- structurally prevents a public account from being enrolled in a study
  -- later, and every one of these tables has a NO ACTION FK to profiles that
  -- this function does not delete from — so without this check the user would
  -- get a raw foreign-key error instead of an explanation.
  IF EXISTS (SELECT 1 FROM public.study_enrollments      WHERE profile_id     = v_uid)
  OR EXISTS (SELECT 1 FROM public.participant_schedule   WHERE participant_id = v_uid)
  OR EXISTS (SELECT 1 FROM public.participant_links      WHERE participant_id = v_uid)
  OR EXISTS (SELECT 1 FROM public.participant_assignments WHERE participant_id = v_uid)
  THEN
    RAISE EXCEPTION 'account is enrolled in a study — contact the lab to withdraw';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- ── Lecture Lounge (child rows first) ───────────────────────────────────
  DELETE FROM public.question_votes      WHERE profile_id = v_uid;
  DELETE FROM public.class_questions     WHERE profile_id = v_uid;
  DELETE FROM public.checkin_responses   WHERE profile_id = v_uid;
  DELETE FROM public.class_members       WHERE user_id    = v_uid;
  DELETE FROM public.class_admins        WHERE user_id    = v_uid;

  -- ── Ripple / onboarding ─────────────────────────────────────────────────
  DELETE FROM public.ripple_unsubscribe_tokens WHERE user_id = v_uid;
  DELETE FROM public.ripple_checkins           WHERE user_id = v_uid;
  DELETE FROM public.ripples                   WHERE user_id = v_uid;
  DELETE FROM public.consents                  WHERE user_id = v_uid;
  DELETE FROM public.demographics              WHERE user_id = v_uid;
  DELETE FROM public.equity_census_responses   WHERE user_id = v_uid;

  -- ── Game data ───────────────────────────────────────────────────────────
  DELETE FROM public.belt_trials            WHERE user_id = v_uid;
  DELETE FROM public.belt_sessions          WHERE user_id = v_uid;
  DELETE FROM public.face_read_trials       WHERE user_id = v_uid;
  DELETE FROM public.face_read_performance  WHERE user_id = v_uid;
  DELETE FROM public.farm_joy_trials        WHERE user_id = v_uid;
  DELETE FROM public.farm_joy_feedback      WHERE user_id = v_uid;
  DELETE FROM public.farm_joy_value_history WHERE user_id = v_uid;
  DELETE FROM public.farm_joy_performance   WHERE user_id = v_uid;
  -- drift_trials links through session_id, not user_id
  DELETE FROM public.drift_trials
    WHERE session_id IN (SELECT id FROM public.drift_performance WHERE user_id = v_uid);
  DELETE FROM public.drift_performance      WHERE user_id = v_uid;
  DELETE FROM public.breath_guardian_sessions WHERE user_id = v_uid;
  DELETE FROM public.stillwater_responses   WHERE user_id = v_uid;
  DELETE FROM public.pond_watch_results     WHERE user_id = v_uid;
  DELETE FROM public.zerin_daily_checkins   WHERE user_id = v_uid;
  DELETE FROM public.vas_responses          WHERE user_id = v_uid;

  -- ── Avatar / cosmetics ──────────────────────────────────────────────────
  DELETE FROM public.word_max_sessions   WHERE user_id = v_uid;
  DELETE FROM public.avatar_unlocks      WHERE user_id = v_uid;
  DELETE FROM public.avatars             WHERE user_id = v_uid;

  -- ── Profile then auth ───────────────────────────────────────────────────
  -- game_sessions / questionnaire_responses / aptitude_sessions CASCADE from
  -- profiles; auth.sessions / identities CASCADE from auth.users.
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users      WHERE id = v_uid;

  RETURN jsonb_build_object('deleted', v_uid, 'email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMENT ON FUNCTION public.delete_own_account() IS
  'Self-serve account deletion, public tier only. Keyed on auth.uid(); takes no target. Refuses participants (study data) and lab/super-admin accounts (authored content).';
