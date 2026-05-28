import { createClient } from '@supabase/supabase-js'
import { supabase as primaryClient } from './supabase'

const secondaryClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export async function createParticipantAccount(participantId, studyId) {
  const email    = `p-${participantId.toLowerCase().replace(/[^a-z0-9]/g, '-')}@participants.radlab.zone`
  const password = crypto.randomUUID()

  const { data, error: signUpError } = await secondaryClient.auth.signUp({
    email,
    password,
    options: { data: { display_name: `Participant ${participantId}` } },
  })

  if (signUpError) return { userId: null, error: signUpError }

  const userId = data.user?.id
  if (!userId) return { userId: null, error: new Error('No user ID returned from signUp') }

  const { error: updateError } = await primaryClient
    .from('profiles')
    .update({ role: 'participant', study_id: studyId })
    .eq('id', userId)

  if (updateError) return { userId, error: updateError }
  return { userId, error: null }
}
