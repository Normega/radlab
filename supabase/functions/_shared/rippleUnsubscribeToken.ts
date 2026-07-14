// Shared utility — gets or creates a permanent Ripple unsubscribe token for a user.
// Tokens are reusable and never expire.
// Used by ripple_reminder to include a signed unsubscribe link in every email.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function getOrCreateRippleUnsubscribeToken(
  db: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await db
    .from('ripple_unsubscribe_tokens')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.token) return existing.token

  const token = crypto.randomUUID()
  const { error } = await db
    .from('ripple_unsubscribe_tokens')
    .insert({ token, user_id: userId })

  if (error) throw new Error(`Failed to create Ripple unsubscribe token: ${error.message}`)

  return token
}
