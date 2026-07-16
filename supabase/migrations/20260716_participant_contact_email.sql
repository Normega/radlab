-- Participant contact email collection — fixes the critical gap where external
-- (SONA/Prolific) participants in longitudinal studies could never receive any
-- study email. auto-enroll mints their auth account with a synthetic,
-- undeliverable address (`ext-<source>-<id>@participants.radlab.zone`), and
-- both email senders (send_message, processAdherenceWithdrawal) resolved the
-- recipient from auth.users — so every daily session link, reminder,
-- assessment-window email, and termination notice for Liliana Study 3's 31-day
-- protocol was addressed to a mailbox that does not exist. Nothing anywhere in
-- the flow (StudyJoin, screener, consent) ever asked for a real address.
--
-- The real address is now collected in-session by ContactEmailGate.jsx
-- (rendered inline by SessionEntry.jsx after the consent gate, external
-- longitudinal enrollments only) and stored on the enrollment row. The edge
-- functions prefer it over the auth email and treat a synthetic auth address
-- as no-recipient rather than "sending" into the void.

-- ── 1. Column ────────────────────────────────────────────────────────────────
ALTER TABLE public.study_enrollments
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_email_set_at timestamptz;

-- ── 2. record_contact_email RPC ──────────────────────────────────────────────
-- Narrow SECURITY DEFINER write, same pattern (and rationale) as
-- record_consent: study_enrollments has no participant UPDATE policy because
-- it carries fields a participant must never self-write (status,
-- withdrawal_reason, ...). Re-callable so a participant can correct a typo.
CREATE OR REPLACE FUNCTION public.record_contact_email(p_study_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile uuid := auth.uid();
  v_email   text := trim(p_email);
  v_id      uuid;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'record_contact_email: not authenticated';
  END IF;

  IF v_email IS NULL
     OR length(v_email) > 320
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'record_contact_email: invalid email address';
  END IF;

  UPDATE public.study_enrollments
  SET contact_email        = v_email,
      contact_email_set_at = now()
  WHERE profile_id = v_profile AND study_id = p_study_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'record_contact_email: no enrollment found for this study';
  END IF;

  RETURN jsonb_build_object('contact_email', v_email);
END;
$$;

-- ── 3. get_session_by_token: surface the gate inputs ─────────────────────────
-- enrollment gains external_source + contact_email; study gains `longitudinal`
-- (design_graph presence) — SessionEntry.jsx shows the email gate only for
-- external enrollments in longitudinal studies with no contact_email yet.
-- Otherwise identical to the 20260715_zerin_daily_checkins.sql definition.
CREATE OR REPLACE FUNCTION public.get_session_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link         participant_links%ROWTYPE;
  v_sched        participant_schedule%ROWTYPE;
  v_sess         study_sessions%ROWTYPE;
  v_study        studies%ROWTYPE;
  v_enroll       study_enrollments%ROWTYPE;
  v_nodes        jsonb;
  v_consent_html text;
  v_debrief_html text;
BEGIN
  SELECT * INTO v_link
    FROM participant_links
    WHERE token = p_token
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.status = 'revoked' THEN
    RETURN jsonb_build_object('error', 'revoked');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    UPDATE participant_links SET status = 'expired' WHERE id = v_link.id;
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_sched FROM participant_schedule WHERE id = v_link.schedule_id;
  SELECT * INTO v_sess  FROM study_sessions       WHERE id = v_sched.study_session_id;
  SELECT * INTO v_study FROM studies              WHERE id = v_link.study_id;

  SELECT * INTO v_enroll
    FROM study_enrollments
    WHERE profile_id = v_link.participant_id
      AND study_id   = v_link.study_id
    LIMIT 1;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          n.id,
      'order_index', n.order_index,
      'label',       n.label,
      'activity_id', n.activity_id,
      'module_id',   n.module_id,
      'activities',  CASE
        WHEN a.id IS NOT NULL THEN jsonb_build_object(
          'id',          a.id,
          'category',    a.category,
          'subcategory', a.subcategory,
          'label',       a.label
        )
        WHEN q.id IS NOT NULL THEN jsonb_build_object(
          'id',          q.id,
          'category',    'questionnaire',
          'subcategory', q.slug,
          'label',       q.name
        )
        WHEN n.module_id IS NOT NULL THEN jsonb_build_object(
          'id',          NULL,
          'category',    'training',
          'subcategory', n.module_id,
          'label',       n.label
        )
        ELSE NULL
      END
    ) ORDER BY n.order_index
  )
  INTO v_nodes
  FROM session_template_nodes n
  LEFT JOIN activities     a ON a.id = n.activity_id
  LEFT JOIN questionnaires q ON q.id = n.questionnaire_id
  WHERE n.session_template_id = v_sess.session_template_id;

  IF v_study.active_consent_form_id IS NOT NULL THEN
    SELECT html_content INTO v_consent_html
      FROM study_consent_forms WHERE id = v_study.active_consent_form_id;
  END IF;
  IF v_study.active_debrief_form_id IS NOT NULL THEN
    SELECT html_content INTO v_debrief_html
      FROM study_debrief_forms WHERE id = v_study.active_debrief_form_id;
  END IF;

  IF v_sched.status IN ('pending', 'link_sent') THEN
    UPDATE participant_schedule SET status = 'unlocked' WHERE id = v_sched.id;
  END IF;

  RETURN jsonb_build_object(
    'link', jsonb_build_object(
      'id',             v_link.id,
      'status',         v_link.status,
      'expires_at',     v_link.expires_at,
      'participant_id', v_link.participant_id,
      'study_id',       v_link.study_id
    ),
    'schedule', jsonb_build_object(
      'id',               v_sched.id,
      'status',           v_sched.status,
      'study_id',         v_sched.study_id,
      'study_session_id', v_sched.study_session_id,
      'scheduled_date',   v_sched.scheduled_date,
      'study_day',        v_sched.study_day,
      'send_time',        v_sched.send_time::text,
      'completed_at',     v_sched.completed_at
    ),
    'study', jsonb_build_object(
      'consent_required',        v_study.consent_required,
      'active_consent_form_id',  v_study.active_consent_form_id,
      'completion_redirect_url', v_study.completion_redirect_url,
      'screener',                v_study.screener,
      'assignment_slots',        v_study.assignment_slots,
      'longitudinal',            (v_study.design_graph IS NOT NULL)
    ),
    'enrollment', jsonb_build_object(
      'id',              v_enroll.id,
      'consent_date',    v_enroll.consent_date,
      'external_source', v_enroll.external_source,
      'contact_email',   v_enroll.contact_email
    ),
    'nodes',        COALESCE(v_nodes, '[]'::jsonb),
    'consent_html', v_consent_html,
    'debrief_html', v_debrief_html
  );
END;
$function$;
