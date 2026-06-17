import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function StudyJoin() {
  const navigate    = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const params      = new URLSearchParams(window.location.search)
    const study_id    = params.get('study_id')

    let source, external_id, prolific_study_id, prolific_session_id

    if (params.get('PROLIFIC_PID')) {
      source              = 'prolific'
      external_id         = params.get('PROLIFIC_PID')
      prolific_study_id   = params.get('STUDY_ID') ?? null
      prolific_session_id = params.get('SESSION_ID') ?? null
    } else if (params.get('id')) {
      source      = 'sona'
      external_id = params.get('id')
    }

    if (!study_id || !source || !external_id) {
      setError('This link is missing required information. Please use the link provided by your study team.')
      return
    }

    const body = { study_id, external_id, source }
    if (prolific_study_id)   body.prolific_study_id   = prolific_study_id
    if (prolific_session_id) body.prolific_session_id = prolific_session_id

    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-enroll`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body:    JSON.stringify(body),
      }
    )
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || data.error) {
          setError(data.error ?? 'Enrollment failed. Please contact the study team.')
        } else {
          navigate(`/s/${data.token}`, { replace: true })
        }
      })
      .catch(() => setError('A network error occurred. Please check your connection and try again.'))
  }, [])

  return (
    <>
      <style>{`@keyframes _spin { to { transform: rotate(360deg) } }`}</style>
      <div style={S.page}>
        {error ? (
          <div style={S.card}>
            <p style={S.errorTitle}>Unable to start session</p>
            <p style={S.errorBody}>{error}</p>
            <p style={S.hint}>Please contact the study team if you continue to see this message.</p>
          </div>
        ) : (
          <div style={S.card}>
            <div style={S.spinner} />
            <p style={S.loadingTitle}>Setting up your session…</p>
            <p style={S.hint}>This will only take a moment.</p>
          </div>
        )}
      </div>
    </>
  )
}

const S = {
  page:         { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  card:         { maxWidth: 420, width: '90%', textAlign: 'center', padding: '48px 32px', background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' },
  spinner:      { width: 40, height: 40, border: '3px solid var(--bd)', borderTop: '3px solid var(--pk)', borderRadius: '50%', animation: '_spin 0.8s linear infinite', margin: '0 auto 24px' },
  loadingTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 22, color: 'var(--tx)', margin: '0 0 8px' },
  errorTitle:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, color: 'var(--tx)', margin: '0 0 12px' },
  errorBody:    { fontSize: 14, color: '#b91c1c', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '0 0 12px', lineHeight: 1.5 },
  hint:         { fontSize: 13, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0 },
}
