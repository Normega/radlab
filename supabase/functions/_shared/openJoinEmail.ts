// The one email an open-recruitment participant gets before the study proper:
// the link to their first session, sent to the @mail.utoronto.ca address they
// gave after passing the screener (open-join, action 'submit_email').
//
// Sending the link only to that inbox IS the address check -- a mistyped or
// borrowed address simply never receives it -- so the email carries the link
// and nothing else that needs protecting. Same visual shell as
// selfEnrollEmail.ts.
//
// The body is per study, keyed by studies.open_join_slug, because the studies
// behind open recruitment differ in exactly the facts this email states: how
// long the first sitting takes, whether there was a screener to pass, and what
// happens afterwards. The first version hardcoded Liliana Study 3's copy ("You're
// eligible", "about 30 minutes", "each day's short session"), so the UTMAP survey
// sent its participants a description of a different study. DEFAULT_COPY is that
// original wording, unchanged, so habits sends exactly what it always has.

type Copy = {
  intro: (title: string) => string   // first paragraph; HTML-safe title is passed in
  body: string                       // what happens when they click
  emphasis: string                   // the one bold line above the button
  after?: string                     // optional line after the button block
  button: string
}

const DEFAULT_COPY: Copy = {
  intro: (t) => `Thank you for your interest in <strong>${t}</strong>. You're eligible to take part.`,
  body: "The link below opens the consent form. If you agree to take part, it continues straight into the first session (about 30 minutes). After that, each day's short session arrives at this address by email.",
  emphasis: 'Please set aside about 30 minutes before you open this link.',
  button: 'Read the consent form and begin →',
}

const COPY_BY_SLUG: Record<string, Copy> = {
  // UTMAP 2026. No screener, so nothing about eligibility. One sitting, and the
  // prize is claimed at the table by showing the completion code on the last
  // screen (CompletionTokenStep), which the email has to prepare them for.
  utmaps: {
    // The public title is a question, so only add a full stop when the title
    // does not already end in punctuation (otherwise: "really doing?.").
    intro: (t) => `Thank you for taking part in <strong>${t}</strong>${/[.?!]$/.test(t) ? '' : '.'}`,
    body: 'The link below opens the consent form. If you agree to take part, it continues straight into the survey.',
    emphasis: 'The survey takes 8 to 10 minutes.',
    after: 'When you are done, please show the researcher your completion code. It appears on the last screen of the survey.',
    button: 'Read the consent form and begin →',
  },
}

COPY_BY_SLUG.classtrial = {
  // The PSY240 class trial (Oct 2026): a teaching exercise, not research, so
  // nothing about eligibility or payment. The baseline is the gate to the daily
  // practice, which starts on a fixed date for everyone.
  intro: (t) => `Thank you for joining <strong>${t}</strong>.`,
  body: 'The link below opens the consent form. If you agree to take part, it continues straight into the baseline survey. After that, each day\'s practice arrives at this address at 7 am, from Saturday, October 17.',
  emphasis: 'The baseline takes 15 to 20 minutes.',
  after: 'Taking part is your choice, and so is stopping, at any time: the link at the bottom of any email stops them.',
  button: 'Read the consent form and begin →',
}

const stripTags = (h: string) => h.replace(/<[^>]+>/g, '')

export function renderOpenJoinEmail(vars: {
  study_title: string
  link_url: string
  expires_hours: number
  contact_email: string
  slug?: string | null
}): { subject: string; html: string; text: string } {
  const subject = `Your link to begin: ${vars.study_title}`
  const c = COPY_BY_SLUG[(vars.slug ?? '').toLowerCase()] ?? DEFAULT_COPY
  const intro = c.intro(vars.study_title)
  // Study-specific copy also gets a punctuation-aware footer. The default copy
  // keeps its original footer verbatim, so live studies' emails do not change.
  const footerTitle = c === DEFAULT_COPY || !/[.?!]$/.test(vars.study_title)
    ? `${vars.study_title}.` : vars.study_title

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
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">${intro}</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">${c.body}</p>
              <p style="margin:20px 0 0 0;font-size:17px;font-weight:700;color:#1c1c1e;line-height:1.5;">${c.emphasis}</p>
              <table cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;"><tr>
                <td style="background-color:#f068a4;border-radius:8px;">
                  <a href="${vars.link_url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">${c.button}</a>
                </td>
              </tr></table>${c.after ? `
              <p style="margin:20px 0 0 0;font-size:15px;color:#1c1c1e;line-height:1.6;">${c.after}</p>` : ''}
              <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">Or copy this link: <a href="${vars.link_url}" style="color:#f068a4;word-break:break-all;">${vars.link_url}</a></p>
              <p style="margin:24px 0 0 0;font-size:12px;color:#abadb0;border-top:1px solid #f5f5f5;padding-top:16px;">This link is personal to you and expires in ${vars.expires_hours} hours — please don't share it. Questions? Reply to this email or write to <a href="mailto:${vars.contact_email}" style="color:#f068a4;">${vars.contact_email}</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You are receiving this because this address was entered on the sign-up page for ${footerTitle} If that wasn't you, ignore this message; nothing further will be sent.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `${stripTags(intro)}

${c.body}

${c.emphasis.toUpperCase()}

${stripTags(c.button).replace(' →', '')}: ${vars.link_url}
${c.after ? `\n${c.after}\n` : ''}
This link is personal to you and expires in ${vars.expires_hours} hours. Questions? Reply to this email or write to ${vars.contact_email}.

If this wasn't you, ignore this message; nothing further will be sent.`

  return { subject, html, text }
}
