// The one email an open-recruitment participant gets before the study proper:
// the link to their first session, sent to the @mail.utoronto.ca address they
// gave after passing the screener (open-join, action 'submit_email').
//
// Sending the link only to that inbox IS the address check -- a mistyped or
// borrowed address simply never receives it -- so the email carries the link
// and nothing else that needs protecting. Same visual shell as
// selfEnrollEmail.ts.

export function renderOpenJoinEmail(vars: {
  study_title: string
  link_url: string
  expires_hours: number
  contact_email: string
}): { subject: string; html: string; text: string } {
  const subject = `Your link to begin: ${vars.study_title}`

  const html = `<!DOCTYPE html>
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
          <tr>
            <td style="padding:0 0 24px 0;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1c1c1e;font-weight:normal;">RADlab</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#abadb0;font-family:Arial,Helvetica,sans-serif;">Regulatory &amp; Affective Dynamics Lab · University of Toronto</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Thank you for your interest in <strong>${vars.study_title}</strong>. You're eligible to take part.</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">The link below opens the consent form. If you agree to take part, it continues straight into the first session (about 30 minutes). After that, each day's short session arrives at this address by email.</p>
              <p style="margin:20px 0 0 0;font-size:17px;font-weight:700;color:#1c1c1e;line-height:1.5;">Please set aside about 30 minutes before you open this link.</p>
              <table cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;"><tr>
                <td style="background-color:#f068a4;border-radius:8px;">
                  <a href="${vars.link_url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">Read the consent form and begin →</a>
                </td>
              </tr></table>
              <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">Or copy this link: <a href="${vars.link_url}" style="color:#f068a4;word-break:break-all;">${vars.link_url}</a></p>
              <p style="margin:24px 0 0 0;font-size:12px;color:#abadb0;border-top:1px solid #f5f5f5;padding-top:16px;">This link is personal to you and expires in ${vars.expires_hours} hours — please don't share it. Questions? Reply to this email or write to <a href="mailto:${vars.contact_email}" style="color:#f068a4;">${vars.contact_email}</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You are receiving this because this address was entered on the sign-up page for ${vars.study_title}. If that wasn't you, ignore this message; nothing further will be sent.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Thank you for your interest in ${vars.study_title}. You're eligible to take part.

The link below opens the consent form. If you agree to take part, it continues straight into the first session (about 30 minutes). After that, each day's short session arrives at this address by email.

PLEASE SET ASIDE ABOUT 30 MINUTES BEFORE YOU OPEN THIS LINK.

Read the consent form and begin: ${vars.link_url}

This link is personal to you and expires in ${vars.expires_hours} hours. Questions? Reply to this email or write to ${vars.contact_email}.

If this wasn't you, ignore this message; nothing further will be sent.`

  return { subject, html, text }
}
