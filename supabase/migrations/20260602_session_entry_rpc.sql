-- ============================================================
-- Session entry RPC functions
-- Called by /s/:token with no auth session (anon key).
-- SECURITY DEFINER bypasses RLS; the token itself is the auth.
-- ============================================================

-- Returns all data needed to run a session, and marks schedule 'unlocked'.
CREATE OR REPLACE FUNCTION get_session_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link       participant_links%ROWTYPE;
  v_sched      participant_schedule%ROWTYPE;
  v_sess       study_sessions%ROWTYPE;
  v_study      studies%ROWTYPE;
  v_enroll     study_enrollments%ROWTYPE;
  v_nodes      jsonb;
  v_consent_html text;
  v_debrief_html  text;
BEGIN
  SELECT * INTO v_link
    FROM participant_links
    WHERE token = p_token
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_sched FROM participant_schedule WHERE id = v_link.schedule_id;
  SELECT * INTO v_sess  FROM study_sessions       WHERE id = v_sched.study_session_id;
  SELECT * INTO v_study FROM studies              WHERE id = v_link.study_id;

  -- Consent check data
  SELECT * INTO v_enroll
    FROM study_enrollments
    WHERE profile_id = v_link.participant_id
      AND study_id   = v_link.study_id
    LIMIT 1;

  -- Load nodes + activities for this session template
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          n.id,
      'order_index', n.order_index,
      'label',       n.label,
      'activity_id', n.activity_id,
      'activities',  jsonb_build_object(
        'id',          a.id,
        'category',    a.category,
        'subcategory', a.subcategory,
        'label',       a.label
      )
    ) ORDER BY n.order_index
  )
  INTO v_nodes
  FROM session_template_nodes n
  JOIN activities a ON a.id = n.activity_id
  WHERE n.session_template_id = v_sess.session_template_id;

  -- Fetch consent/debrief HTML from active form records
  IF v_study.active_consent_form_id IS NOT NULL THEN
    SELECT html_content INTO v_consent_html FROM study_consent_forms WHERE id = v_study.active_consent_form_id;
  END IF;
  IF v_study.active_debrief_form_id IS NOT NULL THEN
    SELECT html_content INTO v_debrief_html FROM study_debrief_forms WHERE id = v_study.active_debrief_form_id;
  END IF;

  -- Mark schedule unlocked on first access
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
      'completed_at',     v_sched.completed_at
    ),
    'study', jsonb_build_object(
      'consent_required',        v_study.consent_required,
      'active_consent_form_id',  v_study.active_consent_form_id
    ),
    'enrollment', jsonb_build_object(
      'id',           v_enroll.id,
      'consent_date', v_enroll.consent_date
    ),
    'nodes',        COALESCE(v_nodes, '[]'::jsonb),
    'consent_html', v_consent_html,
    'debrief_html', v_debrief_html
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_by_token(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────

-- Marks the session complete. Called when the last activity finishes.
CREATE OR REPLACE FUNCTION complete_session_by_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link  participant_links%ROWTYPE;
  v_now   timestamptz := now();
BEGIN
  SELECT * INTO v_link
    FROM participant_links
    WHERE token = p_token AND status IN ('active', 'used')
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE participant_links
    SET status = 'used'
    WHERE id = v_link.id;

  UPDATE participant_schedule
    SET status = 'completed', completed_at = v_now
    WHERE id = v_link.schedule_id AND status != 'completed';
END;
$$;

GRANT EXECUTE ON FUNCTION complete_session_by_token(text) TO anon, authenticated;
