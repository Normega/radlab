-- Distinguish "window closed, session done" from "window closed, session missed".
--
-- Bug (found by Norm 2026-07-25, same day as 20260725_expired_link_next_session):
-- get_session_by_token checked expiry BEFORE it ever looked at whether the
-- session had been completed, so a participant who finished their session and
-- later re-opened the same link fell into the expiry branch. Since that branch
-- now returns the soft-landing copy, they were told "Missing one doesn't affect
-- your standing in the study" about a session they had actually completed —
-- exactly the wrong message to the most conscientious participants. 96 links are
-- currently `used` + past expiry with a completed schedule row, i.e. 96 people
-- would see this.
--
-- Two fixes here:
--   1. Completion is checked before expiry, and is authoritative from the
--      SCHEDULE row (status='completed' / completed_at), not just the link
--      status — see 2 for why the link status can't be trusted.
--   2. The expiry branch's `UPDATE ... SET status='expired'` was unconditional,
--      so it overwrote 'used' on any completed-then-revisited link. It is now
--      scoped to status='active'. Two links already have a clobbered status
--      (link='expired' but schedule completed with completed_at set); they are
--      repaired below. The ordering fix alone would render them correctly, but
--      a wrong link status also misleads the admin link badges in StudyDetail.
--
-- Both terminal branches return next_session, so the completed screen names the
-- next session the same way the expired one does.

-- ── 1. Shared next-session lookup ────────────────────────────────────────────
-- Extracted so the 'completed' and 'expired' branches can't drift apart.
CREATE OR REPLACE FUNCTION public.next_pending_session(p_participant uuid, p_study uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
           'scheduled_date', ps.scheduled_date,
           'send_time',      ps.send_time::text
         )
    FROM participant_schedule ps
   WHERE ps.participant_id = p_participant
     AND ps.study_id       = p_study
     AND ps.status         = 'pending'
     AND (ps.scheduled_date + COALESCE(ps.send_time, '00:00'::time))
           > (now() AT TIME ZONE 'America/Toronto')
     AND NOT EXISTS (
       SELECT 1 FROM study_enrollments se
        WHERE se.profile_id = p_participant
          AND se.study_id   = p_study
          AND se.status IN ('withdrawn', 'completed')
     )
   ORDER BY ps.scheduled_date, ps.send_time
   LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.next_pending_session(uuid, uuid) TO anon, authenticated;

-- ── 2. Repair statuses the old unconditional UPDATE clobbered ────────────────
-- Idempotent: only touches links whose schedule row proves completion.
UPDATE participant_links pl
   SET status = 'used'
  FROM participant_schedule ps
 WHERE ps.id = pl.schedule_id
   AND pl.status = 'expired'
   AND ps.completed_at IS NOT NULL;

-- ── 3. get_session_by_token: completion before expiry ────────────────────────
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

  -- Completion first: a finished session stays finished no matter how long ago
  -- the link's window closed. The schedule row is authoritative — the link
  -- status was historically overwritable by the expiry branch below.
  IF v_link.status IN ('used', 'completed')
     OR v_sched.status = 'completed'
     OR v_sched.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error', 'completed',
      'next_session', public.next_pending_session(v_link.participant_id, v_link.study_id)
    );
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    -- Scoped to 'active' so this can never overwrite a terminal status.
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

GRANT EXECUTE ON FUNCTION public.get_session_by_token(text) TO anon, authenticated;
