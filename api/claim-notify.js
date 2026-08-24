// Tell a student what happened to their submission. POST { claim_id } with a
// staff bearer token; called by SubmissionsQueue right after the decision
// lands in gap_claims.
//
// Transactional only: exactly one message per decision the student's own
// submission triggered. No reminders, no digests, no nags — the course's
// standing rule on student email is to ride existing touchpoints rather than
// invent new classes of mail, and a reply to something they did is the one
// case that clearly qualifies.
//
// The decision is NOT made here. Status is written by the queue through RLS,
// which keeps the permission check in the database; this endpoint only reports
// what already happened. If the mail fails, the decision still stands and the
// queue surfaces the failure — the reverse (mail sent, status unwritten) would
// be worse.

import { createClient } from '@supabase/supabase-js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

function compose({ name, status, note, pageTitle, ask, origin, difficulty }) {
  const board = `${origin}/academic/fieldguide/gaps`
  const first = String(name).split(' ')[0]

  if (status === 'accepted') {
    return {
      subject: `Your Field Guide contribution was accepted — ${pageTitle}`,
      text:
`Hi ${first},

Your submission for ${pageTitle} has been accepted. It counts toward your three required article contributions.

The gap you filled: ${ask}

You can see it, and everything else the class has added, at ${origin}/academic/fieldguide/whats-new

— PSY240 course team`,
      html:
`<p>Hi ${esc(first)},</p>
<p>Your submission for <b>${esc(pageTitle)}</b> has been <b>accepted</b>. It counts toward your three required article contributions.</p>
<p style="color:#555"><i>The gap you filled:</i> ${esc(ask)}</p>
<p><a href="${esc(origin)}/academic/fieldguide/whats-new" style="display:inline-block;padding:10px 22px;border-radius:22px;background:#2e7d32;color:#fff;text-decoration:none;font-weight:600">See what the class has added</a></p>
<p>— PSY240 course team</p>`,
    }
  }

  // Sent back. Deliberately not framed as a failure: the claim is still
  // theirs, the slot is not lost, and the note says what to change.
  return {
    subject: `One more pass needed — your Field Guide submission for ${pageTitle}`,
    text:
`Hi ${first},

Your submission for ${pageTitle} has been sent back for another pass. Your claim is still yours — nothing is lost, and the ${difficulty} slot is still held for you.

What to change:
${note || '(see the note on the gap board)'}

The gap asks for: ${ask}

Pick it up again at ${board}

— PSY240 course team`,
    html:
`<p>Hi ${esc(first)},</p>
<p>Your submission for <b>${esc(pageTitle)}</b> has been <b>sent back for another pass</b>. Your claim is still yours — nothing is lost, and the ${esc(difficulty)} slot is still held for you.</p>
<p style="margin:14px 0;padding:12px 14px;border-left:3px solid #b8860b;background:#faf7f0"><b>What to change:</b><br>${esc(note || '(see the note on the gap board)')}</p>
<p style="color:#555"><i>The gap asks for:</i> ${esc(ask)}</p>
<p><a href="${esc(board)}" style="display:inline-block;padding:10px 22px;border-radius:22px;background:#d63384;color:#fff;text-decoration:none;font-weight:600">Pick it up again</a></p>
<p>— PSY240 course team</p>`,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const url = process.env.COURSE_SUPABASE_URL
  const anonKey = process.env.COURSE_SUPABASE_ANON_KEY
  const serviceKey = process.env.COURSE_SUPABASE_SERVICE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const missing = [
    !url && 'COURSE_SUPABASE_URL', !anonKey && 'COURSE_SUPABASE_ANON_KEY',
    !serviceKey && 'COURSE_SUPABASE_SERVICE_KEY', !resendKey && 'RESEND_API_KEY',
  ].filter(Boolean)
  if (missing.length) return res.status(500).json({ error: `Missing env: ${missing.join(', ')}` })

  const { claim_id, course_id } = req.body ?? {}
  if (!claim_id || !course_id) return res.status(400).json({ error: 'claim_id and course_id required' })

  // Staff check against the caller's own JWT — same pattern as api/ingest.js.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: staff, error: sErr } = await userClient
    .from('enrollments').select('id')
    .eq('course_id', course_id).eq('status', 'active').in('role', ['ta', 'instructor'])
  if (sErr) return res.status(500).json({ error: `Enrollment check failed: ${sErr.message}` })
  if (!staff?.length) return res.status(403).json({ error: 'No active TA/instructor enrollment' })

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error: pErr } = await service.rpc('claim_notification_payload', { p_claim_id: claim_id })
  if (pErr) return res.status(500).json({ error: `Lookup failed: ${pErr.message}` })
  const c = Array.isArray(rows) ? rows[0] : rows
  if (!c) return res.status(404).json({ error: 'No such claim' })

  // Only the two decision states are worth a message; a claim moving back to
  // 'submitted' is the student's own action and needs no mail from us.
  if (!['accepted', 'claimed'].includes(c.status)) {
    return res.status(200).json({ sent: false, reason: `status is ${c.status}` })
  }

  const origin = process.env.SITE_URL || 'https://radlab.zone'
  const fromEmail = process.env.FROM_EMAIL || 'PSY240 Field Guide <fieldguide@course.radlab.zone>'
  const { subject, text, html } = compose({
    name: c.student_name, status: c.status, note: c.note,
    pageTitle: c.page_title ?? c.page_slug, ask: c.ask,
    difficulty: c.difficulty, origin,
  })

  try {
    const rsp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: c.student_email, subject, text, html }),
    })
    if (!rsp.ok) throw new Error(`Resend ${rsp.status}: ${(await rsp.text()).slice(0, 200)}`)

    // supabase-js rpc reports failure in `error`, it does not throw — so an
    // unchecked call here reported success while the stamp silently failed,
    // which is how the guard rejection stayed invisible. The mail is already
    // gone at this point, so a stamp failure is reported as its own state
    // rather than as a send failure: re-sending would mail the student twice.
    const { error: stampErr } = await service.rpc('mark_claim_notified', { p_claim_id: claim_id })
    if (stampErr) {
      return res.status(200).json({
        sent: true, stamped: false, to: c.student_email,
        warning: `Email sent, but could not record it: ${stampErr.message}. It will keep showing as "not yet told".`,
      })
    }
    return res.status(200).json({ sent: true, stamped: true, to: c.student_email })
  } catch (e) {
    return res.status(500).json({ error: `Could not send: ${e.message}` })
  }
}
