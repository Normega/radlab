# Supabase Auth email templates

Branded templates for the emails **Supabase Auth itself** sends (password reset, signup
confirmation, etc.). These are separate from the study-email pipeline — study reminders go
through the `send_message` edge function and `_shared/emailTemplate.ts`; auth emails are sent
directly by Supabase using templates configured in the dashboard. This folder is the
version-controlled source of truth for those dashboard templates.

| File | Dashboard template | Subject line to set |
|---|---|---|
| `reset_password.html` | Reset Password | `Reset your RADlab password` |

## Why this exists

The stock Supabase reset email ("Reset Password / Follow this link…") is two unbranded lines
sent from Supabase's shared mail pool — generic enough that it lands in junk folders. The
branded template mirrors the study-email design (`_shared/emailTemplate.ts`): logo + wordmark
header, white card on the pink `#FCF0F5` background, `#f068a4` CTA button, UTM footer. The
logo is loaded from `https://www.radlab.zone/HQlogo.png` (PNG, not the SVGs — Gmail and
Outlook don't render SVG images).

## How to apply (dashboard, ~2 min)

1. Supabase dashboard → **Authentication → Emails** (email templates) → **Reset Password** tab
2. Set the subject line (table above)
3. Paste the full contents of `reset_password.html` into the message body (source/HTML mode)
4. Save, then use "Send test email" / a real `/forgot-password` request to verify

The `{{ .ConfirmationURL }}` / `{{ .Email }}` placeholders are Supabase Go-template variables —
leave them exactly as written. `{{ .ConfirmationURL }}` already includes the
`redirectTo=<origin>/reset-password` set by `ForgotPassword.jsx`.

The template says the link "expires in 1 hour" — that matches the default
**Auth → Providers → Email → OTP expiry** of 3600 s. If that setting is changed, change the
copy too.

## Deliverability: the template alone won't fix junk-foldering

A prettier body helps, but the main reason auth emails go to spam is the **sender**: by
default they come from `noreply@mail.app.supabase.io`, Supabase's shared pool, with no
SPF/DKIM alignment to our domain. The study emails already avoid this by sending through
Resend. Point Supabase Auth at the same Resend account:

1. Resend dashboard → verify the sending domain (already done for the study pipeline —
   reuse it)
2. Supabase dashboard → **Project Settings → Authentication → SMTP Settings** → enable
   custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the Resend API key (same one as the `RESEND_API_KEY` edge-function secret)
   - Sender email: a verified address on our domain, e.g. `research@radlab.zone`
   - Sender name: `RADlab`
3. Note: enabling custom SMTP removes Supabase's built-in 2-emails/hour rate cap and applies
   your own limits under **Auth → Rate Limits** — review them after switching.

With both in place the reset email is DKIM-signed for our own domain, from a sender the
recipient has plausibly seen before, with a distinctive branded body — all three of which
push it out of the junk folder.

## Adding more templates

Signup confirmation, magic link, invite, and email-change templates can reuse the same
wrapper: copy `reset_password.html`, swap the card copy and CTA, and keep the Supabase
variable names from the dashboard's variable reference for that template type. Commit the
file here and add a row to the table above when you apply one.
