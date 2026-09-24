import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ENROLL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-enroll`
const RESEARCH_EMAIL = 'research@radlab.zone'

function postEnroll(body) {
  return fetch(ENROLL_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body:    JSON.stringify(body),
  }).then(r => r.json().then(data => ({ ok: r.ok, data })))
}

export default function StudyJoin() {
  const navigate    = useNavigate()
  const [error, setError] = useState(null)
  // Set when auto-enroll refuses the join because the participant is active in
  // another study of the same exclusion group (studies.exclusion_group).
  const [exclusion, setExclusion] = useState(null) // { message, body }
  const [mailState, setMailState] = useState('idle') // idle | sending | sent | error
  const [mailError, setMailError] = useState(null)

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

    postEnroll(body)
      .then(({ ok, data }) => {
        if (data.exclusion) {
          setExclusion({ message: data.error, body: { study_id, external_id, source } })
        } else if (!ok || data.error) {
          setError(data.error ?? 'Enrollment failed. Please contact the study team.')
        } else {
          navigate(`/s/${data.token}`, { replace: true })
        }
      })
      .catch(() => setError('A network error occurred. Please check your connection and try again.'))
  }, [])

  function requestWithdrawLink() {
    setMailState('sending')
    setMailError(null)
    postEnroll({ ...exclusion.body, action: 'send_exclusion_withdraw_link' })
      .then(({ ok, data }) => {
        if (ok && (data.status === 'sent' || data.status === 'already_sent')) {
          setMailState('sent')
        } else {
          setMailState('error')
          setMailError(data.error ?? `We couldn't send the email. Please write to ${RESEARCH_EMAIL} with your SONA ID.`)
        }
      })
      .catch(() => {
        setMailState('error')
        setMailError('A network error occurred. Please check your connection and try again.')
      })
  }

  return (
    <>
      <style>{`@keyframes _spin { to { transform: rotate(360deg) } }`}</style>
      <div style={S.page}>
        {exclusion ? (
          <div style={S.card}>
            <p style={S.errorTitle}>You're already in one of our studies</p>
            <p style={S.body}>{exclusion.message}</p>
            {mailState === 'sent' ? (
              <p style={S.body}>
                We've emailed a withdrawal link to the address you gave for your current study.
                Once you've withdrawn, come back to SONA and open this study again.
              </p>
            ) : (
              <>
                <p style={S.body}>
                  We can email you a link to withdraw from your current study, sent to the
                  address you gave it.
                </p>
                <button style={S.primaryBtn} onClick={requestWithdrawLink} disabled={mailState === 'sending'}>
                  {mailState === 'sending' ? 'Sending…' : 'Email me a withdrawal link'}
                </button>
                {mailError && <p style={S.errorBody}>{mailError}</p>}
              </>
            )}
            <p style={S.hint}>
              If you'd rather stay in your current study, you don't need to do anything.
              Questions: <a href={`mailto:${RESEARCH_EMAIL}`} style={S.link}>{RESEARCH_EMAIL}</a>
            </p>
          </div>
        ) : error ? (
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
  errorTitle:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, color: 'var(--tx)', margin: '0 0 12px' },
  errorBody:    { fontSize: 14, color: '#b91c1c', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '0 0 12px', lineHeight: 1.5 },
  body:         { fontSize: 15, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '0 0 16px', lineHeight: 1.6 },
  primaryBtn:   { margin: '8px 0 20px', padding: '12px 24px', borderRadius: 8, border: '1px solid var(--pk)', background: '#fff', color: 'var(--pk)', fontSize: 15, fontWeight: 600, fontFamily: '"DM Sans",system-ui,sans-serif', cursor: 'pointer' },
  hint:         { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0, lineHeight: 1.5 },
  link:         { color: 'var(--pk)' },
}
