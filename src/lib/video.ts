// lib/video.ts
// Supabase video helpers: signed URLs, session create, event logging, completion.
// All participant-facing calls use the anon client.
// complete_video_session RPC is called directly from StudyVideoPlayer (anon client);
// the server-side completeVideoSession() export below is for edge functions only.

import { supabase } from './supabase'

const VIDEO_BUCKET   = 'videos'
const SIGNED_URL_TTL = 60 * 60  // 1 hour — covers long videos with buffer


// ── Signed URL ────────────────────────────────────────────────────────────────

export async function getVideoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`)
  }

  return data.signedUrl
}


// ── Session management ────────────────────────────────────────────────────────

export type VideoSessionRow = {
  id: string
  participant_id: string
  video_id: string
  participant_schedule_id: string | null
  started_at: string
  is_complete: boolean
}

export async function createVideoSession(
  participantId: string,
  videoId: string,
  participantScheduleId?: string,
): Promise<VideoSessionRow> {
  const { data, error } = await supabase
    .from('participant_video_sessions')
    .insert({
      participant_id:           participantId,
      video_id:                 videoId,
      participant_schedule_id:  participantScheduleId ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create video session: ${error?.message}`)
  }

  return data
}

export async function getVideoSession(sessionId: string): Promise<VideoSessionRow | null> {
  const { data, error } = await supabase
    .from('participant_video_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error) return null
  return data
}


// ── Event logging ─────────────────────────────────────────────────────────────

export type VideoEventType = 'started' | 'focus_lost' | 'focus_returned' | 'completed'

export interface VideoEventPayload {
  sessionId:         string
  eventType:         VideoEventType
  videoPositionSecs: number
  metadata?:         Record<string, unknown>
}

export async function logVideoEvent(payload: VideoEventPayload): Promise<void> {
  const { error } = await supabase
    .from('participant_video_events')
    .insert({
      session_id:          payload.sessionId,
      event_type:          payload.eventType,
      video_position_secs: payload.videoPositionSecs,
      metadata:            payload.metadata ?? {},
    })

  if (error) {
    console.warn('Video event log failed:', error.message)
  }
}


// ── Completion (edge / service-role only) ─────────────────────────────────────
// Do not call this from the browser. StudyVideoPlayer calls supabase.rpc()
// directly using the anon client.

export interface CompletionPayload {
  sessionId:      string
  secondsWatched: number
  watchPct:       number
  focusLosses:    number
  focusLossSecs:  number
}

export async function completeVideoSession(
  adminClient: typeof supabase,
  payload: CompletionPayload,
): Promise<void> {
  const { error } = await adminClient.rpc('complete_video_session', {
    p_session_id:      payload.sessionId,
    p_seconds_watched: payload.secondsWatched,
    p_watch_pct:       payload.watchPct,
    p_focus_losses:    payload.focusLosses,
    p_focus_loss_secs: payload.focusLossSecs,
  })

  if (error) {
    throw new Error(`complete_video_session RPC failed: ${error.message}`)
  }
}
