# Edge Functions

## Prerequisites

Set these secrets in Supabase Dashboard → Edge Functions → Secrets:
- `RESEND_API_KEY` — from resend.com dashboard
- `FROM_EMAIL` — verified sender e.g. `research@radlab.vercel.app`
- `SITE_URL` — `https://radlab.vercel.app`
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API

## Deploy

```bash
supabase link --project-ref qajrlfqoicfcfhthsfay   # once per machine
supabase functions deploy <name>
```

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

## Invoke check_schedule manually

```bash
curl -X POST https://qajrlfqoicfcfhthsfay.supabase.co/functions/v1/check_schedule \
  -H "Authorization: Bearer <service-role-key>"
```

Both functions authenticate against the **service-role** key specifically
(`check_schedule` 401s on anything else; `send_message` falls back to treating
a non-service key as a caller JWT). Returns the tick's counters:
`{processed, suppressed, deferred, failed, missed, reminded, advanced, withdrawn, completed}`.
