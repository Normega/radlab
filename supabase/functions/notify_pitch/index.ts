// notify_pitch — emails research@radlab.zone about one row of lab_pitches
// (the "Pitch Us Something" form on /lab/contact; website.md §12).
//
// Called by api/pitch.js after its insert succeeds: POST { pitch_id }.
//
// Why an Edge Function and not a send from api/pitch.js itself: research mail
// already goes out from here — send_message, check_schedule, buddy_send — on
// the Supabase RESEND_API_KEY, which is proven to send as
// research@mail.radlab.zone. The Vercel RESEND_API_KEY that api/ functions use
// only ever sends as course.radlab.zone, and pitch emails sent with it never
// arrived (verified 2026-10-04). So the pitch mail rides the research path.
//
// Auth: the caller's own credential must be able to read the pitch row.
// lab_pitches has no anon grant and RLS limits reads to lab members, so in
// practice that means a secret (service-level) key. Checking it this way
// rather than comparing against SUPABASE_SERVICE_ROLE_KEY means it does not
// matter which of the project's secret keys the Vercel side holds.
// verify_jwt = false in config.toml: an sb_secret_ key is not a JWT.
//
// It only emails what is already stored; the request carries an id, never
// content, so it cannot be used to send arbitrary mail.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

// On the UofT UTmail+ allowlist, same address as all research mail.
const FROM = 'RADlab <research@mail.radlab.zone>'
const TO = 'research@radlab.zone'

// Mirrors ROLES in api/pitch.js, which validates against it.
const ROLES: Record<string, string> = {
  undergrad: 'Undergraduate', grad: 'Graduate student', postdoc: 'Postdoc', other: 'Other',
}

type Pitch = {
  id: string; name: string; email: string; role: string
  build_what: string; values_fit: string; portfolio_url: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const esc = (s: string) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function emailBody(p: Pitch) {
  const rows: [string, string][] = [
    ['Name', p.name],
    ['Email', p.email],
    ['Role', ROLES[p.role] ?? p.role],
    ['What do you want to build, and for whom?', p.build_what],
    ['How does it connect to breath, body awareness, or the lab\'s values?', p.values_fit],
    ['Something they made', p.portfolio_url],
  ]
  const text = rows.map(([k, val]) => `${k}\n${val}`).join('\n\n')
    + '\n\nReply to this email to answer the applicant directly.'
  const html = rows.map(([k, val]) =>
    `<p style="margin:0 0 4px;font-weight:600">${esc(k)}</p>`
    + `<p style="margin:0 0 16px;white-space:pre-wrap">${esc(val)}</p>`).join('')
    + '<p style="color:#6b6c70;font-size:14px">Reply to this email to answer the applicant directly.</p>'
  return { text, html }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const key = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!key) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const pitchId = typeof body?.pitch_id === 'string' ? body.pitch_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(pitchId)) return json({ error: 'pitch_id required' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: p, error } = await db
    .from('lab_pitches')
    .select('id, name, email, role, build_what, values_fit, portfolio_url')
    .eq('id', pitchId)
    .maybeSingle()
  // A key that cannot read the row gets the same answer as a missing row.
  if (error || !p) return json({ error: 'Not found' }, 404)

  const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
  const { text, html } = emailBody(p as Pitch)
  const { data: sent, error: sendErr } = await resend.emails.send({
    from: FROM,
    to: [TO],
    // camelCase: the SDK maps replyTo -> reply_to and silently drops unknown
    // keys (replyToField.test.mjs). Reply goes straight to the applicant.
    replyTo: p.email,
    subject: `Lab pitch: ${p.name} (${ROLES[p.role] ?? p.role})`,
    text,
    html,
  })
  if (sendErr) {
    console.error('notify_pitch: Resend error', pitchId, sendErr)
    return json({ ok: false, error: sendErr.message }, 502)
  }
  return json({ ok: true, id: sent?.id })
})
