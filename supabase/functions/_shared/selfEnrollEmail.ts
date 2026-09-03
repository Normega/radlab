// Self-enrollment verification email.
//
// Separate from emailTemplate.ts (whose copy and "Begin session" CTA are for
// participants who are already enrolled) and from classVerifyEmail.ts (Lecture
// Lounge, a course rather than a study). Same visual shell as the latter.

export function renderSelfEnrollEmail(vars: {
  study_name: string
  verify_url: string
  expires_hours: number
}): { subject: string; html: string; text: string } {
  const subject = `Confirm your email to join ${vars.study_name}`

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
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">You consented to take part in <strong>${vars.study_name}</strong>. Confirm this is your email address to finish signing up and start the first session.</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Later sessions will be sent to this address, so it needs to be one you check.</p>
              <table cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;"><tr>
                <td style="background-color:#f068a4;border-radius:8px;">
                  <a href="${vars.verify_url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">Confirm and begin →</a>
                </td>
              </tr></table>
              <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">Or copy this link: <a href="${vars.verify_url}" style="color:#f068a4;word-break:break-all;">${vars.verify_url}</a></p>
              <p style="margin:24px 0 0 0;font-size:12px;color:#abadb0;border-top:1px solid #f5f5f5;padding-top:16px;">This link expires in ${vars.expires_hours} hours and is personal to you — please don't share it. You are not signed up until you use it.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You are receiving this because this address was entered on the sign-up page for ${vars.study_name}. If that wasn't you, ignore this message — nothing has been created and no one has been signed up.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `You consented to take part in ${vars.study_name}. Confirm this is your email address to finish signing up and start the first session.

Later sessions will be sent to this address, so it needs to be one you check.

Confirm and begin: ${vars.verify_url}

This link expires in ${vars.expires_hours} hours. You are not signed up until you use it.

If this wasn't you, ignore this message — nothing has been created.`

  return { subject, html, text }
}
