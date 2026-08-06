# Supabase auth email templates

**These files are the source of truth for templates that live in a dashboard field.**

Supabase auth emails — signup confirmation, password reset, magic link — are **not** sent by any code
in this repo. They are configured per project at:

> Supabase Dashboard → *(project)* → **Authentication** → **Email Templates**

That means they have no history, no review, and no existence outside one text box per project. Keeping
a copy here is the whole point of this directory: if a dashboard field is edited or lost, this is what
it should be restored from. **Edit the file, then paste it into the dashboard** — not the other way
round.

Not to be confused with the *sent-by-code* emails, which are already version-controlled and need no
copying: `supabase/functions/_shared/emailTemplate.ts` (participant/study messages) and
`classVerifyEmail.ts` (Lecture Lounge).

## Files

| File | Project | Template | Subject |
|---|---|---|---|
| `confirm-signup-radlab.html` | main **radlab** | Confirm signup | `Confirm your RADlab account` |
| `confirm-signup-fieldguide.html` | **radlab-academic** (`qldgwpneygvgcvexlduz`) | Confirm signup | `Confirm your PSY240 Field Guide account` |

The only variable used is `{{ .ConfirmationURL }}`.

## Why the Field Guide version differs structurally

The main-site template centres a `<div>` with `max-width` and `margin: 0 auto`. That is fine for a
general audience, but **the Field Guide's audience is U of T students, whose mail is Outlook/Exchange —
and Outlook ignores both `max-width` and `margin: 0 auto` on a div.** The email would render
full-width and left-aligned for most of the class.

The Field Guide version therefore uses a **table wrapper**, which is the only reliable way to centre a
fixed-width email in Outlook. It looks identical in clients that support modern CSS. Same logo, same
`#f068a4`, same button, same voice.

Two further changes, both audience-driven rather than cosmetic:

- **Georgia for the heading**, matching `emailTemplate.ts` and the site's DM Serif Display.
- **A line about which address to use.** Field Guide access is granted from the course roster via
  `invites`, so a student who confirms with a personal address rather than their U of T one will
  authenticate successfully and then be refused at the roster gate. Saying so in the email is cheaper
  than answering it 200 times. (This is exactly what happened to `norman@radlab.zone` on 2026-08-03 —
  signup succeeded, no invite matched, `handle_new_user` created a person row and no enrolment.)

## Related configuration, also dashboard-only

Neither of these is in the repo either, and both have already caused a live bug:

- **Site URL** and **Redirect URLs** allow-list (Authentication → URL Configuration). Supabase
  silently ignores `emailRedirectTo` unless the target is allow-listed, and falls back to Site URL —
  which is how Field Guide confirmation links pointed at `localhost` on 2026-08-03. radlab-academic
  needs Site URL `https://radlab.zone` and `https://radlab.zone/**` allow-listed.
- **SMTP sender**, if Resend is configured for a project rather than Supabase's default sender.
