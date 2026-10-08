-- Email after consent, optional, in the same browser: a per-study alternative to
-- the open-recruitment inbox round trip.
--
-- WHY. An open-join participant (QR code, poster, /join/:slug) is asked for an
-- email address after the screener and BEFORE consent, and the session then
-- continues only from a link mailed to that address (OpenEmailGate). That is the
-- right design for Liliana Study 3, a paid month-long study with a screener,
-- where proving the address is real matters and nothing identifying should be
-- collected from anyone the screener turns away. It is wrong for UTMAP 2026, an
-- eight-minute walk-up survey with no screener, whose protocol says consent comes
-- first and an email address is optional, used only for the follow-up or the
-- results. Norm, 2026-10-08: "can you change the order please?"
--
-- With `open_email_after_consent` on, SessionEntry skips the pre-consent inbox
-- step and, after consent, shows ContactEmailGate in its optional form: the
-- participant may give an address (stored by record_contact_email in
-- study_enrollments.contact_email, as for every other study) or continue
-- without one. Off by default, so every existing study, Liliana's included,
-- behaves exactly as before.

-- ── 1. Column ────────────────────────────────────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS open_email_after_consent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.studies.open_email_after_consent IS
  'Open-join participants give an optional email after consent, in the same browser, instead of the pre-consent inbox round trip.';

-- ── 2. get_session_by_token returns it ───────────────────────────────────────
-- Copied from the live definition on 2026-10-08 (pg_get_functiondef, md5
-- 250683b82bf2a50ce26d1161b590923a), unchanged apart from the one added key in
-- the 'study' object.
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

  SELECT * INTO v_sched FROM participant_schedule WHERE id = v_link.schedule_id;

  IF v_link.status IN ('used', 'completed')
     OR v_sched.status = 'completed'
     OR v_sched.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error', 'completed',
      'next_session', public.next_pending_session(v_link.participant_id, v_link.study_id)
    );
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    UPDATE participant_links
       SET status = 'expired'
     WHERE id = v_link.id AND status = 'active';

    RETURN jsonb_build_object(
      'error', 'expired',
      'next_session', public.next_pending_session(v_link.participant_id, v_link.study_id)
    );
  END IF;

  SELECT * INTO v_sess  FROM study_sessions WHERE id = v_sched.study_session_id;
  SELECT * INTO v_study FROM studies        WHERE id = v_link.study_id;

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
      'longitudinal',            (v_study.design_graph IS NOT NULL),
      'open_email_after_consent', v_study.open_email_after_consent
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

-- ── 3. UTMAP 2026 uses it ────────────────────────────────────────────────────
-- Norm's decision above. Only this study.
UPDATE public.studies
   SET open_email_after_consent = true
 WHERE id = 'f5a2db89-9697-489f-9a16-dea9c64053e0';  -- UTMAP 2026, /join/utmaps
