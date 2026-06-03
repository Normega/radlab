import { supabase } from './supabase'

export async function createParticipantAccount(participantId, studyId) {
  const { data, error } = await supabase.functions.invoke('create_participant', {
    body: { participantId, studyId },
  })

  // Prefer the error message from the function body over the generic HTTP error
  if (data?.error) return { userId: null, error: new Error(data.error) }
  if (error)       return { userId: null, error }

  return { userId: data.userId, error: null }
}
