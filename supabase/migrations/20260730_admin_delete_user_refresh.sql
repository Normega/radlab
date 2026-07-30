-- admin_delete_user: refresh the cascade, 18 months stale.
--
-- The list last moved on 2026-07-12 (20260712_admin_delete_cascade.sql). Every
-- table added since — and every participant/lab table that was never in it —
-- has a NO ACTION foreign key to profiles, so `DELETE FROM profiles` raised
-- "violates foreign key constraint" and the whole RPC aborted. In practice
-- admin deletion worked only for accounts that had done almost nothing:
--   * missing personal/game data: equity_census_responses, breath_guardian_sessions,
--     pond_watch_results, zerin_daily_checkins, ripple_unsubscribe_tokens
--   * missing participant tier: study_enrollments, participant_schedule,
--     participant_links, participant_assignments, participant_activity_log,
--     participant_unsubscribe_tokens, message_log, liliana_participants,
--     liliana_midpoint_feedback
--   * missing lab-authored content: classes, displays, slider_scales,
--     vas_scales, vas_packages, study_consent_forms, study_enrollments.enrolled_by
--
-- Two policy decisions, both deliberate:
--
-- 1. PARTICIPANT DATA IS DELETED. The 2026-07-12 header said cascade "would be
--    risky on study-participant tables where we want to preserve data even if a
--    profile is removed" — but a NO ACTION FK cannot preserve anything; it just
--    made the delete fail. Preserving rows that point at a deleted profile is
--    not an option the schema offers. If a participant's data should outlive
--    them, do not delete the account — withdraw the enrollment instead.
--
-- 2. LAB-AUTHORED CONTENT IS PRESERVED, AUTHORSHIP DETACHED. Questionnaires,
--    studies, protocols, video library and training modules already SET NULL
--    their created_by on profile delete; this extends the same treatment by
--    hand to the tables whose FK is NO ACTION. Deleting a lab member must not
--    delete the study instruments they authored.
--    `vas_scales.created_by` and `vas_packages.created_by` are NOT NULL, so
--    they cannot be detached — those rows are REASSIGNED to the super admin
--    performing the deletion, which is recorded in the return payload.
--
-- Guards are unchanged: super admin only, never self, never another super
-- admin. The `is_super_admin()` null-safety fix (20260729) is untouched.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $$
DECLARE
  v_email     text;
  v_actor     uuid := auth.uid();
  v_target    public.profiles%ROWTYPE;
  v_reassigned int := 0;
  v_n          int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;
  IF p_target = v_actor THEN
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

  -- ── Lab-authored content: keep the content, drop the authorship ─────────
  UPDATE public.classes             SET created_by  = NULL WHERE created_by  = p_target;
  UPDATE public.displays            SET created_by  = NULL WHERE created_by  = p_target;
  UPDATE public.slider_scales       SET created_by  = NULL WHERE created_by  = p_target;
  UPDATE public.study_consent_forms SET uploaded_by = NULL WHERE uploaded_by = p_target;
  UPDATE public.study_enrollments   SET enrolled_by = NULL WHERE enrolled_by = p_target;

  -- NOT NULL created_by: reassign to the acting super admin rather than delete
  -- the scale, which other studies may reference.
  UPDATE public.vas_scales   SET created_by = v_actor WHERE created_by = p_target;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_reassigned := v_reassigned + v_n;
  UPDATE public.vas_packages SET created_by = v_actor WHERE created_by = p_target;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_reassigned := v_reassigned + v_n;

  -- ── Lecture Lounge (child rows first) ───────────────────────────────────
  DELETE FROM public.question_votes     WHERE profile_id = p_target;
  DELETE FROM public.class_questions    WHERE profile_id = p_target;
  DELETE FROM public.checkin_responses  WHERE profile_id = p_target;
  DELETE FROM public.class_members      WHERE user_id    = p_target;
  DELETE FROM public.class_admins       WHERE user_id    = p_target;

  -- ── Ripple / onboarding ─────────────────────────────────────────────────
  -- MUST precede the study-participation block below: equity_census_responses
  -- holds NO ACTION foreign keys to BOTH participant_schedule and
  -- study_enrollments, so deleting those first aborts the whole function.
  -- (demographics points at the same two, but SET NULL / CASCADE, so it is
  -- order-independent — equity_census_responses is the one that bites.)
  DELETE FROM public.ripple_unsubscribe_tokens WHERE user_id = p_target;
  DELETE FROM public.ripple_checkins           WHERE user_id = p_target;
  DELETE FROM public.ripples                   WHERE user_id = p_target;
  DELETE FROM public.consents                  WHERE user_id = p_target;
  DELETE FROM public.equity_census_responses   WHERE user_id = p_target;
  DELETE FROM public.demographics              WHERE user_id = p_target;

  -- ── Study participation ─────────────────────────────────────────────────
  -- liliana_day_data / intervention_responses / liliana_midpoint_feedback all
  -- CASCADE from liliana_participants; participant_compensation CASCADEs from
  -- study_enrollments; participant_links CASCADEs from participant_schedule.
  DELETE FROM public.liliana_midpoint_feedback      WHERE profile_id     = p_target;
  DELETE FROM public.liliana_participants           WHERE profile_id     = p_target;
  DELETE FROM public.message_log                    WHERE participant_id = p_target;
  DELETE FROM public.participant_activity_log       WHERE participant_id = p_target;
  DELETE FROM public.participant_unsubscribe_tokens WHERE participant_id = p_target;
  DELETE FROM public.participant_links              WHERE participant_id = p_target;
  DELETE FROM public.participant_schedule           WHERE participant_id = p_target;
  DELETE FROM public.participant_assignments        WHERE participant_id = p_target;
  DELETE FROM public.study_enrollments              WHERE profile_id     = p_target;

  -- ── Game data ───────────────────────────────────────────────────────────
  DELETE FROM public.belt_trials            WHERE user_id = p_target;
  DELETE FROM public.belt_sessions          WHERE user_id = p_target;
  DELETE FROM public.face_read_trials       WHERE user_id = p_target;
  DELETE FROM public.face_read_performance  WHERE user_id = p_target;
  DELETE FROM public.farm_joy_trials        WHERE user_id = p_target;
  DELETE FROM public.farm_joy_feedback      WHERE user_id = p_target;
  DELETE FROM public.farm_joy_value_history WHERE user_id = p_target;
  DELETE FROM public.farm_joy_performance   WHERE user_id = p_target;
  DELETE FROM public.drift_trials
    WHERE session_id IN (SELECT id FROM public.drift_performance WHERE user_id = p_target);
  DELETE FROM public.drift_performance        WHERE user_id = p_target;
  DELETE FROM public.breath_guardian_sessions WHERE user_id = p_target;
  DELETE FROM public.stillwater_responses     WHERE user_id = p_target;
  DELETE FROM public.pond_watch_results       WHERE user_id = p_target;
  DELETE FROM public.zerin_daily_checkins     WHERE user_id = p_target;
  DELETE FROM public.vas_responses            WHERE user_id = p_target;

  -- ── Avatar / cosmetics ──────────────────────────────────────────────────
  DELETE FROM public.word_max_sessions  WHERE user_id = p_target;
  DELETE FROM public.avatar_unlocks     WHERE user_id = p_target;
  DELETE FROM public.avatars            WHERE user_id = p_target;

  -- ── Profile then auth ───────────────────────────────────────────────────
  -- game_sessions / questionnaire_responses / aptitude_sessions /
  -- screener_results / participant_audio_sessions / participant_video_sessions
  -- all CASCADE from profiles.
  DELETE FROM public.profiles WHERE id = p_target;
  DELETE FROM auth.users      WHERE id = p_target;

  RETURN jsonb_build_object(
    'deleted', p_target,
    'email', v_email,
    'reassigned_vas_rows', v_reassigned
  );
END;
$$;

COMMENT ON FUNCTION public.admin_delete_user(uuid) IS
  'Super-admin hard delete. Deletes the account and all of its personal, game and study-participation data; preserves lab-authored content by nulling created_by (or reassigning to the acting admin where created_by is NOT NULL). Refreshed 2026-07-30 — the previous list predated 9 tables and FK-errored on participants and lab members.';
