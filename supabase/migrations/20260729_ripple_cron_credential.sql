-- ripple-reminders-hourly: migrate the cron job's credential to the new-style
-- service key, so `ripple_reminder` stops 401-ing its own scheduler.
--
-- Bug (found 2026-07-29, shipped 2026-07-14): every Ripple reminder email since
-- the feature launched was silently dropped at the function's front door. Both
-- functions authenticate the same way —
--
--   const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
--   if (!authHeader || authHeader !== `Bearer ${serviceKey}`) -> 401
--
-- an exact string comparison, so the header has to carry the *same* key the
-- functions environment holds. That secret is the new-style `sb_secret_…` key.
-- `check-schedule-every-15min` had been migrated to it; `ripple-reminders-hourly`,
-- created separately on 2026-07-14, still carried the legacy `service_role` JWT
-- (`eyJhbGci…`) and therefore returned 401 on every hourly tick, for 15 days.
--
-- Nothing surfaced it. `cron.job_run_details` records the `net.http_post` call as
-- `succeeded` — that is the enqueue, not the response; the 401 lives in
-- `net._http_response`, which nobody reads. Measured before the fix:
-- 6 ripples, 4 with reminders enabled, `ever_reminded` = 0, `last_reminder_any`
-- = null, three of the four overdue.
--
-- The key is copied from the job that works rather than pasted, so no secret is
-- ever typed into a file or a chat log. Idempotent: re-running rewrites the same
-- command. Safe to re-run any time the credential rotates.

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'ripple-reminders-hourly'),
  command => format(
    $f$SELECT net.http_post(
        url     := 'https://qajrlfqoicfcfhthsfay.supabase.co/functions/v1/ripple_reminder',
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L),
        body    := '{}'::jsonb
    )$f$,
    'Bearer ' || (SELECT (regexp_match(command, 'sb_secret_[A-Za-z0-9_-]+'))[1]
                    FROM cron.job WHERE jobname = 'check-schedule-every-15min')
  )
);

-- Verify (both should be true, and the response should be 2xx within the hour):
--
--   SELECT jobname, command ~ 'sb_secret_' AS new_style_key, command ~ 'Bearer eyJ' AS legacy_jwt
--     FROM cron.job WHERE active;
--
--   SELECT status_code, left(content, 80), created
--     FROM net._http_response
--     WHERE content LIKE '%window%' OR content LIKE '%Unauthorized%'
--     ORDER BY created DESC LIMIT 5;
--
-- Confirmed live 2026-07-29 23:00 UTC (19:00 Toronto): 200
-- `{"sent":0,"skipped":1,"window":"evening"}` — the evening-cadence user is
-- weekly and 5 days out, under the 7-day threshold, so a skip is the correct
-- outcome for that tick. First real sends land at 08:00 Toronto.
--
-- Follow-up, not done here: the legacy `service_role` JWT is now referenced by
-- no active cron job — worth confirming it is actually revoked rather than
-- merely unused. And nothing anywhere notices a cron'd function returning 401
-- every hour; a "every active cron job's target answered 2xx recently" check
-- would have caught this on day one.
