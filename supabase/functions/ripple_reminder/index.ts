// ripple_reminder — sends Ripple check-in reminder emails.
// Called by an hourly pg_cron job via net.http_post with the service-role key.
//
// Active send windows (America/Toronto):
//   morning = 8 AM, midday = 12 PM, evening = 7 PM
//
// prompt_cadence is now an EMAIL-only cadence (2026-08-13 Account/My Ripple
// redesign — the on-platform check-in nudge is unconditional and no longer
// reads this column at all). "Every other day/week" reuse this same hourly
// job rather than needing dedicated cron infrastructure, the same way
// "weekly" always has: it's just a wider day-count threshold below, evaluated
// every send window like every other cadence.
//
// Eligible recipients: ripples rows where
//   reminder_enabled = true
//   prompt_cadence != 'never'
//   reminder_time matches the current window
//   last_reminder_sent_on != today (dedup: one send per calendar day max)
//   hasn't checked in per cadence:
//     every_login / daily → last_checkin_on < today
//     every_other_day → last_checkin_on < 2 days ago (or null)
//     weekly → last_checkin_on < 7 days ago (or null)
//     every_other_week → last_checkin_on < 14 days ago (or null)

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { getOrCreateRippleUnsubscribeToken } from '../_shared/rippleUnsubscribeToken.ts'
import { RESEARCH_REPLY_TO } from '../_shared/replyTo.ts'

const TZ = 'America/Toronto'
const WINDOW_HOURS: Record<string, number> = { morning: 8, midday: 12, evening: 19 }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function torontoDateStr(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function torontoHour(now: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hour: '2-digit',
      hour12: false,
    }).format(now),
    10,
  )
}

function daysBetween(earlier: string, later: string): number {
  return Math.round((new Date(later).getTime() - new Date(earlier).getTime()) / 86400000)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader  = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const db: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Two callers, mirroring send_message: the cron job presents the service key;
  // a lab member presents their own JWT, which is only useful for a test send.
  // Verified with the service client — deliberately NOT SUPABASE_ANON_KEY, which
  // is deprecated in favour of publishable keys and whose legacy value was
  // revoked 2026-07-30.
  let callerUserId: string | null = null
  if (authHeader !== `Bearer ${serviceKey}`) {
    const callerToken = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authErr } = await db.auth.getUser(callerToken)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'lab') return json({ error: 'Forbidden — lab role required' }, 403)
    callerUserId = user.id
  }

  try {
    const now   = new Date()
    const today = torontoDateStr(now)

    const siteUrl   = Deno.env.get('SITE_URL') ?? 'https://radlab.zone'
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'research@radlab.zone'
    const resend    = new Resend(Deno.env.get('RESEND_API_KEY'))

    const body       = await req.json().catch(() => ({}))
    const testEmail  = typeof body?.test_override_email === 'string' ? body.test_override_email.trim() : null
    const testUserId = typeof body?.test_as_user_id     === 'string' ? body.test_as_user_id            : null

    // ── Test send ────────────────────────────────────────────────────────────
    // Exists because this email class shipped 2026-07-14 and was never seen by
    // anyone until 2026-07-30: the cron job 401-ed for 15 days, and the only way
    // to observe the email was to be a due recipient in one of three hourly
    // windows. A test send bypasses the window, the cadence/staleness filter and
    // the once-per-day dedup, and deliberately does NOT stamp
    // last_reminder_sent_on — so testing can never suppress somebody's real
    // reminder later that day.
    //
    // The content is byte-identical to the real thing, including a REAL
    // unsubscribe token, which is the part most worth eyeballing. That token
    // must belong to an actual account, hence test_as_user_id when there's no
    // caller identity to borrow.
    if (testEmail) {
      const tokenUserId = testUserId ?? callerUserId
      if (!tokenUserId) {
        return json({
          error: 'test_override_email needs test_as_user_id when called with the service key — ' +
                 'the unsubscribe link has to belong to a real account',
        }, 400)
      }

      const result = await deliverRippleEmail({ db, resend, fromEmail, siteUrl, to: testEmail, userId: tokenUserId })
      if (!result.ok) {
        console.error('ripple_reminder test send failed:', result.error)
        return json({ test: true, sent: 0, failed: 1, error: result.error }, 502)
      }

      console.log(`ripple_reminder TEST send to ${testEmail} (unsubscribe token for ${tokenUserId})`)
      return json({
        test: true,
        sent: 1,
        to: testEmail,
        unsubscribe_token_for: tokenUserId,
        note: 'window, cadence and dedup bypassed; last_reminder_sent_on NOT written',
      })
    }

    const hour = torontoHour(now)

    // Only run during the three send windows
    const activeWindow = Object.entries(WINDOW_HOURS).find(([, h]) => h === hour)?.[0] ?? null
    if (!activeWindow) {
      return json({ sent: 0, skipped: 0, reason: `no_window_at_hour_${hour}` })
    }

    // Fetch window-matched candidates. check_in_enabled is no longer filtered
    // on (2026-08-13): the app can't set it false anymore, so it's always true.
    const { data: candidates, error: fetchErr } = await db
      .from('ripples')
      .select('user_id, prompt_cadence, last_checkin_on, last_reminder_sent_on')
      .eq('reminder_enabled', true)
      .eq('reminder_time', activeWindow)
      .neq('prompt_cadence', 'never')

    if (fetchErr) {
      console.error('Failed to fetch candidates:', fetchErr.message)
      return json({ error: fetchErr.message }, 500)
    }

    // Filter: dedup guard + cadence check
    const eligible = (candidates ?? []).filter(r => {
      if (r.last_reminder_sent_on === today) return false
      if (!r.last_checkin_on) return true

      const days = daysBetween(r.last_checkin_on, today)
      if (r.prompt_cadence === 'every_login' || r.prompt_cadence === 'daily') return days >= 1
      if (r.prompt_cadence === 'every_other_day')  return days >= 2
      if (r.prompt_cadence === 'weekly')           return days >= 7
      if (r.prompt_cadence === 'every_other_week') return days >= 14
      return false
    })

    if (eligible.length === 0) {
      return json({ sent: 0, skipped: (candidates ?? []).length, window: activeWindow })
    }

    let sent = 0, failed = 0

    for (const row of eligible) {
      try {
        const { data: { user: authUser } } = await db.auth.admin.getUserById(row.user_id)
        const email = authUser?.email ?? null
        if (!email) {
          console.warn(`No email for user ${row.user_id}`)
          failed++
          continue
        }

        const result = await deliverRippleEmail({ db, resend, fromEmail, siteUrl, to: email, userId: row.user_id })
        if (!result.ok) {
          console.error(`Resend error for user ${row.user_id}:`, result.error)
          failed++
          continue
        }

        // Mark sent today to prevent duplicate sends. Only the real path does
        // this — a test send must never suppress somebody's actual reminder.
        await db.from('ripples')
          .update({ last_reminder_sent_on: today })
          .eq('user_id', row.user_id)

        sent++
      } catch (userErr) {
        console.error(`Error processing user ${row.user_id}:`, userErr)
        failed++
      }
    }

    return json({ sent, failed, skipped: (candidates ?? []).length - eligible.length, window: activeWindow })

  } catch (err) {
    console.error('ripple_reminder unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})

// ─── Delivery ─────────────────────────────────────────────────────────────────
// The single place a Ripple reminder is rendered and sent, used by both the cron
// path and the test send. Sharing it is the point: a test that renders its own
// email would drift from the real one and stop being evidence.
//
// Never writes last_reminder_sent_on — that stays with the caller, so only the
// real path marks a user as reminded today.
async function deliverRippleEmail(opts: {
  db: SupabaseClient
  resend: Resend
  fromEmail: string
  siteUrl: string
  to: string
  userId: string
}): Promise<{ ok: boolean; error?: string }> {
  const { db, resend, fromEmail, siteUrl, to, userId } = opts

  const checkinUrl = `${siteUrl}/checkin`

  const unsubToken     = await getOrCreateRippleUnsubscribeToken(db, userId)
  const unsubscribeUrl = `${siteUrl}/unsubscribe/${unsubToken}`

  // Ripple avatar raster (2026-08-22): the client uploads a PNG of the user's
  // avatar to the public avatar-png bucket on every avatar save (plus a one-time
  // backfill). HEAD-checked per recipient so a missing file renders the email
  // without the avatar column rather than as a broken image.
  let avatarUrl: string | null = null
  try {
    const { data: pub } = db.storage.from('avatar-png').getPublicUrl(`${userId}.png`)
    const head = await fetch(pub.publicUrl, { method: 'HEAD' })
    if (head.ok) avatarUrl = pub.publicUrl
  } catch (_) { /* no avatar column, never a blocked send */ }

  const { subject, html, text } = renderRippleEmail({ checkinUrl, unsubscribeUrl, avatarUrl })

  const { error: sendErr } = await resend.emails.send({
    from: fromEmail, reply_to: RESEARCH_REPLY_TO, to, subject, html, text,
  })
  if (sendErr) {
    return { ok: false, error: sendErr.message ?? String(sendErr) }
  }
  return { ok: true }
}

// ─── Email template ───────────────────────────────────────────────────────────

function renderRippleEmail(vars: {
  checkinUrl: string
  unsubscribeUrl: string
  avatarUrl?: string | null
}): { subject: string; html: string; text: string } {
  const subject = 'Your Ripple check-in — how are you arriving today?'

  const text =
`Hi!

Just a gentle nudge — how are you arriving today?

Your Ripple is ready when you are.

Check in now: ${vars.checkinUrl}

—
You're receiving this because you opted in to Ripple check-in reminders.
To unsubscribe: ${vars.unsubscribeUrl}

Regulatory and Affective Dynamics Lab · University of Toronto Mississauga`

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
              <p style="margin:4px 0 0 0;font-size:12px;color:#abadb0;font-family:Arial,Helvetica,sans-serif;">Regulatory and Affective Dynamics Lab · University of Toronto Mississauga</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

              <table cellpadding="0" cellspacing="0" width="100%"><tr>${vars.avatarUrl ? `
                <td width="116" valign="top" style="padding:0 20px 0 0;">
                  <img src="${vars.avatarUrl}" width="96" height="96" alt="Your Ripple" style="display:block;width:96px;height:96px;border-radius:16px;" />
                </td>` : ''}
                <td valign="top">
                  <p style="margin:0 0 8px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Hi!</p>
                  <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Just a gentle nudge — how are you arriving today?</p>
                  <p style="margin:0 0 32px 0;font-size:15px;color:#555;line-height:1.6;">Your Ripple is ready when you are.</p>
                </td>
              </tr></table>

              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background-color:#f068a4;border-radius:8px;">
                  <a href="${vars.checkinUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">Check in now →</a>
                </td>
              </tr></table>

              <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">Or copy this link: <a href="${vars.checkinUrl}" style="color:#f068a4;word-break:break-all;">${vars.checkinUrl}</a></p>

            </td>
          </tr>

          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You're receiving this because you opted in to Ripple check-in reminders.</p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#abadb0;"><a href="${vars.unsubscribeUrl}" style="color:#abadb0;">Unsubscribe from Ripple reminders</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html, text }
}
