// Shared email rendering utility — produces subject, html, and plain-text
// from participant and protocol data.
// Used by the send_message edge function.
// Email HTML uses inline styles only (Gmail strips <style> tags).

export function renderEmail(vars: {
  first_name: string
  study_day: number | null
  link_url: string
  expires_hours: number
  custom_subject: string | null
  custom_body: string | null
  unsubscribe_url: string | null
  is_test?: boolean
}): { subject: string; html: string; text: string } {
  // {{study_day}} resolves to the integer, or "your study" for single-shot rows
  const studyDayStr = vars.study_day != null ? String(vars.study_day) : 'your study'

  function resolve(template: string): string {
    return template
      .replace(/\{\{first_name\}\}/g, vars.first_name)
      .replace(/\{\{study_day\}\}/g, studyDayStr)
      .replace(/\{\{link_url\}\}/g, vars.link_url)
      .replace(/\{\{expires_hours\}\}/g, String(vars.expires_hours))
  }

  // Subject
  let subject = vars.custom_subject
    ? resolve(vars.custom_subject)
    : 'Your RADlab session is ready'
  if (vars.is_test) subject = `[TEST] ${subject}`

  // Body text (resolved)
  const bodyText = resolve(vars.custom_body ?? DEFAULT_BODY)

  // Convert resolved body text to HTML:
  // double newlines → <p> tags, single newlines → <br>
  const bodyHtml = bodyText
    .split(/\n\n+/)
    .map(para =>
      `<p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">${
        para.replace(/\n/g, '<br>')
      }</p>`
    )
    .join('\n')

  // Unsubscribe footer — omitted for test sends (unsubscribe_url is null)
  const unsubscribeHtml = vars.unsubscribe_url
    ? `<p style="margin:8px 0 0 0;font-size:11px;color:#abadb0;"><a href="${vars.unsubscribe_url}" style="color:#abadb0;">Unsubscribe from study emails</a></p>`
    : ''

  // Build full HTML email
  const html = HTML_WRAPPER
    .replace('{{email_body_html}}', bodyHtml)
    .replace(/\{\{link_url\}\}/g, vars.link_url)
    .replace(/\{\{expires_hours\}\}/g, String(vars.expires_hours))
    .replace('{{unsubscribe_footer_html}}', unsubscribeHtml)

  // Plain-text fallback (Resend sends both)
  const unsubscribeText = vars.unsubscribe_url
    ? `\n\nTo unsubscribe from study emails: ${vars.unsubscribe_url}`
    : ''
  const text = `${bodyText}\n\nBegin session: ${vars.link_url}${unsubscribeText}`

  return { subject, html, text }
}

// ─── Termination email (adherence check failure) ──────────────────────────────
// Distinct from renderEmail() above: no link, no CTA, no expiry notice — a
// plain informational message. Reuses the same header/card/footer branding
// with a trimmed wrapper (renderEmail's HTML_WRAPPER hardcodes the CTA
// button into the string, so this is a separate wrapper rather than adding
// link-optional branching into the heavily-used session-link path).

export function renderTerminationEmail(vars: {
  first_name: string
  study_name: string
  is_test?: boolean
}): { subject: string; html: string; text: string } {
  const bodyText = `Hi ${vars.first_name},

Unfortunately, you didn't complete the minimum required sessions for this phase of the study (we noted that at least 10 of 12 sessions are needed), we will award credit for the time you spent, but your participation in the study is now complete.

Thank you for your participation,
The RADlab Team
University of Toronto Mississauga`

  let subject = `Your participation in ${vars.study_name} is now complete`
  if (vars.is_test) subject = `[TEST] ${subject}`

  const bodyHtml = bodyText
    .split(/\n\n+/)
    .map(para =>
      `<p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">${
        para.replace(/\n/g, '<br>')
      }</p>`
    )
    .join('\n')

  const html = TERMINATION_HTML_WRAPPER.replace('{{email_body_html}}', bodyHtml)

  return { subject, html, text: bodyText }
}

const TERMINATION_HTML_WRAPPER = `<!DOCTYPE html>
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
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1c1c1e;font-weight:normal;">RADlab</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#abadb0;font-family:Arial,Helvetica,sans-serif;">Regulatory and Affective Dynamics Lab · University of Toronto Mississauga</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

              {{email_body_html}}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You are receiving this because you enrolled in a study at RADlab, University of Toronto Mississauga. If you believe this was sent in error, please contact your researcher.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

// ─── Default body ─────────────────────────────────────────────────────────────

const DEFAULT_BODY = `Hi {{first_name}},

Your session for Study Day {{study_day}} is ready.

Click the button below to begin. This link is personal to you — please don't share it.

This link will expire in {{expires_hours}} hours.

Thanks for participating,
The RADlab Team
University of Toronto Mississauga`

// ─── HTML wrapper ─────────────────────────────────────────────────────────────
// Table-based layout for email client compatibility.
// Placeholders replaced at render time:
//   {{email_body_html}}, {{link_url}}, {{expires_hours}}, {{unsubscribe_footer_html}}

const HTML_WRAPPER = `<!DOCTYPE html>
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
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1c1c1e;font-weight:normal;">RADlab</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#abadb0;font-family:Arial,Helvetica,sans-serif;">Regulatory and Affective Dynamics Lab · University of Toronto Mississauga</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

              {{email_body_html}}

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;"><tr>
                <td style="background-color:#f068a4;border-radius:8px;">
                  <a href="{{link_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">Begin session →</a>
                </td>
              </tr></table>

              <!-- Link fallback -->
              <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">Or copy this link: <a href="{{link_url}}" style="color:#f068a4;word-break:break-all;">{{link_url}}</a></p>

              <!-- Expiry notice -->
              <p style="margin:24px 0 0 0;font-size:12px;color:#abadb0;border-top:1px solid #f5f5f5;padding-top:16px;">This link expires in {{expires_hours}} hours and is personal to you — please don't share it.</p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You are receiving this because you enrolled in a study at RADlab, University of Toronto Mississauga. If you believe this was sent in error, please contact your researcher.</p>
              {{unsubscribe_footer_html}}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
