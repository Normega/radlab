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
  is_reminder?: boolean
  after_missed?: boolean
  // Four or more consecutive missed sessions (see send_message's
  // MAX_ACK_STREAK). Mutually exclusive with after_missed — send_message sets
  // one or the other, never both. Selects the get-back-on-track lead-in and
  // the formal-withdrawal offer instead of the warm single-miss ack.
  lapsed?: boolean
  // Self-serve withdrawal link (/withdraw/{token}); only provided on lapsed
  // sends. The page it opens requires an explicit confirmation click, so this
  // link itself is safe against inbox link-scanner prefetch.
  withdraw_url?: string | null
  // The deadline-anchored last-chance reminder on a critical session (see
  // criticalSession.ts). Its value names which consequence is true, so the
  // copy can only ever state one the code will actually apply.
  final_notice?: 'gate' | 'terminal' | 'window' | null
  // final_notice only — the session's own label ("Midpoint Assessment"), same
  // source the missed_assessment termination email names it by.
  session_label?: string | null
  // Response rate so far, shown on reminders and missed-session emails (see
  // send_message's checkInProgress). Null when there isn't enough history to be
  // worth showing. Descriptive only — it never states a pass threshold, so it
  // stays true for studies with and without an adherence_check. Also selects
  // which missed-session lead-in is used (see LOW_RATE_PCT).
  progress?: { completed: number; total: number; pct: number } | null
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
  // Reminder resends prefix the subject so it's distinguishable in the inbox
  // from the original send (whose copy it otherwise reuses verbatim). The final
  // notice takes a stronger prefix than an ordinary reminder — by the time it
  // sends, "Reminder:" has already been used on this same session at least once
  // and no longer distinguishes anything.
  if (vars.final_notice) subject = `Last chance: ${subject}`
  else if (vars.is_reminder) subject = `Reminder: ${subject}`
  if (vars.is_test) subject = `[TEST] ${subject}`

  // Body text (resolved). Two optional lead-ins, both prepended so the original
  // (or per-study custom) body follows unchanged beneath — link, expiry notice,
  // and custom copy all preserved:
  //   is_reminder   — this is a follow-up nudge, not a first-time invitation.
  //   after_missed  — the participant's previous session window closed unused.
  // A reminder wins when both are true: it's a resend of the very email the
  // missed-session line already introduced, so running both would apologize for
  // a miss and then nudge about the same message in one breath.
  const resolvedBody = resolve(vars.custom_body ?? DEFAULT_BODY)

  // The missed-session lead-in stops claiming the miss was "occasional" once
  // the response rate says otherwise — see MISSED_INTRO_LOW_RATE.
  const missedIntro = vars.progress && vars.progress.pct < LOW_RATE_PCT
    ? MISSED_INTRO_LOW_RATE
    : MISSED_INTRO
  const intro = vars.final_notice
    ? finalNoticeIntro(vars.final_notice, vars.session_label, vars.expires_hours)
    : vars.is_reminder ? REMINDER_INTRO
    : vars.lapsed ? LAPSED_INTRO
    : vars.after_missed ? missedIntro : null

  // Response rate — on reminders and on missed-session emails, i.e. only where
  // the participant has actually lapsed and we're already writing about it.
  // Deliberately NOT on plain first sends: there the number changes nothing
  // (they're about to do the session anyway) and reads as a running score.
  // Sits between the lead-in and the body so it's context for the nudge rather
  // than a verdict tacked onto the end.
  //
  // Suppressed on the final notice: that email is about one deadline and one
  // action, and a completion percentage beside a "this is your last chance"
  // paragraph reads as a verdict on the participant rather than context.
  const progressLine = !vars.final_notice && (vars.is_reminder || vars.after_missed || vars.lapsed) && vars.progress
    ? progressSentence(vars.progress)
    : null

  const bodyText = [intro, progressLine, resolvedBody].filter(Boolean).join('\n\n')

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

  // Withdrawal offer — the "link at the bottom of this email" LAPSED_INTRO
  // points at. Inside the card rather than the footer: it's an offer the
  // lead-in makes, not boilerplate — but quieter than body copy, because the
  // hoped-for outcome is still the session button above it.
  const withdrawHtml = vars.withdraw_url
    ? `<p style="margin:16px 0 0 0;font-size:12px;color:#6b6e73;">If you'd prefer to formally withdraw from the study, <a href="${vars.withdraw_url}" style="color:#f068a4;">you can do that here</a> — you'll be asked to confirm before anything changes.</p>`
    : ''

  // Build full HTML email
  const html = HTML_WRAPPER
    .replace('{{email_body_html}}', bodyHtml)
    .replace(/\{\{link_url\}\}/g, vars.link_url)
    .replace(/\{\{expires_hours\}\}/g, String(vars.expires_hours))
    .replace('{{withdraw_html}}', withdrawHtml)
    .replace('{{unsubscribe_footer_html}}', unsubscribeHtml)

  // Plain-text fallback (Resend sends both)
  const withdrawText = vars.withdraw_url
    ? `\n\nTo formally withdraw from the study (you'll be asked to confirm): ${vars.withdraw_url}`
    : ''
  const unsubscribeText = vars.unsubscribe_url
    ? `\n\nTo unsubscribe from study emails: ${vars.unsubscribe_url}`
    : ''
  const text = `${bodyText}\n\nBegin session: ${vars.link_url}${withdrawText}${unsubscribeText}`

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
  variant?: 'adherence' | 'missed_assessment'
  gate_label?: string // missed_assessment: the assessment's label, e.g. "Midpoint Assessment"
  // adherence: the threshold that was actually enforced, from the study's
  // adherence_check graph node. These were hardcoded as "at least 10 of 12"
  // until 2026-07-27 — the Liliana studies happen to use 10/12, so the prose
  // was accidentally right there and would have been wrong for any study that
  // set a different min_required. The one email whose job is to state the rule
  // must state the rule that was applied, so these are now passed in.
  min_required?: number | null
  of_total?: number | null
}): { subject: string; html: string; text: string } {
  // Omit the parenthetical entirely rather than assert a threshold we weren't
  // given — a wrong number here is worse than no number.
  const threshold = vars.min_required == null
    ? ''
    : vars.of_total == null
      ? ` (we noted that at least ${vars.min_required} sessions are needed)`
      : ` (we noted that at least ${vars.min_required} of ${vars.of_total} sessions are needed)`

  const middle = vars.variant === 'missed_assessment'
    ? `Unfortunately, you didn't complete the ${vars.gate_label ?? 'scheduled assessment'} within its scheduled window, we will award credit for the time you spent, but your participation in the study is now complete.`
    : `Unfortunately, you didn't complete the minimum required sessions for this phase of the study${threshold}, we will award credit for the time you spent, but your participation in the study is now complete.`

  const bodyText = `Hi ${vars.first_name},

${middle}

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

// ─── Reminder lead-in ─────────────────────────────────────────────────────────
// Prepended to the body on a reminder resend (see renderEmail). Kept generic so
// it flows regardless of how the original/custom body opens, and so it never
// contradicts the per-study copy that follows.

const REMINDER_INTRO = `Just a friendly reminder — it looks like you haven't completed this session yet, and your personal link is still active, so there's still time. The original details are below.`

// ─── Final-notice lead-in ─────────────────────────────────────────────────────
// The last-chance reminder on a critical session, fired 12 h before the link
// closes rather than on the reminder cadence (see criticalSession.ts and
// check_schedule's reminder pass). Replaces REMINDER_INTRO when set.
//
// This is the one participant email that is deliberately urgent, and the only
// one allowed to name a consequence — so the consequence has to be the one the
// code will actually apply. The kind is derived from the session's position in
// the design graph by the same predicate that performs the withdrawal, which is
// what keeps these three strings honest:
//
//   'gate'     — materializeSchedule withdraws on a missed fork gate, so this
//                may say participation ends. The credit clause matches what
//                renderTerminationEmail above actually promises.
//   'terminal' — nobody is withdrawn; the study just finishes without the
//                final answers. It must NOT borrow the gate's language.
//   'window'   — an authored override on a session whose position tells us
//                nothing. Urgency about the deadline, no claim about after.
//
// Urgent, not punitive: the deadline is stated plainly and the participant is
// never blamed for being late to it. Same principle as MISSED_INTRO — a
// reproach is what tips a wavering participant into dropping out entirely.

function finalNoticeIntro(
  kind: 'gate' | 'terminal' | 'window',
  sessionLabel: string | null | undefined,
  hoursLeft: number,
): string {
  // "your Midpoint Assessment" when the graph names it, "this session" when it
  // doesn't — never a guessed name.
  const what = sessionLabel ? `your ${sessionLabel}` : 'this session'
  const when = `about ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`

  if (kind === 'gate') {
    return `This is the final reminder for ${what}, and it's the one session in the study you can't skip. Your link closes in ${when}. Everything in the rest of the study is built on your answers here, so if this window closes without it, your participation ends at this point — you'd still receive credit for the sessions you've already completed, but there would be no further ones. There's still time, and the original details are below.`
  }
  if (kind === 'terminal') {
    return `This is the final reminder for ${what} — the last session of the study. Your link closes in ${when}, and it can't be reopened once it does. If the window closes without it, the study finishes without your final answers. You'd still receive credit for everything you've completed. There's still time, and the original details are below.`
  }
  return `This is the final reminder for ${what}. Your link closes in ${when}, and it can't be reopened once it does. There's still time, and the original details are below.`
}

// ─── Missed-session lead-in ───────────────────────────────────────────────────
// Prepended when the participant's previous session window closed unused (see
// send_message). Deliberately carried on the next session's email rather than
// sent as a message of its own: it reaches them at the moment they can act on
// it, and adds no extra email to someone who is already not opening them.
// Non-punitive by design — a miss that reads as failure invites the shame →
// avoidance → further-misses spiral this is meant to interrupt. Worded to hold
// up whether they missed one session or a few.
//
// It must NOT promise that missing has no consequence. It originally read
// "doesn't affect your standing in the study", which is false: adherence
// withdrawal ends participation below the required session count (see
// processAdherenceWithdrawal and renderTerminationEmail's "at least 10 of 12"
// copy). Reassure about the OCCASIONAL miss — the true and still-kind claim.

const MISSED_INTRO = `We noticed your last session's window closed before you got to it — that's completely okay. Missing the occasional session is normal, and there's nothing to make up. Just do your best to catch the ones you can — here's the next one.`

// Below this response rate, misses are the majority, so calling them
// "occasional" is no longer true — MISSED_INTRO and the response-rate line
// would contradict each other in the same paragraph. 50% is the principled cut:
// "occasional" is defensible exactly while completions outnumber misses.
const LOW_RATE_PCT = 50

// Same job as MISSED_INTRO, for participants whose rate has dropped below
// LOW_RATE_PCT. Acknowledges the reality rather than insisting it's normal,
// without scolding, without threatening withdrawal, and without naming a
// threshold (still blocked — see progressSentence). The one thing it must never
// become is a warning: someone at this rate is the most likely to disengage
// entirely, and a reproach is what tips them over.
const MISSED_INTRO_LOW_RATE = `We noticed your last session's window closed before you got to it. We know it hasn't been easy to keep up lately — there's still nothing to make up, and every check-in you do adds something. Here's the next one whenever you're ready.`

// ─── Lapsed lead-in ──────────────────────────────────────────────────────────
// The third tier: at MAX_ACK_STREAK (4+) consecutive misses the warm ack above
// stops being credible, and before this existed the email just went generic —
// which read as the system not noticing at all. This one names the streak
// plainly and offers a real choice: get back on track (the button below), or
// formally withdraw (the link withdrawHtml renders at the bottom of the card).
//
// Deliberately NOT an ultimatum: no deadline, no consequence, and the emails
// keep coming if they do nothing. It's a reality check with a well-intentioned
// participant about whether the study still fits — an honest exit offered
// kindly beats a slow fade of ignored emails, for them and for the data.
const LAPSED_INTRO = `We noticed you've missed a few check-ins in a row — that's okay, and there's nothing to make up. Now is a great time to get back on track, and your next check-in is below. On the other hand, if the study no longer fits your circumstances, you're welcome to formally withdraw using the link at the bottom of this email. Either way, we're glad to have you for whatever part of the study you can do.`

// ─── Response-rate line ───────────────────────────────────────────────────────
// Deliberately DESCRIPTIVE, not normative: it reports what the participant has
// done and never names a pass threshold, so the same sentence is true for a
// study with an adherence_check and one without. Stating the threshold is a
// separate decision (docs/markdowns/adherence_copy_linkage_scope.md, Q3) and
// needs the resolved-rule linkage that doesn't exist yet — do not fold one in
// here without it, or this becomes the per-study-claim problem all over again.
//
// The denominator excludes the check-in this email is nudging about: its window
// is still open, so counting it would score the participant down for something
// they still have time to do.

function progressSentence(p: { completed: number; total: number; pct: number }): string {
  return `So far, you've responded to ${p.completed} out of ${p.total} check-ins (${p.pct}%).`
}

// ─── Default body ─────────────────────────────────────────────────────────────

const DEFAULT_BODY = `Hi!

Your session for Study Day {{study_day}} is ready.

Click the button below to begin. This link is personal to you — please don't share it.

This link will expire in {{expires_hours}} hours.

Thanks for participating,
The RADlab Team
University of Toronto Mississauga`

// ─── HTML wrapper ─────────────────────────────────────────────────────────────
// Table-based layout for email client compatibility.
// Placeholders replaced at render time:
//   {{email_body_html}}, {{link_url}}, {{expires_hours}}, {{withdraw_html}},
//   {{unsubscribe_footer_html}}

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

              {{withdraw_html}}

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
