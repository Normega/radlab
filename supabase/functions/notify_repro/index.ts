// notify_repro — emails Norm when Rose writes on the reproducibility checklist
// (public/repro/check.html; migration 20261107_repro_checklist.sql), or ticks
// off one of its milestone steps.
//
// Called by the page itself: POST { board, token, kind: 'message' | 'step', ref }.
// The token is the page's own access token (from the passcode in Rose's link);
// repro_notify_claim() checks it, confirms the message or step exists, and
// claims the notification, so each message or step emails at most once and a
// board at most 30 times a day. verify_jwt = false in config.toml: the page has
// no user session.
//
// Everything on the checklist is encrypted in the browser, so the email cannot
// and does not carry what Rose wrote: only the step and the time.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const FROM = 'RADlab <research@mail.radlab.zone>'
const TO = 'norman@radlab.zone'

// Milestones the page asks to be told about (steps with notify: true)
const STEPS: Record<string, string> = {
  B7: 'started the overnight run (Part 2)',
  B8: 'checked the result of the overnight run (Part 2)',
  M5: 'finished the Part 3 run',
  F2: 'finished the checklist',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const body = await req.json().catch(() => ({}))
  const { board, token, kind, ref } = body ?? {}
  if (typeof board !== 'string' || typeof token !== 'string' || typeof ref !== 'string' ||
      (kind !== 'message' && kind !== 'step')) return json({ error: 'bad request' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: claim, error } = await db.rpc('repro_notify_claim',
    { p_board: board, p_token: token, p_kind: kind, p_ref: ref })
  if (error) { console.error('notify_repro: claim failed', error.message); return json({ ok: false }, 500) }
  if (!claim) return json({ ok: true, sent: false })   // wrong token, unknown ref, already sent or over the cap

  const who = claim.author === 'rose' ? 'Rose' : 'Norm'
  const when = new Date(claim.at).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' })
  const what = kind === 'message'
    ? `${who} wrote on step ${claim.item} of the reproducibility checklist`
    : `${who} ${STEPS[claim.item] ?? `finished step ${claim.item}`} on the reproducibility checklist`
  const text = `${what} (${when}, Toronto time).\n\nOpen your checklist link to read it and reply. `
    + 'The checklist is encrypted, so this email cannot include what was written.'

  const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
  const { data: sent, error: sendErr } = await resend.emails.send({
    from: FROM, to: [TO],
    // camelCase: the SDK drops reply_to (replyToField.test.mjs). There is no
    // one to answer by email; replies belong on the checklist.
    replyTo: 'research@radlab.zone',
    subject: `Checklist: ${what.replace(' of the reproducibility checklist', '').replace(' on the reproducibility checklist', '')}`, text,
  })
  if (sendErr) { console.error('notify_repro: Resend error', sendErr); return json({ ok: false }, 502) }
  return json({ ok: true, sent: true, id: sent?.id })
})
