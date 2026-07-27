# Claude Code Prompt — Email Sending Pipeline

## Context

You are working on the RADlab Come, See platform. Read `website.md` in full before making any changes. The stack is React + Vite + Tailwind CSS v3 + Supabase + Resend for email. Study infrastructure, schedule generator, and admin UI are already built.

This prompt adds:
1. A `send_message` Supabase Edge Function — the core email sending primitive
2. A `check_schedule` Supabase Edge Function — cron-triggered scheduler
3. A schema addition to `message_log`
4. A "Send test" UI hook in `StudyDetail.jsx`

Do not touch any game files, lab pages, or unrelated admin pages.

---

## Prerequisites

### Resend setup
- Create a free account at resend.com
- Add and verify your sending domain (e.g. `radlab.vercel.app` or a custom domain)
- Generate an API key
- Add to Supabase Edge Function secrets: `RESEND_API_KEY`
- Add a `FROM_EMAIL` secret: e.g. `research@radlab.vercel.app`

### Supabase service role key
Edge Functions that query `auth.users` need the service role key, not the anon key.
Add to Edge Function secrets: `SUPABASE_SERVICE_ROLE_KEY`

---

## 1. Schema Addition

```sql
ALTER TABLE message_log ADD COLUMN IF NOT EXISTS is_test bool DEFAULT false;
```

---

## 2. `send_message` Edge Function

Create `supabase/functions/send_message/index.ts`.

### Invocation

Called via HTTP POST with a JSON body:

```json
{
  "schedule_instance_id": "uuid",
  "test_override_email": "optional@email.com"
}
```

`test_override_email` is optional. When provided, this is a test send.

### Logic

```
1. Validate input — return 400 if schedule_instance_id is missing

2. Fetch participant_schedule row:
   - Join to study_tasks, protocol_day_contacts, session_templates
   - Get: participant_id, session_template_id, scheduled_for, 
          contact_order, study_day, protocol_id, link_id, status

3. Fetch participant profile:
   - Query profiles for display_name, role
   - Query auth.users (via service role client) for email
   - Derive first_name: first word of display_name

4. If not a test send:
   - Fetch participant_consent for this participant + study
   - If email_reminders = false → return 200 { suppressed: true, reason: 'consent_not_given' }

5. Resolve link:
   - If participant_schedule.link_id is not null → fetch token from participant_links
   - If null → call issueLink(schedule_instance_id) to mint a new token
   - Construct link_url: `${SITE_URL}/s/${token}`
   - SITE_URL secret should be set to https://radlab.vercel.app

6. Render message:
   - Subject: "[TEST] Your RADlab session is ready" if test, else "Your RADlab session is ready"
   - Body: resolve template variables in the session_template's message body if one exists,
           otherwise use the default template below
   - Template variables to resolve: {{first_name}}, {{study_day}}, {{link_url}}, {{scheduled_for}}

7. Send via Resend:
   - To: test_override_email if test, else participant's email from auth.users
   - From: FROM_EMAIL secret
   - Subject and body as rendered above

8. Insert into message_log:
   - participant_id, sent_at, channel = 'email'
   - status = 'sent' or 'failed' based on Resend response
   - is_test = true if test_override_email was provided
   - suppressed_reason = null

9. Return:
   - 200 { success: true, message_id, recipient } on success
   - 200 { success: false, error } on Resend failure (still log the failure)
   - 400 on invalid input
   - 500 on unexpected errors
```

### Default email template

```
Subject: Your RADlab session is ready

Hi {{first_name}},

Your session for Study Day {{study_day}} is ready.

Click the link below to begin. This link is personal to you — please don't share it.

{{link_url}}

This link will expire in {{expires_hours}} hours.

Thanks for participating,
The RADlab Team
University of Toronto Mississauga
```

Plain text first. HTML version is a stretch goal — skip for now.

---

## 3. `check_schedule` Edge Function

Create `supabase/functions/check_schedule/index.ts`.

### Invocation

Triggered by Supabase cron every 15 minutes. Also callable manually via HTTP POST with an empty body for testing.

### Logic

```
1. Query participant_schedule where:
   - status = 'pending'
   - scheduled_for <= now()
   - scheduled_for is not null (excludes single_shot rows)

2. For each row, run suppression checks:

   a. Active link check:
      - If participant already has an active link (status = 'active' in participant_links)
        AND that link belongs to a different schedule row → suppress
        reason: 'existing_active_link'

   b. New link imminent check:
      - Fetch protocol reminder_interval_hours
      - If another pending schedule row has scheduled_for within reminder_interval_hours from now
        → suppress current row, the imminent row will be processed next cycle
        reason: 'new_link_imminent'

   c. Max attempts check:
      - If participant_schedule.attempts >= protocol.max_attempts → suppress
        reason: 'max_attempts_reached'

3. If not suppressed:
   - Call send_message({ schedule_instance_id: row.id })
   - Increment participant_schedule.attempts by 1

4. If suppressed:
   - Insert into message_log with status = 'suppressed', suppressed_reason, is_test = false

5. Return summary: { processed: N, suppressed: N, failed: N }
```

### Cron setup

Add to `supabase/functions/check_schedule/index.ts` a cron schedule declaration comment at the top:

```ts
// Schedule: every 15 minutes
// supabase functions deploy check_schedule --schedule "*/15 * * * *"
```

Include deployment instructions in a comment — do not attempt to register the cron programmatically.

---

## 4. Admin UI — "Send test" hook in StudyDetail.jsx

### Where it goes

In the schedule audit table (the per-participant schedule view), add a **Send test** button on each row where `status` is `pending`, `link_sent`, or `unlocked`.

### Behavior

1. Click "Send test" → opens a modal
2. Modal content:
   - Heading: "Send test email"
   - Body: "This sends a test version of this scheduled message to your email address. It will not affect the participant's schedule or consent record."
   - Input: "Send to" — pre-filled with the currently logged-in PI's email (fetch from `auth.users` via `supabase.auth.getUser()`)
   - Buttons: Cancel | Send test
3. On confirm:
   - POST to `/functions/v1/send_message` with `{ schedule_instance_id, test_override_email }`
   - Show loading state on the button
   - On success: show a green toast "Test email sent to [email]"
   - On failure: show a red toast with the error message
4. Modal closes after send regardless of outcome

### Toast component

Use a simple inline toast — a fixed-position div at bottom-right, auto-dismisses after 4 seconds. Match platform colors: green `#22c55e` for success, red `#ef4444` for failure. If a toast component already exists in the codebase, use it.

---

## 5. Environment Variables / Secrets

The following secrets must be set in Supabase Dashboard → Edge Functions → Secrets before deploying:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | From resend.com dashboard |
| `FROM_EMAIL` | e.g. `research@radlab.vercel.app` |
| `SITE_URL` | `https://radlab.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API |

Add a `supabase/functions/.env.example` file listing these with placeholder values and comments.

---

## 6. Deployment Instructions

Include a `supabase/functions/README.md` with:

```markdown
# Edge Functions

## Deploy send_message
supabase functions deploy send_message

## Deploy check_schedule
supabase functions deploy check_schedule --schedule "*/15 * * * *"

## Test send_message manually (replace UUIDs and email)
curl -X POST https://<project-ref>.supabase.co/functions/v1/send_message \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"schedule_instance_id": "<uuid>", "test_override_email": "you@email.com"}'

## Invoke check_schedule manually
curl -X POST https://<project-ref>.supabase.co/functions/v1/check_schedule \
  -H "Authorization: Bearer <anon-key>"
```

---

## 7. File Checklist

```
supabase/
  migrations/
    YYYYMMDD_message_log_test_flag.sql
  functions/
    send_message/
      index.ts
    check_schedule/
      index.ts
    .env.example
    README.md

src/
  pages/
    admin/
      StudyDetail.jsx    ← add Send test button + modal + toast only
```

---

## Notes

- Use the Resend Deno SDK: `import { Resend } from 'npm:resend'`
- Use `createClient` from `npm:@supabase/supabase-js` inside Edge Functions — do not import from `src/lib/supabase.js` (that is browser-only)
- For auth.users lookups use the service role client, not the anon client
- All timestamps UTC
- Do not modify any files outside the checklist above
- Keep Edge Function code simple and well-commented — these will need to be debugged in production
```
