# Edge Functions

## Prerequisites

Set these secrets in Supabase Dashboard → Edge Functions → Secrets:
- `RESEND_API_KEY` — from resend.com dashboard
- `FROM_EMAIL` — verified sender in your Resend domain, e.g. `research@radlab.zone`
- `SITE_URL` — `https://radlab.zone` (canonical; `www` 308s to it)
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API

> Both of the above are **required in practice**. The in-code fallbacks pointed
> at `radlab.vercel.app` until 2026-07-30 — a host that is not the canonical
> domain and, for `FROM_EMAIL`, could never be a verified Resend sender, so
> falling through to it meant links to the wrong host or a silent send failure.
> They now default to `radlab.zone`, but set the secrets explicitly rather than
> relying on that.

Optional, all with working defaults (`auto-enroll` rate limiting, live 2026-07-30):
- `ENROLL_RATE_MAX` — new accounts allowed per IP per window (default `1`)
- `ENROLL_RATE_WINDOW_S` — window in seconds (default `60`)
- `ENROLL_IP_SALT` — salt for the stored IP hash. Unset, the service key stands
  in; rotating that simply resets the counting window. Set it if you ever want
  the hashes stable across a key rotation.

## Deploy

```bash
supabase link --project-ref qajrlfqoicfcfhthsfay   # once per machine
supabase functions deploy <name> --project-ref qajrlfqoicfcfhthsfay
```

**`verify_jwt` lives in `supabase/config.toml` — do not pass it on the command
line, and `npm test` enforces that every function is listed there
(`verifyJwtConfig.test.mjs`).** Seven of the ten functions run with `verify_jwt = false` (pg_cron,
server-side callers, unauthenticated links). Without the config file the CLI
defaults to `true`, so a deploy that forgot `--no-verify-jwt` silently flipped
them to JWT-required and broke the caller — that is what happened on
2026-07-30 and why the config exists. Every function is listed there
explicitly, including the `true` ones; **add new functions to it in the same
commit**. Verified both directions after adding it: `handle_unsubscribe`
redeployed with no flag and stayed `false`, `handle_ripple_unsubscribe` stayed
`true`, and all ten still match their intended setting.

Note `--project-ref` is still required. Adding `config.toml` made the CLI stop
falling back to `supabase/.temp/linked-project.json` for ref resolution
(`LegacyProjectNotLinkedError`); harmless, and unlike `--no-verify-jwt` a
missing ref fails loudly instead of silently breaking a function.

**No `--schedule` flag on `check_schedule`.** Its 15-minute cadence is a
pg_cron job in the database calling the function over `net.http_post` (see
`cron.job`), not a CLI-managed schedule — passing `--schedule` adds a second,
duplicate invocation path. Same for `ripple_reminder` (hourly, same mechanism).

`_shared/` is bundled into each function at deploy time, not linked at runtime:
**a change under `_shared/` only reaches production for the functions you
redeploy.** Current consumers —

| shared module | functions to redeploy |
|---|---|
| `materializeSchedule.ts` | `check_schedule`, `auto-enroll` |
| `processAdherenceWithdrawal.ts` | `check_schedule`, `auto-enroll` |
| `labDate.ts` | `check_schedule`, `auto-enroll`, `create_anonymous_participant` |
| `issueLink.ts` | `check_schedule`, `auto-enroll`, `send_message` |
| `emailTemplate.ts`, `participantEmail.ts` | `check_schedule`, `auto-enroll`, `send_message` |
| `unsubscribeToken.ts` | `send_message` |
| `rippleUnsubscribeToken.ts` | `ripple_reminder` |
| `classVerifyEmail.ts` | `send-class-verification-email` |

Transitive, not just direct: `processAdherenceWithdrawal` pulls in
`emailTemplate`/`participantEmail`/`materializeSchedule`, and
`materializeSchedule` pulls in `issueLink`/`labDate` — the rows above already
account for that.

## Test send_message manually

```bash
curl -X POST https://qajrlfqoicfcfhthsfay.supabase.co/functions/v1/send_message \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"schedule_id": "<uuid>", "test_override_email": "you@email.com"}'
```

## Test ripple_reminder manually

`ripple_reminder` only sends inside three Toronto windows (08:00 / 12:00 / 19:00)
to users who are due, which means the email was unobservable on demand — it
shipped 2026-07-14 and nobody saw one until 2026-07-30. `test_override_email`
fixes that: it bypasses the window, the cadence/staleness filter and the
once-per-day dedup, and **does not** write `last_reminder_sent_on`, so a test can
never suppress somebody's real reminder later that day.

The content is identical to a real send, including a **real unsubscribe token** —
which is why the token has to belong to an actual account. With the service key
there's no caller identity to borrow, so name one:

```bash
curl -X POST https://qajrlfqoicfcfhthsfay.supabase.co/functions/v1/ripple_reminder \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"test_override_email": "you@email.com", "test_as_user_id": "<uuid>"}'
```

A **lab-role user's JWT** works too, and then `test_as_user_id` is optional — the
unsubscribe token is minted for the caller. Anything else gets 401/403.

Without the service key at hand, send it from SQL and let the working cron job
supply the credential, so the key is never pasted anywhere:

```sql
SELECT net.http_post(
  url     := 'https://qajrlfqoicfcfhthsfay.supabase.co/functions/v1/ripple_reminder',
  headers := jsonb_build_object('Content-Type','application/json',
             'Authorization', 'Bearer ' || (SELECT (regexp_match(command, 'sb_secret_[A-Za-z0-9_-]+'))[1]
                                              FROM cron.job WHERE jobname = 'check-schedule-every-15min')),
  body    := jsonb_build_object('test_override_email','you@email.com','test_as_user_id','<uuid>')
);
-- then read the result (pg_net is async):
SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 3;
```

## Invoke check_schedule manually

```bash
curl -X POST https://qajrlfqoicfcfhthsfay.supabase.co/functions/v1/check_schedule \
  -H "Authorization: Bearer <service-role-key>"
```

Both functions authenticate against the **service-role** key specifically
(`check_schedule` 401s on anything else; `send_message` falls back to treating
a non-service key as a caller JWT). Returns the tick's counters:
`{processed, suppressed, deferred, failed, missed, reminded, advanced, withdrawn, completed}`.
