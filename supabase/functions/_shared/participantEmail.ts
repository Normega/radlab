// resolveParticipantEmail — the one place that decides where study emails go.
//
// External (SONA/Prolific) participants get a synthetic, undeliverable auth
// email at auto-enroll (`ext-<source>-<id>@participants.radlab.zone`); their
// real address is collected in-session by ContactEmailGate and stored on
// study_enrollments.contact_email. Order of precedence:
//   1. study_enrollments.contact_email (participant-provided, per study)
//   2. the auth.users email, unless it's a synthetic participants-domain
//      address — "sending" to those silently drops every message, so a
//      synthetic-only participant resolves to null and callers surface a
//      real no-recipient failure instead.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const SYNTHETIC_EMAIL_DOMAIN = '@participants.radlab.zone'

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(SYNTHETIC_EMAIL_DOMAIN)
}

export async function resolveParticipantEmail(
  db: SupabaseClient,
  participantId: string,
  studyId: string,
): Promise<string | null> {
  const { data: enrollment } = await db
    .from('study_enrollments')
    .select('contact_email')
    .eq('study_id', studyId)
    .eq('profile_id', participantId)
    .maybeSingle()

  if (enrollment?.contact_email) return enrollment.contact_email

  const { data: { user } } = await db.auth.admin.getUserById(participantId)
  const authEmail = user?.email ?? null
  return isSyntheticEmail(authEmail) ? null : authEmail
}
