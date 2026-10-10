-- Questionnaire layout v2: several items per page is the standard for new studies;
-- every existing study keeps exactly what it has.
--
-- WHY. Two layouts had drifted into use side by side: legacy definitions rendered
-- one item per screen with auto-advance, composable ones as labelled cards
-- several to a page. The PSY240 class trial mixed both in one sitting. A
-- literature review (reports/Items per screen in web surveys.md, 2026-10-10)
-- found the two differ little in means but carry different context artifacts
-- (proximity vs sequential priming), so the rule is: one layout per study, never
-- changed mid-study, recorded on every response. Norm's decision: v2 (stacked
-- cards, several per page) going forward.
--
--   studies.questionnaire_layout      'one_per_screen' (v1) | 'stacked' (v2).
--     Existing rows are filled with 'one_per_screen' by the ADD COLUMN default, so
--     nothing running changes. The default then becomes 'stacked' for new studies.
--     Under 'stacked', a legacy (item-based) definition is rendered as labelled
--     cards by src/lib/legacyToStacked.js; composable definitions are stacked in
--     either layout, as they always were.
--   questionnaire_responses.presentation_format   what the participant actually
--     saw: 'one_per_screen' | 'stacked' | 'checklist'. NULL = recorded before this
--     column existed (the definition's type then decides; never inferred into it).
--
-- duplicate_study copies an explicit column list, so a copy would have taken the
-- new default and silently switched a v1 study's replication to v2. It now copies
-- the layout. Live definition taken with pg_get_functiondef (md5
-- 33e02b7cd10d536e54167e60619c9fa3) and changed only by the marked statement.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS questionnaire_layout text NOT NULL DEFAULT 'one_per_screen';
ALTER TABLE public.studies DROP CONSTRAINT IF EXISTS studies_questionnaire_layout_check;
ALTER TABLE public.studies ADD CONSTRAINT studies_questionnaire_layout_check
  CHECK (questionnaire_layout IN ('one_per_screen', 'stacked'));
ALTER TABLE public.studies ALTER COLUMN questionnaire_layout SET DEFAULT 'stacked';
COMMENT ON COLUMN public.studies.questionnaire_layout IS
  'How questionnaires are laid out: one_per_screen (v1, legacy) or stacked (v2: labelled cards, several per page; default for new studies). Never change it on a study that has collected data.';

ALTER TABLE public.questionnaire_responses
  ADD COLUMN IF NOT EXISTS presentation_format text;
ALTER TABLE public.questionnaire_responses DROP CONSTRAINT IF EXISTS questionnaire_responses_presentation_format_check;
ALTER TABLE public.questionnaire_responses ADD CONSTRAINT questionnaire_responses_presentation_format_check
  CHECK (presentation_format IS NULL OR presentation_format IN ('one_per_screen', 'stacked', 'checklist'));
COMMENT ON COLUMN public.questionnaire_responses.presentation_format IS
  'Layout the participant saw: one_per_screen | stacked | checklist. NULL = recorded before 2026-10-10.';

-- ── 2. duplicate_study keeps the source study's layout ───────────────────────
CREATE OR REPLACE FUNCTION public.duplicate_study(p_study_id uuid, p_new_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_src               public.studies%ROWTYPE;
  v_new_id            uuid := gen_random_uuid();
  v_new_consent_id    uuid;
  v_new_debrief_id    uuid;
  v_name              text;
BEGIN
  IF NOT (COALESCE(public.my_role(), '') = 'lab' OR public.is_super_admin()) THEN
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
  UPDATE public.studies SET questionnaire_layout = v_src.questionnaire_layout WHERE id = v_new_id; -- 20261010: a copy keeps its source's layout

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
$function$;
