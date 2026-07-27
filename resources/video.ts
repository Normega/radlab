// lib/video.ts
// Supabase video helpers: signed URLs, session create, event logging, completion.
// All participant-facing calls use the anon client.
// complete_video_session uses the service-role client (server/edge only).

import { supabase } from '@/lib/supabaseClient'        // anon client
// import { supabaseAdmin } from '@/lib/supabaseAdmin'  // service-role — import in edge fn only

const VIDEO_BUCKET = 'videos'
const SIGNED_URL_TTL = 60 * 60  // 1 hour in seconds — covers a 3-min video with buffer


// -------------------------------------------------------------
// Signed URL
// Generates a time-limited URL for a video in Supabase Storage.
// Call this on the server or in a short-lived client session;
// do not persist or share the URL.
// -------------------------------------------------------------
export async function getVideoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`)
  }

  return data.signedUrl
}


// -------------------------------------------------------------
// Session management
// -------------------------------------------------------------

export type VideoSessionRow = {
  id: string
  participant_id: string
  video_id: string
  participant_schedule_id: string | null
  started_at: string
  is_complete: boolean
}

/** Create a new session row when the participant begins watching. */
export async function createVideoSession(
  participantId: string,
  videoId: string,
  participantScheduleId?: string
): Promise<VideoSessionRow> {
  const { data, error } = await supabase
    .from('participant_video_sessions')
    .insert({
      participant_id: participantId,
      video_id: videoId,
      participant_schedule_id: participantScheduleId ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create video session: ${error?.message}`)
  }

  return data
}

/** Read current session state (e.g. to resume after page refresh). */
export async function getVideoSession(sessionId: string): Promise<VideoSessionRow | null> {
  const { data, error } = await supabase
    .from('participant_video_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error) return null
  return data
}


// -------------------------------------------------------------
// Event logging
// Append-only from client. Fire-and-forget in the component;
// failures are non-critical (we still have session-level stats).
// -------------------------------------------------------------

export type VideoEventType = 'started' | 'focus_lost' | 'focus_returned' | 'completed'

export interface VideoEventPayload {
  sessionId: string
  eventType: VideoEventType
  videoPositionSecs: number
  metadata?: Record<string, unknown>
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
    // Non-fatal — log locally but don't throw; don't interrupt the participant
    console.warn('Video event log failed:', error.message)
  }
}


// -------------------------------------------------------------
// Completion
// Called from an edge function (service role) when the component
// fires its onComplete callback. Never called directly from client.
//
// Usage in your edge function:
//   import { completeVideoSession } from '@/lib/video'
//   await completeVideoSession(supabaseAdmin, { ... })
// -------------------------------------------------------------

export interface CompletionPayload {
  sessionId:       string
  secondsWatched:  number
  watchPct:        number
  focusLosses:     number
  focusLossSecs:   number
}

export async function completeVideoSession(
  adminClient: typeof supabase,   // pass service-role client from edge fn
  payload: CompletionPayload
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
