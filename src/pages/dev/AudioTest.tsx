import StudyAudioPlayer from '../../components/audio/StudyAudioPlayer'

// Replace with a real study_audios.id after uploading a file via /admin/audio
const AUDIO_ID = 'replace-with-real-audio-id'

export default function AudioTest() {
  if (!import.meta.env.DEV) return null

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem', fontFamily: 'DM Sans, sans-serif' }}>
      <h2 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
        Dev — StudyAudioPlayer test
      </h2>
      <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
        audioId: <code>{AUDIO_ID}</code> &nbsp;|&nbsp;
        Check Supabase for session/event rows after interacting.
      </p>
      <StudyAudioPlayer
        audioId={AUDIO_ID}
        onComplete={() => console.log('onComplete fired')}
      />
    </div>
  )
}
