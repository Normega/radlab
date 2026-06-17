-- External participant auto-enrollment: SONA and Prolific support

-- New columns on studies
ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS allow_external_enrollment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_enrollment_source text
    CHECK (external_enrollment_source IN ('sona', 'prolific', 'both')),
  ADD COLUMN IF NOT EXISTS completion_redirect_url text;

-- New columns on study_enrollments
-- (external_id already exists; add source and meta for external flows)
ALTER TABLE study_enrollments
  ADD COLUMN IF NOT EXISTS external_source text
    CHECK (external_source IN ('sona', 'prolific')),
  ADD COLUMN IF NOT EXISTS external_meta jsonb DEFAULT '{}';

-- Rate limiting table — only the Edge Function (service role) reads/writes this
CREATE TABLE IF NOT EXISTS enrollment_attempts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id     uuid REFERENCES studies(id) ON DELETE CASCADE,
  ip_hash      text NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrollment_attempts_lookup
  ON enrollment_attempts (study_id, ip_hash, attempted_at);

ALTER TABLE enrollment_attempts ENABLE ROW LEVEL SECURITY;
-- No permissive policies — service role bypasses RLS automatically

-- Update get_session_by_token to expose completion_redirect_url
CREATE OR REPLACE FUNCTION get_session_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      'completed_at',     v_sched.completed_at
    ),
    'study', jsonb_build_object(
      'consent_required',        v_study.consent_required,
      'active_consent_form_id',  v_study.active_consent_form_id,
      'completion_redirect_url', v_study.completion_redirect_url
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
