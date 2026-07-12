-- Fix admin_delete_user: add explicit deletes for all user-owned data tables
-- before touching profiles, so no FK constraint can block the deletion.
--
-- Root cause: the original RPC only deleted word_max_sessions / avatar_unlocks /
-- avatars before profiles, missing demographics (and every game data table).
-- Deleting profiles with demographics.user_id still pointing at it raised
-- "violates foreign key constraint demographics_user_id_fkey".
--
-- Approach: explicit ordered deletes rather than adding ON DELETE CASCADE to
-- every FK.  Cascade would be risky on study-participant tables (enrollments,
-- participant_schedule, etc.) where we want to preserve data even if a profile
-- is removed.  Explicit deletes are visible, auditable, and easy to extend.
--
-- Order: leaf tables (no dependents) first, then their parents.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $$
DECLARE
  v_email text;
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete your own account';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such user';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target;
  IF FOUND AND COALESCE(v_target.super_admin, false) THEN
    RAISE EXCEPTION 'cannot delete a super admin';
  END IF;

  -- ── Lecture Lounge (child tables first) ─────────────────────────────────
  DELETE FROM public.question_votes     WHERE profile_id = p_target;
  DELETE FROM public.class_questions    WHERE profile_id = p_target;
  DELETE FROM public.checkin_responses  WHERE profile_id = p_target;
  DELETE FROM public.class_members      WHERE user_id    = p_target;
  DELETE FROM public.class_admins       WHERE user_id    = p_target;

  -- ── Ripple / onboarding ──────────────────────────────────────────────────
  DELETE FROM public.ripple_checkins    WHERE user_id = p_target;
  DELETE FROM public.ripples            WHERE user_id = p_target;
  DELETE FROM public.consents           WHERE user_id = p_target;
  DELETE FROM public.demographics       WHERE user_id = p_target;

  -- ── Game data ────────────────────────────────────────────────────────────
  DELETE FROM public.belt_trials           WHERE user_id = p_target;
  DELETE FROM public.belt_sessions         WHERE user_id = p_target;
  DELETE FROM public.face_read_trials      WHERE user_id = p_target;
  DELETE FROM public.face_read_performance WHERE user_id = p_target;
  DELETE FROM public.farm_joy_trials       WHERE user_id = p_target;
  DELETE FROM public.farm_joy_feedback     WHERE user_id = p_target;
  DELETE FROM public.farm_joy_value_history WHERE user_id = p_target;
  DELETE FROM public.farm_joy_performance  WHERE user_id = p_target;
  -- drift_trials links through session_id (not user_id); drift_performance has user_id
  DELETE FROM public.drift_trials
    WHERE session_id IN (SELECT id FROM public.drift_performance WHERE user_id = p_target);
  DELETE FROM public.drift_performance     WHERE user_id = p_target;
  DELETE FROM public.stillwater_responses  WHERE user_id = p_target;
  DELETE FROM public.vas_responses         WHERE user_id = p_target;

  -- ── Avatar / cosmetics ───────────────────────────────────────────────────
  DELETE FROM public.word_max_sessions  WHERE user_id = p_target;
  DELETE FROM public.avatar_unlocks     WHERE user_id = p_target;
  DELETE FROM public.avatars            WHERE user_id = p_target;

  -- ── Profile then auth ────────────────────────────────────────────────────
  -- game_sessions / questionnaire_responses / aptitude_sessions already
  -- CASCADE from profiles, so deleting profiles handles them automatically.
  DELETE FROM public.profiles WHERE id = p_target;
  DELETE FROM auth.users      WHERE id = p_target;

  RETURN jsonb_build_object('deleted', p_target, 'email', v_email);
END;
$$;
