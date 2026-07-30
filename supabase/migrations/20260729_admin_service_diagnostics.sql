-- admin_service_diagnostics(): the data behind /admin/diagnostics (super admins
-- only), a standing health read on the scheduled services.
--
-- Why this exists (Norm, 2026-07-29): `ripple-reminders-hourly` returned 401 on
-- every tick for 15 days and nothing noticed. Zero Ripple reminders had ever
-- been delivered. The lesson isn't "fix that job" — it's that a scheduled
-- service failing has no complainant, so the platform needs somewhere to look.
--
-- What can and cannot be known, because it dictates the shape below:
--
--   * `cron.job.command` carries the Authorization header as a literal, so the
--     CREDENTIAL SHAPE is statically checkable — and that alone would have
--     caught this bug on day one, without any request history at all. It is the
--     first-class check here.
--   * `cron.job_run_details` is durable but only records the `net.http_post`
--     ENQUEUE. A 401 shows there as `succeeded`. Useful for "did it fire", never
--     for "did it work".
--   * `net._http_response` has the status code but NO url column, and
--     `net.http_request_queue` (which does have the url) is emptied the moment a
--     request completes — so a response cannot be joined back to its job.
--     pg_net also prunes aggressively: 31 rows / a few hours when this was
--     written. Hence `diag_response_target()`, which attributes a response by
--     the shape of its body, and hence the response window being reported as a
--     short, explicitly-bounded secondary signal rather than the main event.
--   * A 401 body (`{"error":"Unauthorized"}`) is unattributable by shape — the
--     failure case is exactly the one signatures can't name. So non-2xx count is
--     also surfaced project-wide, unattributed, as its own banner.
--   * Ripple reminders do NOT write `message_log` (its kinds are `session_link`
--     and `adherence_termination` only), so Ripple health is read from
--     `ripples.last_reminder_sent_on` instead.
--
-- The durable outcome checks are the most trustworthy part: `overdue_pending`
-- (rows still 'pending' with a past `scheduled_date` — `check_schedule` step 0b
-- sweeps those to 'missed', so a nonzero count means the engine has stopped)
-- and `ever_reminded` / `last_reminder_any` on ripples, which is the exact
-- number that sat at 0 for two weeks.
--
-- Possible upgrade, deliberately NOT done here: make the correlation exact by
-- having each job record the id `net.http_post` hands back —
-- `INSERT INTO ops_cron_requests(jobname, request_id) VALUES ('…', net.http_post(…))`
-- — and reconcile it against `net._http_response` on a short cycle, before pg_net
-- prunes. That buys durable per-job status history, at the cost of rewriting the
-- command of the job that sends every participant email. Not worth doing at
-- 20:00 on a Wednesday; worth doing before the next study launches.

-- The response-body signatures, in ONE place: both the attribution below and the
-- per-job `has_signature` flag read from here, so adding a scheduled function
-- means adding one row. A target absent from this list reports
-- has_signature = false rather than pretending to know.
CREATE OR REPLACE FUNCTION diag_signatures()
RETURNS TABLE (target text, pattern text)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  VALUES ('check_schedule',  '"processed"'),
         ('ripple_reminder', '"window"|no_window_at_hour');
$$;

-- Attribute a pg_net response to a target function by the shape of its body —
-- necessary because the response row has no url and the queue row is long gone.
CREATE OR REPLACE FUNCTION diag_response_target(p_content text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.target FROM diag_signatures() s
   WHERE p_content IS NOT NULL AND p_content ~ s.pattern
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION admin_service_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now       timestamptz := now();
  v_today     date        := (now() AT TIME ZONE 'America/Toronto')::date;
  v_cron      jsonb;
  v_http_rows jsonb;
  v_retained  integer;
  v_oldest    timestamptz;
  v_non2xx    integer;
  v_email     jsonb;
  v_ripple    jsonb;
BEGIN
  -- Same gate as the rest of /admin/users' RPCs: hiding the sidebar link is
  -- tidiness, this is the actual boundary.
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ── Scheduled jobs ─────────────────────────────────────────────────────────
  WITH last_run AS (
    SELECT DISTINCT ON (jobid) jobid, start_time, status, return_message
      FROM cron.job_run_details
      ORDER BY jobid, start_time DESC
  ), j AS (
    SELECT
      c.jobid,
      c.jobname,
      c.schedule,
      c.active,
      substring(c.command from 'functions/v1/([a-zA-Z0-9_-]+)')      AS target,
      CASE WHEN c.command ~ 'sb_secret_' THEN 'new-style'
           WHEN c.command ~ 'Bearer eyJ' THEN 'legacy JWT'
           ELSE 'unrecognised' END                                   AS credential,
      -- Crude on purpose: '*/N * * * *' -> N minutes, '<m> * * * *' -> hourly,
      -- anything else -> no staleness opinion rather than a wrong one.
      CASE WHEN c.schedule ~ '^\*/\d+ '  THEN ((regexp_match(c.schedule, '^\*/(\d+) '))[1])::int
           WHEN c.schedule ~ '^\d+ \* '  THEN 60
           ELSE NULL END                                             AS expected_minutes,
      lr.start_time,
      lr.status                                                      AS run_status,
      lr.return_message
    FROM cron.job c
    LEFT JOIN last_run lr ON lr.jobid = c.jobid
  )
  SELECT jsonb_agg(x ORDER BY x->>'jobname') INTO v_cron
  FROM (
    SELECT jsonb_build_object(
      'jobname',            j.jobname,
      'schedule',           j.schedule,
      'active',             j.active,
      'target',             j.target,
      'credential',         j.credential,
      'expected_minutes',   j.expected_minutes,
      'last_run_at',        j.start_time,
      'minutes_since_run',  CASE WHEN j.start_time IS NULL THEN NULL
                                 ELSE floor(extract(epoch FROM (v_now - j.start_time)) / 60)::int END,
      'last_run_status',    j.run_status,
      'last_run_message',   left(coalesce(j.return_message, ''), 80),
      'has_signature',      EXISTS (SELECT 1 FROM diag_signatures() s WHERE s.target = j.target),
      'last_confirmed_2xx', (
        SELECT max(r.created) FROM net._http_response r
         WHERE r.status_code BETWEEN 200 AND 299
           AND diag_response_target(r.content) = j.target
      ),
      'verdict', CASE
        WHEN NOT j.active                                THEN 'off'
        WHEN j.credential <> 'new-style'                 THEN 'error'
        WHEN j.run_status IS DISTINCT FROM 'succeeded'   THEN 'error'
        WHEN j.expected_minutes IS NOT NULL
             AND j.start_time < v_now - make_interval(mins => j.expected_minutes * 3)
                                                         THEN 'stale'
        ELSE 'ok' END,
      'note', CASE
        WHEN NOT j.active                              THEN 'Job is disabled.'
        WHEN j.credential = 'legacy JWT'               THEN 'Carries the legacy service_role JWT — the functions compare against the new-style sb_secret_ key, so every tick 401s.'
        WHEN j.credential = 'unrecognised'             THEN 'No recognisable service key in the job command.'
        WHEN j.run_status IS DISTINCT FROM 'succeeded' THEN 'Last enqueue did not succeed.'
        ELSE NULL END
    ) AS x
    FROM j
  ) s;

  -- ── HTTP responses (short, ephemeral window) ───────────────────────────────
  SELECT count(*),
         min(created),
         count(*) FILTER (WHERE status_code IS NOT NULL
                            AND (status_code < 200 OR status_code >= 300))
    INTO v_retained, v_oldest, v_non2xx
    FROM net._http_response;

  SELECT jsonb_agg(x ORDER BY x->>'created' DESC) INTO v_http_rows
  FROM (
    SELECT jsonb_build_object(
      'created',      r.created,
      'status_code',  r.status_code,
      'error_msg',    r.error_msg,
      'target_guess', diag_response_target(r.content),
      'snippet',      left(coalesce(r.content, ''), 110)
    ) AS x
    FROM net._http_response r
    WHERE r.status_code IS NOT NULL      -- the paired null rows are enqueue artefacts
    ORDER BY r.created DESC
    LIMIT 20
  ) t;

  -- ── Durable outcome checks: the participant email engine ───────────────────
  SELECT jsonb_build_object(
    'sent_24h',       count(*) FILTER (WHERE status = 'sent'       AND sent_at > v_now - interval '24 hours' AND NOT is_test),
    'failed_24h',     count(*) FILTER (WHERE status = 'failed'     AND sent_at > v_now - interval '24 hours' AND NOT is_test),
    'suppressed_24h', count(*) FILTER (WHERE status = 'suppressed' AND sent_at > v_now - interval '24 hours' AND NOT is_test),
    'sent_7d',        count(*) FILTER (WHERE status = 'sent'       AND sent_at > v_now - interval '7 days'   AND NOT is_test),
    'failed_7d',      count(*) FILTER (WHERE status = 'failed'     AND sent_at > v_now - interval '7 days'   AND NOT is_test),
    'last_sent_at',   max(sent_at) FILTER (WHERE status = 'sent' AND NOT is_test)
  ) INTO v_email
  FROM message_log;

  v_email := v_email || jsonb_build_object(
    -- The canary. Step 0b does NOT sweep 'pending' (it only terminal-izes
    -- 'link_sent'/'unlocked'); what matters is that the send pass selects
    -- `scheduled_date <= today`, so a row still 'pending' with a past date is one
    -- the engine has not gotten to. Withdrawn enrollments are excluded because
    -- pass 0c skips them forever by design, leaving permanent residue — 48 rows
    -- across 4 withdrawn Liliana Live Test participants when this was written,
    -- which is exactly what made the first version of this canary read 48
    -- instead of 0.
    'overdue_pending',   (SELECT count(*) FROM participant_schedule ps
                           WHERE ps.status = 'pending' AND ps.scheduled_date < v_today
                             AND NOT EXISTS (SELECT 1 FROM study_enrollments se
                                              WHERE se.profile_id = ps.participant_id
                                                AND se.study_id   = ps.study_id
                                                AND se.status     = 'withdrawn')),
    -- Shown separately so the residue is visible without being alarming.
    'withdrawn_residue', (SELECT count(*) FROM participant_schedule ps
                           WHERE ps.status = 'pending' AND ps.scheduled_date < v_today
                             AND EXISTS (SELECT 1 FROM study_enrollments se
                                          WHERE se.profile_id = ps.participant_id
                                            AND se.study_id   = ps.study_id
                                            AND se.status     = 'withdrawn')),
    'due_today_pending', (SELECT count(*) FROM participant_schedule
                           WHERE status = 'pending' AND scheduled_date = v_today),
    'links_open',        (SELECT count(*) FROM participant_schedule WHERE status = 'link_sent')
  );

  -- ── Durable outcome checks: Ripple reminders ───────────────────────────────
  SELECT jsonb_build_object(
    'total',             count(*),
    'reminders_on',      count(*) FILTER (WHERE reminder_enabled),
    'ever_reminded',     count(*) FILTER (WHERE last_reminder_sent_on IS NOT NULL),
    'reminded_today',    count(*) FILTER (WHERE last_reminder_sent_on = v_today),
    'last_reminder_any', max(last_reminder_sent_on),
    'oldest_checkin',    min(last_checkin_on),
    'newest_checkin',    max(last_checkin_on)
  ) INTO v_ripple
  FROM ripples;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'today',        v_today,
    'cron',         coalesce(v_cron, '[]'::jsonb),
    'http', jsonb_build_object(
      'retained_rows',  v_retained,
      'oldest',         v_oldest,
      'non_2xx_count',  v_non2xx,
      'rows',           coalesce(v_http_rows, '[]'::jsonb)
    ),
    'email',  v_email,
    'ripple', v_ripple
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_service_diagnostics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_service_diagnostics() TO authenticated;

-- The helpers expose nothing on their own (a signature list and a pure string
-- classifier) but nothing outside the gated RPC needs them either.
REVOKE ALL ON FUNCTION diag_signatures()             FROM PUBLIC;
REVOKE ALL ON FUNCTION diag_response_target(text)    FROM PUBLIC;
