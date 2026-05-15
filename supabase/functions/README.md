# Edge Functions

## Prerequisites

Set these secrets in Supabase Dashboard → Edge Functions → Secrets:
- `RESEND_API_KEY` — from resend.com dashboard
- `FROM_EMAIL` — verified sender e.g. `research@radlab.vercel.app`
- `SITE_URL` — `https://radlab.vercel.app`
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API

## Deploy send_message

```bash
supabase functions deploy send_message
```

## Deploy check_schedule (with cron — runs every 15 minutes)

```bash
supabase functions deploy check_schedule --schedule "*/15 * * * *"
```

## Test send_message manually

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/send_message \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"schedule_instance_id": "<uuid>", "test_override_email": "you@email.com"}'
```

## Invoke check_schedule manually

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/check_schedule \
  -H "Authorization: Bearer <anon-key>"
```
