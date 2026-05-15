// Shared utility — gets or creates a permanent unsubscribe token for a
// participant + study pair. Tokens are reusable and never expire.
// Used by send_message to include a signed unsubscribe link in every email.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function getOrCreateUnsubscribeToken(
  db: SupabaseClient,
  participantId: string,
  studyId: string,
): Promise<string> {
  // Return existing token if one already exists for this participant + study
  const { data: existing } = await db
    .from('participant_unsubscribe_tokens')
    .select('token')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (existing?.token) return existing.token

  // Mint a new token
  const token = crypto.randomUUID()
  const { error } = await db
    .from('participant_unsubscribe_tokens')
    .insert({ token, participant_id: participantId, study_id: studyId })

  if (error) throw new Error(`Failed to create unsubscribe token: ${error.message}`)

  return token
}
