// issueLink — shared participant_links issuance, used by auto-enroll (via
// materializeSchedule) and send_message. Enforces one-live-link-per-participant.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export interface IssueLinkArgs {
  scheduleId: string
  participantId: string
  studyId: string
  linkExpiresHours?: number | null
}

/**
 * Issue an active link for a schedule row, revoking any other active link
 * for the participant first (one-live-link-per-participant rule), and
 * back-filling participant_schedule.link_id.
 */
export async function issueLink(
  db: SupabaseClient,
  { scheduleId, participantId, studyId, linkExpiresHours }: IssueLinkArgs,
): Promise<{ id: string; token: string }> {
  await db
    .from('participant_links')
    .update({ status: 'revoked' })
    .eq('participant_id', participantId)
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
