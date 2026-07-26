# Claude Code Prompt — Email Templates & Per-Protocol Message Customization

## Context

You are working on the RADlab Come, See platform. Read `website.md` in full before making any changes. The email sending pipeline (`send_message` Edge Function) is already live. This prompt improves the email content layer in three parts:

1. HTML email template with RADlab branding
2. Verified template variable resolution in `send_message`
3. Per-protocol custom subject and body in the protocol builder UI

Do not touch any game files, lab pages, session runner, or unrelated admin pages.

---

## Design System (for email)

Email clients are restrictive — inline styles only, no Tailwind, no external fonts. Keep it simple:

- Background: `#FCF0F5`
- Card background: `#ffffff`
- Accent: `#f068a4`
- Dark text: `#1c1c1e`
- Gray text: `#abadb0`
- Font stack: `Georgia, 'Times New Roman', serif` for headings (approximates DM Serif Display); `Arial, Helvetica, sans-serif` for body (approximates DM Sans)
- Button: `#f068a4` background, white text, 8px border radius, generous padding
- Max width: 600px centered

---

## 1. Schema Addition

```sql
ALTER TABLE study_protocols
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text;
```

`email_subject` and `email_body` are nullable. When null, the default template is used.

---

## 2. HTML Email Template

Create `supabase/functions/_shared/emailTemplate.ts`.

This is a shared utility used by `send_message`. It exports a single function:

```ts
export function renderEmail(variables: {
  first_name: string;
  study_day: number | null;
  link_url: string;
  expires_hours: number;
  custom_subject: string | null;
  custom_body: string | null;
}): { subject: string; html: string; text: string }
```

### Subject resolution

```
if custom_subject exists → resolve template variables in it
else → "Your RADlab session is ready"
prepend "[TEST] " if is_test (pass as a flag)
```

### Body resolution

```
if custom_body exists → resolve template variables in it, wrap in HTML template
else → use default body, wrap in HTML template
```

### Default body text

```
Hi {{first_name}},

Your session for Study Day {{study_day}} is ready.

Click the button below to begin. This link is personal to you — please don't share it.

This link will expire in {{expires_hours}} hours.

Thanks for participating,
The RADlab Team
University of Toronto Mississauga
```

### Template variable resolution

Replace all occurrences of these tokens in subject and body:

| Token | Value |
|---|---|
| `{{first_name}}` | First word of participant display_name |
| `{{study_day}}` | `study_day` integer from schedule row, or "your study" if null (single_shot) |
| `{{link_url}}` | Full session URL |
| `{{expires_hours}}` | `link_expires_hours` from `protocol_day_contacts`, default 48 |

### HTML wrapper

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RADlab</title>
</head>
<body style="margin:0;padding:0;background-color:#FCF0F5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FCF0F5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px 0;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1c1c1e;font-weight:normal;">
                RADlab
              </p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#abadb0;font-family:Arial,Helvetica,sans-serif;">
                Regulatory and Affective Dynamics Lab · University of Toronto Mississauga
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
              
              <!-- Body content injected here -->
              {{email_body_html}}

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;">
                <tr>
                  <td style="background-color:#f068a4;border-radius:8px;">
                    <a href="{{link_url}}" 
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">
                      Begin session →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">
                Or copy this link: <a href="{{link_url}}" style="color:#f068a4;word-break:break-all;">{{link_url}}</a>
              </p>

              <!-- Expiry notice -->
              <p style="margin:24px 0 0 0;font-size:12px;color:#abadb0;border-top:1px solid #f5f5f5;padding-top:16px;">
                This link expires in {{expires_hours}} hours and is personal to you — please don't share it.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">
                You are receiving this because you enrolled in a study at RADlab, University of Toronto Mississauga.
                If you believe this was sent in error, please contact your researcher.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

Convert the resolved body text to simple HTML paragraphs (split on double newlines → `<p>` tags) before injecting into `{{email_body_html}}`. Preserve single newlines as `<br>`.

Also return a `text` version (plain text fallback) — just the resolved body with the link on its own line. Resend accepts both `html` and `text` fields.

---

## 3. Update `send_message` Edge Function

Update `supabase/functions/send_message/index.ts` to:

1. Import `renderEmail` from `../_shared/emailTemplate.ts`

2. Fetch `email_subject` and `email_body` from `study_protocols` for this schedule row's protocol

3. Pass all resolved values to `renderEmail`:
   ```ts
   const { subject, html, text } = renderEmail({
     first_name,
     study_day,
     link_url,
     expires_hours,
     custom_subject: protocol.email_subject ?? null,
     custom_body: protocol.email_body ?? null,
   });
   ```

4. Update the Resend send call to pass both `html` and `text`:
   ```ts
   await resend.emails.send({
     from: Deno.env.get('FROM_EMAIL'),
     to: recipientEmail,
     subject,
     html,
     text,
   });
   ```

5. Verify all four template variables are resolved before sending — log a warning to console if any remain unresolved (still contain `{{`) after substitution.

---

## 4. Protocol Builder UI — Custom Email Fields

Update `src/pages/admin/ProtocolBuilder.jsx`.

### Where to add it

After the existing protocol config fields (allow restart, reminders, etc.), add a collapsible section labelled **"Email message"** — collapsed by default, expanded by clicking.

### Fields

**Subject line**
- Text input, full width
- Placeholder: `Your RADlab session is ready`
- Helper text below: "Leave blank to use the default subject."

**Message body**
- Textarea, full width, min 6 rows
- Placeholder: the full default body text (showing participants what they'll receive if no custom body is set)
- Helper text below: "Leave blank to use the default message."

**Available variables hint** (shown below the textarea, always visible):
```
Available: {{first_name}}  {{study_day}}  {{link_url}}  {{expires_hours}}
```
Each token displayed as a small pill (light pink background `#fce7f3`, pink text `#f068a4`, monospace font, click-to-copy).

**Preview button**
- Opens a modal showing a live-rendered preview of the email
- Renders the subject and body with placeholder values substituted:
  - `{{first_name}}` → "Alex"
  - `{{study_day}}` → "3"
  - `{{link_url}}` → "https://radlab.zone/s/example-token"
  - `{{expires_hours}}` → "48"
- Preview shows the full HTML email in an iframe (600px wide, centered)
- "Close" button to dismiss

### Save behaviour

Include `email_subject` and `email_body` in the upsert to `study_protocols`. Null if left blank (trim whitespace, treat empty string as null).

---

## 5. File Checklist

```
supabase/
  migrations/
    YYYYMMDD_protocol_email_fields.sql
  functions/
    _shared/
      emailTemplate.ts          ← new shared utility
    send_message/
      index.ts                  ← updated to use renderEmail

src/
  pages/
    admin/
      ProtocolBuilder.jsx       ← add email fields section
```

---

## Notes

- `_shared/` is a Supabase Edge Functions convention for shared utilities — import with relative path `../_shared/emailTemplate.ts`
- Email HTML must use inline styles only — no external CSS, no `<style>` tags (Gmail strips them)
- Table-based layout is intentional for email client compatibility
- The preview iframe should use `srcDoc` to inject the rendered HTML string directly
- Do not modify any files outside the checklist
- Follow existing code style and TanStack Query patterns in the codebase
```
