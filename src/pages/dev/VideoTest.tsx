import StudyVideoPlayer from '../../components/video/StudyVideoPlayer'

const VIDEO_ID       = '092f8777-c42c-4875-8c1c-2775782e4eb4'
const PARTICIPANT_ID = '0097e364-e11c-40b9-81f3-622831f39bc2'
const STUDY_VIDEO = {
  storagePath:      'Introduction_revised_resampled.mp4',
  durationSeconds:  180,
  requiredWatchPct: 0.10,
  title:            'Introduction',
}

export default function VideoTest() {
  if (!import.meta.env.DEV) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Not found</p>
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem', fontFamily: 'DM Sans, sans-serif' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        Dev — StudyVideoPlayer test
      </h2>
      <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
        Video: <code>{STUDY_VIDEO.title}</code> &nbsp;|&nbsp;
        requiredWatchPct: <code>{STUDY_VIDEO.requiredWatchPct}</code> &nbsp;|&nbsp;
        Check console for <code>onComplete</code> event.
      </p>
      <StudyVideoPlayer
        storagePath={STUDY_VIDEO.storagePath}
        participantId={PARTICIPANT_ID}
        videoId={VIDEO_ID}
        requiredWatchPct={STUDY_VIDEO.requiredWatchPct}
        onComplete={(sessionId) => console.log('onComplete fired, sessionId:', sessionId)}
      />
    </div>
  )
}
