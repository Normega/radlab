-- duplicate_study — clone a study's full CONFIGURATION into a brand-new study
-- row, with no participant data whatsoever. Lets an admin spin up a clean
-- copy of a study (e.g. to live-test a design without touching a dry-run
-- study's accumulated participant history).
--
-- What gets cloned (config, deep-copied with new ids where the row is
-- study-owned):
--   - studies: every scalar/jsonb column (design_graph, assignment_slots,
--     screener snapshot, reminder/consent settings, etc.) except id/
--     created_at/created_by, which are reset.
--   - study_consent_forms / study_debrief_forms: these ARE study-specific
--     (confirmed live: every study's active form's own study_id points back
--     at that same study, never shared) — deep-cloned as new rows, and the
--     new study's active_consent_form_id/active_debrief_form_id re-pointed
--     at the clones.
--   - study_sessions: a compiled cache of design_graph (ExperimentBuilder
--     deletes+regenerates these on every graph save — see compileStudySessions
--     in ExperimentBuilder.jsx), cloned row-for-row with the SAME
--     session_template_id per row.
--   - study_protocol_assignments / study_tasks: legacy in-person protocol
--     wiring, cloned row-for-row.
--
-- What is copied BY REFERENCE, not cloned (shared library data — confirmed
-- live that multiple studies already point at the same rows):
--   - session_templates (+ session_template_nodes): 13 of the pilot dry-run
--     study's 51 templates are already shared with other studies. This
--     mirrors duplicateBlock() in experimentGraph.js, which duplicates a
--     block's session nodes within a graph but deliberately keeps the same
--     session_template_id rather than cloning the template.
--   - screeners (screener_id): a slug-keyed shared library, e.g.
--     'emotion-regulation-v1' — copy the id pointer only.
--
-- What is NEVER copied (participant-generated data, scoped by the excluded
-- study_id — everything else transitively hangs off study_enrollments or
-- liliana_participants, which this list already cuts off):
--   study_enrollments, participant_schedule, participant_links,
--   participant_assignments, participant_compensation,
--   participant_unsubscribe_tokens, message_log, screener_results,
--   liliana_participants, liliana_day_data, vas_responses, game_sessions,
--   aptitude_sessions, enrollment_attempts, profiles.study_id.

CREATE OR REPLACE FUNCTION public.duplicate_study(p_study_id uuid, p_new_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_src               public.studies%ROWTYPE;
  v_new_id            uuid := gen_random_uuid();
  v_new_consent_id    uuid;
  v_new_debrief_id    uuid;
  v_name              text;
BEGIN
  IF NOT (public.my_role() = 'lab' OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'forbidden: lab role required';
  END IF;

  SELECT * INTO v_src FROM public.studies WHERE id = p_study_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'study not found';
  END IF;

  v_name := COALESCE(NULLIF(trim(p_new_name), ''), v_src.name || ' (Copy)');

  -- Insert the new study row first (forms start NULL — study_consent_forms/
  -- study_debrief_forms.study_id FK requires the study to already exist),
  -- then clone the forms and back-fill the pointers.
  INSERT INTO public.studies (
    id, name, created_by, protocol, active, messaging_required, created_at,
    consent_required, active_consent_form_id, active_debrief_form_id, delivery_mode,
    study_consent_text, allow_restart, reminders_enabled, reminder_interval_hours,
    reminder_max, email_subject, email_body, reminder_interval_days,
    allow_external_enrollment, external_enrollment_source, completion_redirect_url,
    screener, screener_id, design_graph, design_seed, design_version, max_attempts,
    assignment_slots
  ) VALUES (
    v_new_id, v_name, auth.uid(), v_src.protocol, v_src.active, v_src.messaging_required, now(),
    v_src.consent_required, NULL, NULL, v_src.delivery_mode,
    v_src.study_consent_text, v_src.allow_restart, v_src.reminders_enabled, v_src.reminder_interval_hours,
    v_src.reminder_max, v_src.email_subject, v_src.email_body, v_src.reminder_interval_days,
    v_src.allow_external_enrollment, v_src.external_enrollment_source, v_src.completion_redirect_url,
    v_src.screener, v_src.screener_id, v_src.design_graph, v_src.design_seed, v_src.design_version, v_src.max_attempts,
    v_src.assignment_slots
  );

  IF v_src.active_consent_form_id IS NOT NULL THEN
    INSERT INTO public.study_consent_forms (study_id, docx_url, html_content, uploaded_by)
    SELECT v_new_id, docx_url, html_content, auth.uid()
    FROM public.study_consent_forms WHERE id = v_src.active_consent_form_id
    RETURNING id INTO v_new_consent_id;
  END IF;

  IF v_src.active_debrief_form_id IS NOT NULL THEN
    INSERT INTO public.study_debrief_forms (study_id, docx_url, html_content, uploaded_by)
    SELECT v_new_id, docx_url, html_content, auth.uid()
    FROM public.study_debrief_forms WHERE id = v_src.active_debrief_form_id
    RETURNING id INTO v_new_debrief_id;
  END IF;

  IF v_new_consent_id IS NOT NULL OR v_new_debrief_id IS NOT NULL THEN
    UPDATE public.studies
    SET active_consent_form_id = v_new_consent_id, active_debrief_form_id = v_new_debrief_id
    WHERE id = v_new_id;
  END IF;

  INSERT INTO public.study_sessions (study_id, session_template_id, day_number, send_time, link_expires_hours, label, order_index, node_key)
  SELECT v_new_id, session_template_id, day_number, send_time, link_expires_hours, label, order_index, node_key
  FROM public.study_sessions WHERE study_id = p_study_id;

  INSERT INTO public.study_protocol_assignments (study_id, protocol_id, assigned_at, notes)
  SELECT v_new_id, protocol_id, now(), notes
  FROM public.study_protocol_assignments WHERE study_id = p_study_id;

  INSERT INTO public.study_tasks (study_id, protocol_id, order_index, task_type, task_ref_id, repeatable, unlock_conditions, window_hours, label)
  SELECT v_new_id, protocol_id, order_index, task_type, task_ref_id, repeatable, unlock_conditions, window_hours, label
  FROM public.study_tasks WHERE study_id = p_study_id;

  RETURN v_new_id;
END;
$$;
