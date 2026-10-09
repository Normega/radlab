-- admin_delete_user failed for anyone who had filled in a demographics form: the
-- student and Liliana demographics tables hold NO ACTION foreign keys to profiles,
-- study_enrollments and participant_schedule, so deleting the participation rows
-- aborted the whole call ("violates foreign key constraint
-- student_demographics_schedule_id_fkey"). Found cleaning up the PSY240 class
-- trial's smoke-test participant (2026-10-09). It would have failed the same way for
-- any of Liliana Study 3's participants who completed her demographics (156 rows).
--
-- 1. admin_delete_user deletes both demographics tables before the participation
--    block, as it already does the equity census (website.md §12c: participant data
--    is deleted with the account; withdraw the enrollment instead to keep it).
--    Copied from the live definition (pg_get_functiondef md5 9ac7f9422133a08f645e6182c08cd4cc); only the
--    two DELETEs after `demographics` are added.
-- 2. CLAUDE.md rule 1: a participant-data table's schedule_id uses ON DELETE SET
--    NULL, so deleting a schedule row never deletes, or is blocked by, an answer.
--    Three tables still had NO ACTION; now SET NULL.
--
-- Not covered: class board posts (board_threads / board_replies.author_id, NOT
-- NULL, NO ACTION) still block deleting an account that has posted. Whether a
-- deleted student's posts go or stay is a policy question, left open.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
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

  UPDATE public.classes             SET created_by  = NULL WHERE created_by  = p_target;
  UPDATE public.displays            SET created_by  = NULL WHERE created_by  = p_target;
  UPDATE public.slider_scales       SET created_by  = NULL WHERE created_by  = p_target;
  UPDATE public.study_consent_forms SET uploaded_by = NULL WHERE uploaded_by = p_target;
  UPDATE public.study_enrollments   SET enrolled_by = NULL WHERE enrolled_by = p_target;

  UPDATE public.vas_scales   SET created_by = v_actor WHERE created_by = p_target;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_reassigned := v_reassigned + v_n;
  UPDATE public.vas_packages SET created_by = v_actor WHERE created_by = p_target;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_reassigned := v_reassigned + v_n;

  DELETE FROM public.question_votes     WHERE profile_id = p_target;
  DELETE FROM public.class_questions    WHERE profile_id = p_target;
  DELETE FROM public.checkin_responses  WHERE profile_id = p_target;
  DELETE FROM public.class_members      WHERE user_id    = p_target;
  DELETE FROM public.class_admins       WHERE user_id    = p_target;

  DELETE FROM public.ripple_unsubscribe_tokens WHERE user_id = p_target;
  DELETE FROM public.ripple_checkins           WHERE user_id = p_target;
  DELETE FROM public.ripples                   WHERE user_id = p_target;
  DELETE FROM public.consents                  WHERE user_id = p_target;
  DELETE FROM public.equity_census_responses   WHERE user_id = p_target;
  DELETE FROM public.demographics              WHERE user_id = p_target;
  -- Demographic forms hold NO ACTION FKs to the account, the enrollment and the
  -- schedule row, so they go before the participation block, like the equity census
  -- (20261009_admin_delete_user_demographics.sql).
  DELETE FROM public.student_demographics
    WHERE user_id = p_target
       OR enrollment_id IN (SELECT id FROM public.study_enrollments WHERE profile_id = p_target)
       OR schedule_id IN (SELECT id FROM public.participant_schedule WHERE participant_id = p_target);
  DELETE FROM public.liliana_demographics
    WHERE user_id = p_target
       OR enrollment_id IN (SELECT id FROM public.study_enrollments WHERE profile_id = p_target)
       OR schedule_id IN (SELECT id FROM public.participant_schedule WHERE participant_id = p_target);

  DELETE FROM public.liliana_midpoint_feedback      WHERE profile_id     = p_target;
  DELETE FROM public.liliana_participants           WHERE profile_id     = p_target;
  DELETE FROM public.message_log                    WHERE participant_id = p_target;
  DELETE FROM public.participant_activity_log       WHERE participant_id = p_target;
  DELETE FROM public.participant_unsubscribe_tokens WHERE participant_id = p_target;
  DELETE FROM public.participant_links              WHERE participant_id = p_target;
  DELETE FROM public.participant_schedule           WHERE participant_id = p_target;
  DELETE FROM public.participant_assignments        WHERE participant_id = p_target;
  DELETE FROM public.study_enrollments              WHERE profile_id     = p_target;

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

  DELETE FROM public.word_max_sessions  WHERE user_id = p_target;
  DELETE FROM public.avatar_unlocks     WHERE user_id = p_target;
  DELETE FROM public.avatars            WHERE user_id = p_target;

  DELETE FROM public.profiles WHERE id = p_target;
  DELETE FROM auth.users      WHERE id = p_target;

  RETURN jsonb_build_object(
    'deleted', p_target,
    'email', v_email,
    'reassigned_vas_rows', v_reassigned
  );
END;
$function$;

alter table public.student_demographics drop constraint student_demographics_schedule_id_fkey,
  add constraint student_demographics_schedule_id_fkey foreign key (schedule_id) references public.participant_schedule(id) on delete set null;
alter table public.liliana_demographics drop constraint liliana_demographics_schedule_id_fkey,
  add constraint liliana_demographics_schedule_id_fkey foreign key (schedule_id) references public.participant_schedule(id) on delete set null;
alter table public.equity_census_responses drop constraint equity_census_responses_schedule_id_fkey,
  add constraint equity_census_responses_schedule_id_fkey foreign key (schedule_id) references public.participant_schedule(id) on delete set null;
