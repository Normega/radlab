// "Pitch Us Something" on /lab/contact. POST { name, email, role, build_what,
// values_fit, portfolio_url, website }.
//
// Public and unauthenticated, so it is stingy: a filled honeypot (`website`,
// hidden from people) gets a silent 200 with nothing stored or sent; every
// field is re-validated here regardless of what the form checked; and one
// salted IP hash may submit RATE_LIMIT pitches per rolling 24 h.
//
// The row is the record; the email is a convenience. Once the insert
// succeeds the submitter gets 200 even if the email fails, so a mail outage
// never loses a pitch or asks someone to submit twice.
//
// The email is sent by the notify_pitch Edge Function, not from here: research
// mail goes out on the Supabase RESEND_API_KEY, and the Vercel key the other
// api/ functions use only sends as course.radlab.zone (pitch emails sent with
// it never arrived, 2026-10-04). See supabase/functions/notify_pitch.
//
// lab_pitches has no insert policy for anon/authenticated
// (20261003_lab_pitches.sql): this endpoint, holding the service key, is the
// only way in. Main radlab project, not radlab-academic.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const RATE_LIMIT = 3
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000

// notify_pitch keeps a copy of these labels for the email.
export const ROLES = { undergrad: 'Undergraduate', grad: 'Graduate student', postdoc: 'Postdoc', other: 'Other' }

const LIMITS = { name: 120, email: 254, build_what: 3000, values_fit: 3000, portfolio_url: 500 }
const MIN_ANSWER = 20

// Returns { ok: true, value } with trimmed fields, or { ok: false, error }.
// Exported for src/lib/pitchValidate.test.mjs.
export function validatePitch(body) {
  const b = body && typeof body === 'object' ? body : {}
  const v = {}
  for (const k of Object.keys(LIMITS)) v[k] = String(b[k] ?? '').trim()
  v.role = String(b.role ?? '').trim()

  if (!v.name) return { ok: false, error: 'Please enter your name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (!ROLES[v.role]) return { ok: false, error: 'Please choose a role.' }
  if (v.build_what.length < MIN_ANSWER) return { ok: false, error: 'Please say a little more about what you want to build.' }
  if (v.values_fit.length < MIN_ANSWER) return { ok: false, error: 'Please say a little more about how it connects to the lab.' }
  for (const [k, max] of Object.entries(LIMITS)) {
    if (v[k].length > max) return { ok: false, error: `One of your answers is too long (limit ${max} characters).` }
  }

  let url
  try { url = new URL(v.portfolio_url) } catch { url = null }
  if (!url || !/^https?:$/.test(url.protocol)) {
    return { ok: false, error: 'Please link to something you have made (a full http or https address).' }
  }
  v.portfolio_url = url.href
  if (v.portfolio_url.length > LIMITS.portfolio_url) return { ok: false, error: 'That link is too long.' }

  return { ok: true, value: v }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST only' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}

  // Honeypot: people never see this field. Answer exactly as a success would.
  if (String(body.website ?? '').trim()) return res.status(200).json({ ok: true })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey) {
    console.error('pitch: missing env', { url: !!url, serviceKey: !!serviceKey })
    return res.status(500).json({ error: 'The form is not available right now. Please email research@radlab.zone instead.' })
  }

  const check = validatePitch(body)
  if (!check.ok) return res.status(400).json({ error: check.error })
  const p = check.value

  // Salted for the reason roster-join.js gives: unsalted IPv4 hashes reverse.
  const ipSalt = process.env.ROSTER_IP_SALT ?? serviceKey
  const clientIp = String(
    req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? ''
  ).split(',')[0].trim()
  const ipHash = clientIp ? createHash('sha256').update(`${ipSalt}:${clientIp}`).digest('hex') : null

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (ipHash) {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const { count, error } = await service
      .from('lab_pitches')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since)
    // A failed count falls through to the insert, which will fail the same
    // way and report it; the limit is abuse control, not a correctness rule.
    if (!error && count >= RATE_LIMIT) {
      return res.status(429).json({
        error: `We have received ${RATE_LIMIT} pitches from your connection today. Please try again tomorrow, or email research@radlab.zone.`,
      })
    }
  }

  const { data: row, error: insertError } = await service
    .from('lab_pitches')
    .insert({ ...p, ip_hash: ipHash })
    .select('id')
    .single()
  if (insertError) {
    console.error('pitch: insert failed', insertError.message)
    return res.status(500).json({ error: 'Your pitch could not be saved. Please try again, or email research@radlab.zone.' })
  }

  // Email via the research path. Any failure is logged only: the pitch is saved.
  try {
    const { error: notifyError } = await service.functions.invoke('notify_pitch', { body: { pitch_id: row.id } })
    if (notifyError) {
      const detail = await notifyError.context?.text?.().catch(() => '')
      console.error('pitch: notify_pitch failed', row.id, notifyError.message, detail ?? '')
    }
  } catch (e) {
    console.error('pitch: notify_pitch threw', row.id, e?.message)
  }

  return res.status(200).json({ ok: true })
}
