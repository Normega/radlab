-- Zerin Langerian Mindfulness study — daily check-in capture + step activities.
--
-- One table across all three arms (control / self_monitoring / reflective): a
-- single daily-touchpoint completion log, so adherence ("N of 63") reads from
-- one place while per-arm analysis keys off the `arm` column. Control rows carry
-- only the acknowledged tip; the two mood arms carry rating/direction (+ reason
-- for reflective).
--
-- Also surfaces study_day + send_time from participant_schedule through
-- get_session_by_token, so the check-in / tip step widgets can resolve the
-- current day and time slot (morning/afternoon/evening) without a second query.

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.zerin_daily_checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  study_id      uuid,
  external_id   text,
  schedule_id   uuid,
  study_day     integer,
  slot          text,        -- morning | afternoon | evening
  arm           text,        -- control | self_monitoring | reflective
  rating        integer,     -- 1..7 mood (null for control)
  direction     text,        -- better | worse | same (null for control)
  reason        text,        -- reflective-arm free text (null otherwise)
  tip_text      text,        -- control-arm wellness tip shown (null otherwise)
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists zerin_daily_checkins_user_idx     on public.zerin_daily_checkins (user_id);
create index if not exists zerin_daily_checkins_schedule_idx on public.zerin_daily_checkins (schedule_id);

alter table public.zerin_daily_checkins enable row level security;

create policy "own rows"
  on public.zerin_daily_checkins
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "zerin_daily_checkins: lab write"
  on public.zerin_daily_checkins
  for all
  to authenticated
  using (my_role() = 'lab')
  with check (my_role() = 'lab');

-- ── Step activities (SessionBuilder Forms picker) ────────────────────────────
insert into public.activities (category, subcategory, label, description) values
  ('form', 'mood_checkin',            'Mood Check-in (Self-Monitoring)', 'Daily 1-7 mood rating + Better/Worse/Same. Zerin study self-monitoring arm.'),
  ('form', 'mood_checkin_reflective', 'Mood Check-in (Reflective)',      'Daily 1-7 mood rating + Better/Worse/Same + short reason. Zerin study reflective arm.'),
  ('form', 'wellness_tip',            'Daily Wellness Tip (Control)',    'Day/slot-specific wellness tip + acknowledge. Zerin study attention-control arm.')
on conflict (category, subcategory) do nothing;

-- ── get_session_by_token: add study_day + send_time to the schedule object ───
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
      'assignment_slots',        v_study.assignment_slots
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
$function$;
