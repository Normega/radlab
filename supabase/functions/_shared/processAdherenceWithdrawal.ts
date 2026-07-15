// processAdherenceWithdrawal — the side effects of a failed adherence_check
// gate (materializeSchedule.ts detects it, this actually acts on it): marks
// the enrollment withdrawn, revokes any active link, and sends the
// termination email. Called from check_schedule's advance pass (the only
// realistic call site — the gate can't resolve at enrollment time, before
// any daily sessions exist) and, for defense-in-depth, auto-enroll.
//
// Idempotency: study_enrollments.status='withdrawn' is the guard. Callers
// must skip participants already in that state before calling
// materializeSchedule again (see check_schedule.ts) — otherwise the same
// withdrawal would be reprocessed (and re-emailed) every cron tick.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { renderTerminationEmail } from './emailTemplate.ts'
import type { AdherenceWithdrawal } from './materializeSchedule.ts'

export async function processAdherenceWithdrawal(
  db: SupabaseClient,
  args: {
    participantId: string
    studyId: string
    withdrawal: AdherenceWithdrawal
    testOverrideEmail?: string
  },
): Promise<{ emailed: boolean; reason?: string }> {
  const { participantId, studyId, withdrawal, testOverrideEmail } = args
  const isTest = !!testOverrideEmail

  const reason =
    `Adherence check failed: completed ${withdrawal.completed}/${withdrawal.ofTotal} ` +
    `daily sessions in ${withdrawal.phase} (minimum ${withdrawal.minRequired} required).`

  const { error: enrollErr } = await db
    .from('study_enrollments')
    .update({ status: 'withdrawn', withdrawal_reason: reason, withdrawn_at: new Date().toISOString() })
    .eq('study_id', studyId)
    .eq('profile_id', participantId)
  if (enrollErr) throw enrollErr

  const { error: revokeErr } = await db
    .from('participant_links')
    .update({ status: 'revoked' })
    .eq('study_id', studyId)
    .eq('participant_id', participantId)
    .eq('status', 'active')
  if (revokeErr) throw revokeErr

  const { data: study } = await db.from('studies').select('name').eq('id', studyId).single()
  const { data: profile } = await db.from('profiles').select('display_name').eq('id', participantId).single()
  const firstName = (profile?.display_name ?? '').split(' ')[0] || 'Participant'

  const { data: { user: authUser } } = await db.auth.admin.getUserById(participantId)
  const to = isTest ? testOverrideEmail! : authUser?.email

  if (!to) {
    await logTerminationMessage(db, participantId, 'failed', isTest)
    return { emailed: false, reason: 'no_recipient_email' }
  }

  const { subject, html, text } = renderTerminationEmail({
    first_name: firstName,
    study_name: study?.name ?? 'this study',
    is_test: isTest,
  })

  const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'research@radlab.vercel.app'

  const { error: sendErr } = await resend.emails.send({ from: fromEmail, to, subject, html, text })

  await logTerminationMessage(db, participantId, sendErr ? 'failed' : 'sent', isTest)

  if (sendErr) {
    console.error('processAdherenceWithdrawal: Resend error:', sendErr)
    return { emailed: false, reason: sendErr.message }
  }
  return { emailed: true }
}

async function logTerminationMessage(
  db: SupabaseClient,
  participantId: string,
  status: string,
  isTest: boolean,
) {
  const { error } = await db.from('message_log').insert({
    participant_id: participantId,
    sent_at: new Date().toISOString(),
    channel: 'email',
    status,
    kind: 'adherence_termination',
    is_test: isTest,
  })
  if (error) console.error('processAdherenceWithdrawal: failed to write message_log:', error.message)
}
