import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import StudyVideoPlayer from '../../components/video/StudyVideoPlayer'

const VIDEO_ID = '092f8777-c42c-4875-8c1c-2775782e4eb4'

type StudyVideo = {
  id: string
  storage_path: string
  required_watch_pct: number
  title: string | null
}

export default function VideoTest() {
  if (!import.meta.env.DEV) return null

  const [userId,     setUserId]     = useState<string | null>(null)
  const [studyVideo, setStudyVideo] = useState<StudyVideo | null>(null)
  const [loadError,  setLoadError]  = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))

    supabase
      .from('study_videos')
      .select('id, storage_path, required_watch_pct, title')
      .eq('id', VIDEO_ID)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setLoadError(error?.message ?? 'Video not found')
        else setStudyVideo(data)
      })
  }, [])

  if (loadError) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#c00' }}>{loadError}</p>
  }

  if (!userId || !studyVideo) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#666' }}>Loading…</p>
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem', fontFamily: 'DM Sans, sans-serif' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        Dev — StudyVideoPlayer test
      </h2>
      <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
        Video: <code>{studyVideo.title ?? studyVideo.id}</code> &nbsp;|&nbsp;
        requiredWatchPct: <code>{studyVideo.required_watch_pct}</code> &nbsp;|&nbsp;
        participantId: <code>{userId}</code> &nbsp;|&nbsp;
        Check console for <code>onComplete</code>.
      </p>
      <StudyVideoPlayer
        storagePath={studyVideo.storage_path}
        participantId={userId}
        videoId={studyVideo.id}
        requiredWatchPct={studyVideo.required_watch_pct}
        onComplete={(sessionId) => console.log('onComplete fired, sessionId:', sessionId)}
      />
    </div>
  )
}
