// Accountability Buddy daily email (spec §6). Same visual shell as the
// platform's study email (_shared/emailTemplate.ts): pink page, white card,
// inline styles only (Gmail strips <style>).
//
// Deliberately NO Yes/No links: UofT Safe Links opens every URL in the email,
// so any link that records an answer would record one on delivery. The only
// link is the check-in page, which writes nothing until a button is pressed.

import { formatDate, formatMeeting, type Milestone } from './logic.ts'

export type BuddyEmailVars = {
  firstName: string
  current: Milestone | null
  completed: Milestone[]          // ticked off since the previous send
  linkUrl: string
  meetingAt: string | null        // only passed when in the future
  zoomUrl: string | null
  quote: { quote: string; source: string | null; tag: string | null } | null
  isTest?: boolean
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const P = 'margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;'

export function renderBuddyEmail(v: BuddyEmailVars): { subject: string; html: string; text: string } {
  let subject = v.current ? `Today's check-in: ${v.current.title}` : "Today's check-in"
  if (v.isTest) subject = `[TEST] ${subject}`

  const html: string[] = []
  const text: string[] = []

  if (v.isTest) {
    html.push(`<p style="${P}color:#c04a82;">Test send. The link below is not live and opens a "link not found" page.</p>`)
    text.push('Test send. The link below is not live and opens a "link not found" page.')
  }

  if (v.completed.length > 0) {
    const titles = v.completed.map(m => m.title)
    const label = titles.length > 1 ? 'Milestones complete' : 'Milestone complete'
    const next = v.current ? `Next up: ${v.current.title}.` : 'That was the last one.'
    html.push(`<p style="${P}">${label}: ${titles.map(t => `<strong>${esc(t)}</strong>`).join(', ')}. ${esc(next)}</p>`)
    text.push(`${label}: ${titles.join(', ')}. ${next}`)
  }

  html.push(`<p style="${P}">Morning, ${esc(v.firstName)},</p>`)
  text.push(`Morning, ${v.firstName},`)

  if (v.current) {
    const target = v.current.target_date ? ` (target ${formatDate(v.current.target_date)})` : ''
    html.push(`<p style="${P}">Current milestone: <strong>${esc(v.current.title)}</strong>${esc(target)}</p>`)
    text.push(`Current milestone: ${v.current.title}${target}`)
  }

  html.push(`<p style="${P}">Take two minutes to check in and set one goal for today.</p>`)
  text.push('Take two minutes to check in and set one goal for today.')
  text.push(`Check in: ${v.linkUrl}`)

  // Quote of the day: always BELOW the button, never above it.
  let quoteHtml = ''
  if (v.quote) {
    const src = v.quote.source ? ` (${v.quote.source})` : ''
    const tag = v.quote.tag ? ` ${v.quote.tag}` : ''
    quoteHtml = `<p style="margin:20px 0 0 0;font-size:12px;color:#6b6c70;line-height:1.5;font-style:italic;">`
      + `<em>${esc(v.quote.quote)}</em>${esc(src)}.${esc(tag)}</p>`
    text.push(`${v.quote.quote}${src}.${tag}`)
  }

  let meetingHtml = ''
  if (v.meetingAt) {
    const when = formatMeeting(v.meetingAt)
    const zoom = v.zoomUrl ? ` <a href="${esc(v.zoomUrl)}" style="color:#f068a4;">Join Zoom</a>` : ''
    meetingHtml = `<p style="margin:24px 0 0 0;font-size:14px;color:#1c1c1e;border-top:1px solid #f5f5f5;padding-top:16px;">`
      + `Next meeting with Norm: ${esc(when)}.${zoom}</p>`
    text.push(`Next meeting with Norm: ${when}.${v.zoomUrl ? ` Join Zoom: ${v.zoomUrl}` : ''}`)
  }

  text.push('Accountability Buddy, RADlab. Reply to this email to reach Norm.')

  const page = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Accountability Buddy</title>
</head>
<body style="margin:0;padding:0;background-color:#FCF0F5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FCF0F5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 0 24px 0;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1c1c1e;font-weight:normal;">Accountability Buddy</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#abadb0;font-family:Arial,Helvetica,sans-serif;">RADlab · University of Toronto Mississauga</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
              ${html.join('\n              ')}
              <table cellpadding="0" cellspacing="0" style="margin:24px 0 0 0;"><tr>
                <td style="background-color:#f068a4;border-radius:8px;">
                  <a href="${esc(v.linkUrl)}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">Check in</a>
                </td>
              </tr></table>
              ${quoteHtml}
              ${meetingHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">Accountability Buddy, RADlab. Reply to this email to reach Norm.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html: page, text: text.join('\n\n') }
}
