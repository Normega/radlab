// Withdrawal-link email for a participant turned away by a study exclusion
// group (studies.exclusion_group; see auto-enroll's exclusion check).
//
// Sent only on the participant's request from the join page, and only to the
// contact email on the enrollment they would be withdrawing from -- the join
// page never shows the link itself, because the SONA id that identifies them
// arrives on the URL and anyone could type someone else's.
//
// The link goes to the existing /withdraw/:token page, which asks for
// confirmation before anything happens (mail scanners open every link).
// Same visual shell as selfEnrollEmail.ts.

export function renderExclusionWithdrawEmail(vars: {
  current_study_name: string
  withdraw_url: string
  contact_email: string
}): { subject: string; html: string; text: string } {
  const subject = `Withdrawing from ${vars.current_study_name}`

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
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">You asked to join another of our studies while you are taking part in <strong>${vars.current_study_name}</strong>. Our multi-week studies run one at a time, so to join the new one you first need to withdraw from ${vars.current_study_name}.</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Withdrawing ends your participation in ${vars.current_study_name}: you will get no further sessions from it. The next page asks you to confirm before anything changes.</p>
              <table cellpadding="0" cellspacing="0" style="margin:24px 0 0 0;"><tr>
                <td style="background-color:#f068a4;border-radius:8px;">
                  <a href="${vars.withdraw_url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">Withdraw from ${vars.current_study_name} →</a>
                </td>
              </tr></table>
              <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">Or copy this link: <a href="${vars.withdraw_url}" style="color:#f068a4;word-break:break-all;">${vars.withdraw_url}</a></p>
              <p style="margin:24px 0 0 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Once you have withdrawn, go back to SONA and open the new study again. It will start normally.</p>
              <p style="margin:24px 0 0 0;font-size:12px;color:#abadb0;border-top:1px solid #f5f5f5;padding-top:16px;">If you would rather stay in ${vars.current_study_name}, ignore this email; nothing changes. Questions: <a href="mailto:${vars.contact_email}" style="color:#f068a4;">${vars.contact_email}</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You are receiving this because someone using your SONA ID asked for it on a RADlab study page. If that wasn't you, ignore this message; nothing has changed.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `You asked to join another of our studies while you are taking part in ${vars.current_study_name}. Our multi-week studies run one at a time, so to join the new one you first need to withdraw from ${vars.current_study_name}.

Withdrawing ends your participation in ${vars.current_study_name}: you will get no further sessions from it. The page asks you to confirm before anything changes.

Withdraw: ${vars.withdraw_url}

Once you have withdrawn, go back to SONA and open the new study again. It will start normally.

If you would rather stay in ${vars.current_study_name}, ignore this email; nothing changes. Questions: ${vars.contact_email}

You are receiving this because someone using your SONA ID asked for it on a RADlab study page. If that wasn't you, ignore this message.`

  return { subject, html, text }
}
