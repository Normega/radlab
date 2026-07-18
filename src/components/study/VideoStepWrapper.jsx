import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import StudyVideoPlayer from '../video/StudyVideoPlayer'

/**
 * Mounts inside StepDispatcher for steps with category === 'video'.
 * subcategory = video_library.id. Plays the video through StudyVideoPlayer
 * with full participant tracking (participant_video_sessions + events +
 * complete_video_session); Continue unlocks at 90% watched.
 *
 * demoMode / missing participant context → StudyVideoPlayer preview (no DB
 * writes), same gate behavior.
 */
export default function VideoStepWrapper({
  subcategory,
  label,
  enrollment,
  scheduleId,
  onComplete,
  supabaseClient,
  isSimMode = false,
  demoMode = false,
}) {
  const db = supabaseClient ?? globalSupabase
  const participantId = enrollment?.profile_id ?? enrollment?.user_id ?? null
  const [done, setDone] = useState(false)
  const [sessionId, setSessionId] = useState(null)

  const { data: video, isLoading, error } = useQuery({
    queryKey: ['video-step', subcategory],
    queryFn: async () => {
      const { data, error } = await db
        .from('video_library')
        .select('id, title, storage_path')
        .eq('id', subcategory)
        .single()
      if (error) throw error
      return data
    },
  })

  if (isSimMode) {
    setTimeout(() => onComplete?.({ sim: true }), 0)
    return <div style={S.loading}>Sim mode — skipping video step</div>
  }

  if (isLoading) return <div style={S.loading}>Loading video…</div>
  if (error || !video) {
    return <div style={S.err}>Could not load video step: {error?.message ?? 'video not found'}</div>
  }

  const preview = demoMode || !participantId

  return (
    <div style={S.wrap}>
      {label && <h3 style={S.heading}>{label}</h3>}
      <StudyVideoPlayer
        storagePath={video.storage_path}
        participantId={participantId ?? undefined}
        videoId={video.id}
        scheduleId={scheduleId ?? undefined}
        requiredWatchPct={0.9}
        preview={preview}
        supabaseClient={db}
        onComplete={(sid) => { setDone(true); if (sid) setSessionId(sid) }}
      />
      {!done && (
        <p style={S.note}>Continue will unlock once the video has been watched.</p>
      )}
      <button
        style={{ ...S.btn, ...(done ? {} : S.btnOff) }}
        disabled={!done}
        onClick={async () => {
          // Stamp when the participant left the video screen, so post-video dwell
          // (advanced_at - completed_at) is measurable. Fire-and-forget; never
          // block advancing on it. Skipped in preview (no sessionId).
          if (sessionId && !preview) {
            db.rpc('mark_video_advanced', { p_session_id: sessionId })
              .then(({ error }) => { if (error) console.warn('mark_video_advanced failed:', error.message) })
          }
          onComplete?.({ video_id: video.id, watched: true })
        }}
      >
        Continue
      </button>
    </div>
  )
}

const S = {
  wrap: {
    maxWidth: 720, margin: '0 auto', padding: '32px 24px',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  heading: { fontSize: 20, fontWeight: 600, color: 'var(--tx)', margin: '0 0 16px' },
  note: {
    fontSize: 13, color: 'var(--tx3)', margin: '12px 0 0', textAlign: 'center',
  },
  btn: {
    display: 'block', width: '100%', marginTop: 16,
    background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10,
    padding: '13px 32px', fontSize: 15, fontWeight: 600,
    fontFamily: '"DM Sans",system-ui,sans-serif', cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnOff: { opacity: 0.4, cursor: 'not-allowed' },
  loading: { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:     { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
}
