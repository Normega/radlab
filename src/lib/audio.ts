import { supabase } from './supabase'

const AUDIO_BUCKET   = 'study-media'
const SIGNED_URL_TTL = 60 * 60  // 1 hour


// ── Signed URL ────────────────────────────────────────────────────────────────

export async function getAudioSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`)
  }

  return data.signedUrl
}


// ── Session management ────────────────────────────────────────────────────────

export async function createAudioSession(audioId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('participant_audio_sessions')
    .insert({ participant_id: user.id, audio_id: audioId })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create audio session: ${error?.message}`)
  }

  return data.id
}


// ── Event logging ─────────────────────────────────────────────────────────────

export type AudioEventType = 'started' | 'focus_lost' | 'focus_returned' | 'completed'

export async function logAudioEvent(
  sessionId:       string,
  eventType:       AudioEventType,
  positionSeconds: number,
  metadata?:       Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('participant_audio_events')
    .insert({
      session_id:             sessionId,
      event_type:             eventType,
      audio_position_seconds: positionSeconds,
      metadata:               metadata ?? {},
    })

  if (error) {
    console.warn('Audio event log failed:', error.message)
  }
}


// ── Completion ────────────────────────────────────────────────────────────────

export async function completeAudioSession(
  sessionId:      string,
  secondsListened: number,
  listenPct:      number,
): Promise<void> {
  const { error } = await supabase.rpc('complete_audio_session', {
    p_session_id:       sessionId,
    p_seconds_listened: secondsListened,
    p_listen_pct:       listenPct,
  })

  if (error) {
    throw new Error(`complete_audio_session RPC failed: ${error.message}`)
  }
}
