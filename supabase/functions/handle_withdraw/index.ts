// handle_withdraw — participant-initiated formal withdrawal, from the link
// offered on lapsed session emails (see send_message's MissState and
// LAPSED_INTRO in _shared/emailTemplate.ts).
// No authentication required — the token is the credential (the same permanent
// per-participant/study token the unsubscribe link uses; the route decides the
// action).
//
// Two-step by design: a request without confirm:true only reports what the
// token points at (study name, enrollment state) so the /withdraw page can
// render a confirmation screen without side effects — inbox link-scanners
// prefetch email URLs, and withdrawal must never happen on a GET-shaped touch.
// Only confirm:true performs the withdrawal.
//
// The withdrawal itself mirrors processAdherenceWithdrawal's state changes
// (enrollment status, link revocation, liliana mirror) minus the termination
// email — the participant is on the confirmation page watching it happen, and
// they've had plenty of email.

import { createClient } from 'npm:@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const { token, confirm, note } = body

    if (!token) {
      return json({ error: 'token is required' }, 400)
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { data: tokenRow } = await db
      .from('participant_unsubscribe_tokens')
      .select('participant_id, study_id')
      .eq('token', token)
      .maybeSingle()

    if (!tokenRow) {
      return json({ error: 'invalid_token' }, 404)
    }

    const { participant_id, study_id } = tokenRow

    const { data: enrollment } = await db
      .from('study_enrollments')
      .select('id, status')
      .eq('study_id', study_id)
      .eq('profile_id', participant_id)
      .maybeSingle()

    if (!enrollment) {
      return json({ error: 'enrollment_not_found' }, 404)
    }

    const { data: study } = await db
      .from('studies')
      .select('name')
      .eq('id', study_id)
      .single()
    const studyName = study?.name ?? 'this study'

    if (enrollment.status === 'withdrawn') {
      return json({ status: 'already_withdrawn', study_name: studyName })
    }
    if (enrollment.status === 'completed') {
      return json({ status: 'already_complete', study_name: studyName })
    }

    if (!confirm) {
      return json({ status: 'ok_to_withdraw', study_name: studyName })
    }

    // Optional participant-supplied reason from the confirmation page.
    // Trimmed and capped — this is a courtesy note, not a survey response,
    // and an unbounded text column fed from an unauthenticated endpoint is
    // an invitation to abuse. Empty string stores as null.
    const withdrawalNote = typeof note === 'string'
      ? note.trim().slice(0, 500) || null
      : null

    const reason = 'Participant withdrew via the email withdrawal link.'
    const { error: enrollErr } = await db
      .from('study_enrollments')
      .update({
        status: 'withdrawn',
        withdrawal_reason: reason,
        withdrawal_note: withdrawalNote,
        withdrawn_at: new Date().toISOString(),
      })
      .eq('id', enrollment.id)
    if (enrollErr) throw enrollErr

    // 'revoked' with ended_reason 'withdrawn', same as the adherence path:
    // participation has ended, so a live session link must stop working and
    // show the contact-your-researcher message rather than the session.
    const { error: revokeErr } = await db
      .from('participant_links')
      .update({
        status: 'revoked',
        ended_reason: 'withdrawn',
        ended_at: new Date().toISOString(),
      })
      .eq('study_id', study_id)
      .eq('participant_id', participant_id)
      .eq('status', 'active')
    if (revokeErr) throw revokeErr

    // Mirror onto the Liliana-specific participant record where one exists
    // (admin views read dropped_out there). Non-fatal, matches
    // processAdherenceWithdrawal; for studies without liliana rows this
    // matches nothing and does nothing.
    const { error: lpErr } = await db
      .from('liliana_participants')
      .update({ dropped_out: true, dropout_reason: reason })
      .eq('profile_id', participant_id)
      .eq('study_id', study_id)
    if (lpErr) console.error('handle_withdraw: failed to set liliana_participants.dropped_out:', lpErr.message)

    return json({ status: 'success', study_name: studyName })

  } catch (err) {
    console.error('handle_withdraw unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})
