# Claude Code Prompt — Unsubscribe Flow

## Context

You are working on the RADlab Come, See platform. Read `website.md` in full before making any changes. The email pipeline (`send_message` Edge Function), HTML email template (`_shared/emailTemplate.ts`), and admin study UI are already live.

This prompt adds a compliant unsubscribe flow to all outgoing study emails. Do not touch any game files, lab pages, session runner, or unrelated admin pages.

---

## Overview

Every study email includes a signed unsubscribe link. Clicking it lands the participant on a dedicated page that sets `participant_consent.email_reminders = false`. The `send_message` function already checks this flag before sending, so emails stop automatically. The admin participant list reflects the unsubscribed state.

Behaviour differs based on `study.messaging_required`:
- `messaging_required = false` → unsubscribe succeeds silently, confirmation shown
- `messaging_required = true` → unsubscribe is blocked, participant is directed to contact their researcher to withdraw from the study

---

## 1. Schema Addition

```sql
CREATE TABLE participant_unsubscribe_tokens (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token            text UNIQUE NOT NULL,
  participant_id   uuid REFERENCES profiles(id),
  study_id         uuid REFERENCES studies(id),
  created_at       timestamptz DEFAULT now(),
  used_at          timestamptz
);
```

---

## 2. Token Generation Utility

Add to `supabase/functions/_shared/unsubscribeToken.ts`:

```ts
export async function getOrCreateUnsubscribeToken(
  supabase,
  participantId: string,
  studyId: string
): Promise<string>
```

Logic:
- Check if an existing token exists for this `participant_id` + `study_id` combination
- If yes, return existing token (tokens are reusable — no expiry)
- If no, generate a new `crypto.randomUUID()` token, insert into `participant_unsubscribe_tokens`, return token

Construct the unsubscribe URL as:
```
${SITE_URL}/unsubscribe/${token}
```

---

## 3. Update `send_message` Edge Function

Update `supabase/functions/send_message/index.ts`:

1. Import `getOrCreateUnsubscribeToken` from `../_shared/unsubscribeToken.ts`
2. After resolving the participant and study, call `getOrCreateUnsubscribeToken`
3. Pass `unsubscribe_url` to `renderEmail`
4. Do not generate an unsubscribe token or include the link for test sends (`test_override_email` is set) — instead pass `unsubscribe_url: null`

---

## 4. Update `emailTemplate.ts`

Update `supabase/functions/_shared/emailTemplate.ts`:

Add `unsubscribe_url: string | null` to the variables parameter.

Add to the email footer, below the existing footer paragraph:

```html
<!-- only render if unsubscribe_url is not null -->
<p style="margin:8px 0 0 0;font-size:11px;color:#abadb0;">
  <a href="{{unsubscribe_url}}" style="color:#abadb0;">Unsubscribe from study emails</a>
</p>
```

If `unsubscribe_url` is null (test send), omit this line entirely.

Also add to the plain text footer:
```
To unsubscribe from study emails: {{unsubscribe_url}}
```
Omit if null.

---

## 5. Unsubscribe Page

Create `src/pages/Unsubscribe.jsx` mounted at `/unsubscribe/:token`.

This is a standalone full-screen page — no nav, no admin layout, no auth required.

### On mount

1. Extract `token` from URL params
2. POST to a new `handle_unsubscribe` Edge Function (see section 6) with `{ token }`
3. Show a loading state while waiting

### Outcomes

**Success (messaging_required = false):**
```
Heading: "You've been unsubscribed"
Body: "You'll no longer receive email reminders for this study. 
       You can still participate by clicking any session links you receive."
```

**Blocked (messaging_required = true):**
```
Heading: "Email reminders are required for this study"
Body: "Email reminders are part of your participation agreement for this study. 
       If you'd like to withdraw from the study entirely, 
       please contact your researcher directly."
```

**Invalid token:**
```
Heading: "This link is not valid"
Body: "If you need help, please contact your researcher."
```

**Already unsubscribed:**
```
Heading: "Already unsubscribed"
Body: "You've already been unsubscribed from email reminders for this study."
```

### Styling

Match platform design system — `#FCF0F5` background, white card centered on screen, DM Serif Display heading, DM Sans body, `#f068a4` accent. Same card style as `SessionEntry.jsx`. No buttons needed — this is a terminal state page.

---

## 6. `handle_unsubscribe` Edge Function

Create `supabase/functions/handle_unsubscribe/index.ts`.

### Invocation

HTTP POST with JSON body:
```json
{ "token": "uuid" }
```

No auth required — token is the credential.

### Logic

```
1. Validate input — return 400 if token missing

2. Look up token in participant_unsubscribe_tokens
   - If not found → return 404 { error: 'invalid_token' }

3. Fetch participant_consent for participant_id + study_id
   - If email_reminders already false → return 200 { status: 'already_unsubscribed' }

4. Fetch study.messaging_required
   - If true → return 200 { status: 'blocked', reason: 'messaging_required' }

5. Set participant_consent.email_reminders = false

6. Set participant_unsubscribe_tokens.used_at = now()

7. Return 200 { status: 'success' }
```

Use the service role client (RADLAB_SERVICE_ROLE_KEY) — this endpoint is unauthenticated so the anon client cannot update consent rows.

---

## 7. Admin UI — Unsubscribed Badge

Update `src/pages/admin/StudyDetail.jsx`:

In the participants table, add a visual indicator when `participant_consent.email_reminders = false`:

- Show a small badge next to the participant's name: `email off`
- Style: light gray background `#f5f5f5`, gray text `#abadb0`, 10px Space Mono font, pill shape
- Tooltip on hover: "Unsubscribed from email reminders"

Add a **Re-enable emails** action in the participant row actions (next to "View schedule" and "Revoke access"):
- Only shown when `email_reminders = false`
- On click: show a confirm dialog "Re-enable email reminders for this participant?"
- On confirm: set `participant_consent.email_reminders = true` in Supabase
- Refresh the participant list after

---

## 8. App.jsx Route Addition

```jsx
<Route path="/unsubscribe/:token" element={<Unsubscribe />} />
```

No layout wrapper — standalone page.

---

## 9. File Checklist

```
supabase/
  migrations/
    YYYYMMDD_unsubscribe_tokens.sql
  functions/
    _shared/
      unsubscribeToken.ts         ← new shared utility
      emailTemplate.ts            ← add unsubscribe_url support
    send_message/
      index.ts                    ← call getOrCreateUnsubscribeToken, pass to renderEmail
    handle_unsubscribe/
      index.ts                    ← new Edge Function

src/
  pages/
    Unsubscribe.jsx               ← new standalone page
    admin/
      StudyDetail.jsx             ← add unsubscribed badge + re-enable action
```

---

## Notes

- `handle_unsubscribe` must use the service role client — anon client cannot update `participant_consent` rows due to RLS
- Unsubscribe tokens do not expire — they are permanent per participant per study
- Do not invalidate or delete tokens after use — `used_at` is for audit only, tokens remain valid for repeated unsubscribe attempts (idempotent)
- Test sends never include an unsubscribe link — pass `unsubscribe_url: null` and omit the footer link
- Do not modify any files outside the checklist
- Follow existing component patterns and TanStack Query conventions in the codebase
```
