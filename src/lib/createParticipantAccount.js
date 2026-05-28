import { supabase } from './supabase'

export async function createParticipantAccount(participantId, studyId) {
  const { data, error } = await supabase.functions.invoke('create_participant', {
    body: { participantId, studyId },
  })

  if (error) return { userId: null, error }
  if (data?.error) return { userId: null, error: new Error(data.error) }

  return { userId: data.userId, error: null }
}
