-- withdraw_participant(study, study code): a participant's request to withdraw their data (Breath Attention
-- and Emotional Recovery consent form, "Withdrawing Your Data": within one week, by email, quoting no
-- identifier but the session). Plan WP-G4 / §11. Generic: works for any study whose participants are known
-- by a study code (study_enrollments.external_id).
--
-- This is the one legitimate deletion of collected responses (CLAUDE.md participant data rule 5 forbids
-- overwriting or discarding them everywhere else), so it is super-admin only, takes one participant at a
-- time, and leaves a record: the enrollment row stays as a tombstone (status 'withdrawn', withdrawn_at,
-- withdrawal_reason 'data_withdrawn', and the per-table counts of what was deleted in withdrawal_note,
-- never any content). Their link is expired and unfinished schedule rows are marked missed. The SONA-ID
-- mapping (external_identities) is deleted too. The RA deletes the AcqKnowledge file by study code.
--
-- It does not email anyone: the in-person participants have no address on the platform.

CREATE OR REPLACE FUNCTION public.withdraw_participant(p_study_id uuid, p_study_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enr   study_enrollments%ROWTYPE;
  v_uid   uuid;
  v_sched uuid[];
  v_n     int;
  v_out   jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'withdraw_participant: super admin only';
  END IF;
  SELECT * INTO v_enr FROM study_enrollments WHERE study_id = p_study_id AND external_id = p_study_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdraw_participant: no participant % in this study', p_study_code;
  END IF;
  IF v_enr.withdrawal_reason = 'data_withdrawn' THEN
    RAISE EXCEPTION 'withdraw_participant: % was already withdrawn on %', p_study_code, v_enr.withdrawn_at;
  END IF;
  v_uid := v_enr.profile_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_sched FROM participant_schedule WHERE study_id = p_study_id AND participant_id = v_uid;

  DELETE FROM questionnaire_responses WHERE user_id = v_uid AND schedule_id = ANY (v_sched);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('questionnaire_responses', v_n);
  DELETE FROM student_demographics WHERE user_id = v_uid AND schedule_id = ANY (v_sched);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('student_demographics', v_n);
  DELETE FROM participant_video_sessions WHERE participant_id = v_uid AND participant_schedule_id = ANY (v_sched);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('participant_video_sessions', v_n);
  DELETE FROM participant_step_timings WHERE participant_id = v_uid AND study_id = p_study_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('participant_step_timings', v_n);
  DELETE FROM participant_assignments WHERE participant_id = v_uid AND study_id = p_study_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('participant_assignments', v_n);
  DELETE FROM bre_ratings WHERE user_id = v_uid AND study_id = p_study_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('bre_ratings', v_n);
  DELETE FROM bre_events WHERE user_id = v_uid AND study_id = p_study_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('bre_events', v_n);
  DELETE FROM external_identities WHERE study_id = p_study_id AND surrogate = p_study_code;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_out := v_out || jsonb_build_object('external_identities', v_n);

  UPDATE participant_links SET status = 'expired', ended_reason = 'admin_revoked', ended_at = now()
   WHERE study_id = p_study_id AND participant_id = v_uid AND status = 'active';
  UPDATE participant_schedule SET status = 'missed'
   WHERE id = ANY (v_sched) AND completed_at IS NULL AND status NOT IN ('missed', 'blocked');
  UPDATE study_enrollments
     SET status = 'withdrawn', withdrawn_at = now(), withdrawal_reason = 'data_withdrawn',
         withdrawal_note = 'Data withdrawn at the participant''s request; rows deleted: ' || v_out::text,
         repository_consent = NULL
   WHERE id = v_enr.id;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_participant(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_participant(uuid, text) TO authenticated;
