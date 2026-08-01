// issueLink — shared participant_links issuance, used by auto-enroll (via
// materializeSchedule) and send_message. Enforces one live link per
// participant **per study**.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export interface IssueLinkArgs {
  scheduleId: string
  participantId: string
  studyId: string
  linkExpiresHours?: number | null
}

/**
 * Issue an active link for a schedule row, closing any other live link for the
 * same participant *in the same study* first, and back-filling
 * participant_schedule.link_id.
 */
export async function issueLink(
  db: SupabaseClient,
  { scheduleId, participantId, studyId, linkExpiresHours }: IssueLinkArgs,
): Promise<{ id: string; token: string }> {
  // 'expired', not 'revoked'. When this fires, the link it closes is the
  // previous session's, still inside its window and unused — the participant
  // simply missed it. SessionEntry shows 'revoked' as "This link is no longer
  // active. Please contact your researcher.", which is alarming and wrong for
  // an ordinary miss, and sign_in_with_link 403s on it. 'expired' gets the
  // soft landing ("that's completely okay… nothing to make up"), which is the
  // truth. ended_reason keeps the distinction from a real timeout.
  //
  // Scoped to study_id: without it, issuing a link in one study would kill a
  // participant's live link in another study they are concurrently enrolled
  // in. No one has hit that yet (0 participants currently hold active links in
  // 2+ studies) but 1 participant is already enrolled in two.
  await db
    .from('participant_links')
    .update({
      status: 'expired',
      ended_reason: 'superseded',
      ended_at: new Date().toISOString(),
    })
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
    .eq('status', 'active')

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + (linkExpiresHours ?? 48))

  const { data: link, error: linkErr } = await db
    .from('participant_links')
    .insert({
      schedule_id: scheduleId,
      participant_id: participantId,
      study_id: studyId,
      expires_at: expiresAt.toISOString(),
      status: 'active',
    })
    .select('id, token')
    .single()

  if (linkErr) throw linkErr

  // Status is the caller's concern (auto-enroll's first session stays
  // 'unlocked'; send_message's due row moves to 'link_sent') — only the FK
  // back-fill belongs here.
  await db
    .from('participant_schedule')
    .update({ link_id: link.id })
    .eq('id', scheduleId)

  return link
}
