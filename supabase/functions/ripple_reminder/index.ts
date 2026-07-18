// ripple_reminder — sends Ripple check-in reminder emails.
// Called by an hourly pg_cron job via net.http_post with the service-role key.
//
// Active send windows (America/Toronto):
//   morning = 8 AM, midday = 12 PM, evening = 7 PM
//
// Eligible recipients: ripples rows where
//   reminder_enabled = true AND check_in_enabled = true
//   prompt_cadence != 'never'
//   reminder_time matches the current window
//   last_reminder_sent_on != today (dedup: one send per calendar day max)
//   hasn't checked in per cadence:
//     every_login / daily → last_checkin_on < today
//     weekly → last_checkin_on < 7 days ago (or null)

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { getOrCreateRippleUnsubscribeToken } from '../_shared/rippleUnsubscribeToken.ts'

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

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const now   = new Date()
    const hour  = torontoHour(now)
    const today = torontoDateStr(now)

    // Only run during the three send windows
    const activeWindow = Object.entries(WINDOW_HOURS).find(([, h]) => h === hour)?.[0] ?? null
    if (!activeWindow) {
      return json({ sent: 0, skipped: 0, reason: `no_window_at_hour_${hour}` })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const siteUrl     = Deno.env.get('SITE_URL') ?? 'https://radlab.vercel.app'
    const fromEmail   = Deno.env.get('FROM_EMAIL') ?? 'research@radlab.vercel.app'

    const db: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Fetch window-matched candidates
    const { data: candidates, error: fetchErr } = await db
      .from('ripples')
      .select('user_id, prompt_cadence, last_checkin_on, last_reminder_sent_on')
      .eq('reminder_enabled', true)
      .eq('check_in_enabled', true)
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
      if (r.prompt_cadence === 'weekly') return days >= 7
      return false
    })

    if (eligible.length === 0) {
      return json({ sent: 0, skipped: (candidates ?? []).length, window: activeWindow })
    }

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
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

        const checkinUrl = `${siteUrl}/checkin`

        const unsubToken     = await getOrCreateRippleUnsubscribeToken(db, row.user_id)
        const unsubscribeUrl = `${siteUrl}/unsubscribe/${unsubToken}`

        const { subject, html, text } = renderRippleEmail({ checkinUrl, unsubscribeUrl })

        const { error: sendErr } = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject,
          html,
          text,
        })

        if (sendErr) {
          console.error(`Resend error for user ${row.user_id}:`, sendErr)
          failed++
          continue
        }

        // Mark sent today to prevent duplicate sends
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

// ─── Email template ───────────────────────────────────────────────────────────

function renderRippleEmail(vars: {
  checkinUrl: string
  unsubscribeUrl: string
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

              <p style="margin:0 0 8px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Hi!</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">Just a gentle nudge — how are you arriving today?</p>
              <p style="margin:0 0 32px 0;font-size:15px;color:#555;line-height:1.6;">Your Ripple is ready when you are.</p>

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
