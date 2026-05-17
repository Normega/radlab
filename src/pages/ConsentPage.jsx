import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

// ── ConsentPage ───────────────────────────────────────────────────────────────
// Route: /study/:studyId/consent?returnTo=<encoded-path>
//
// Guards:
//   - Study must be active and have an active_consent_form_id
//   - Participant must not have already consented (redirect to returnTo if so)
//
// On submit: inserts into participant_consents, redirects to returnTo or /dashboard.

const STATES = {
  LOADING:           'loading',
  READY:             'ready',
  SUBMITTING:        'submitting',
  ALREADY_CONSENTED: 'already_consented',
  ERROR:             'error',
}

export default function ConsentPage({ session }) {
  const { studyId }       = useParams()
  const [searchParams]    = useSearchParams()
  const returnTo          = searchParams.get('returnTo') || '/dashboard'
  const navigate          = useNavigate()

  const [state,   setState]   = useState(STATES.LOADING)
  const [study,   setStudy]   = useState(null)
  const [form,    setForm]    = useState(null)
  const [agreed,  setAgreed]  = useState(false)
  const [error,   setError]   = useState(null)
  const bodyRef               = useRef(null)

  useEffect(() => {
    if (!session) return
    load()
  }, [studyId, session])

  async function load() {
    setState(STATES.LOADING)
    const userId = session.user.id

    const { data: studyData, error: se } = await supabase
      .from('studies')
      .select('id, name, consent_required, active_consent_form_id, active')
      .eq('id', studyId)
      .single()

    if (se || !studyData) {
      setError('Study not found.')
      setState(STATES.ERROR)
      return
    }
    setStudy(studyData)

    // If consent isn't required or no form is attached, skip forward
    if (!studyData.consent_required || !studyData.active_consent_form_id) {
      navigate(returnTo, { replace: true })
      return
    }

    // Check if already consented
    const { data: existing } = await supabase
      .from('participant_consents')
      .select('id, consented_at')
      .eq('participant_id', userId)
      .eq('study_id', studyId)
      .maybeSingle()

    if (existing) {
      setState(STATES.ALREADY_CONSENTED)
      return
    }

    const { data: formData, error: fe } = await supabase
      .from('study_consent_forms')
      .select('id, html_content, uploaded_at')
      .eq('id', studyData.active_consent_form_id)
      .single()

    if (fe || !formData) {
      setError('Could not load the consent form. Please contact your researcher.')
      setState(STATES.ERROR)
      return
    }

    setForm(formData)
    setState(STATES.READY)
  }

  async function handleSubmit() {
    if (!agreed || !form || !session) return
    setState(STATES.SUBMITTING)

    const { error: ie } = await supabase.from('participant_consents').insert({
      participant_id:  session.user.id,
      study_id:        studyId,
      consent_form_id: form.id,
    })

    if (ie) {
      setError(ie.message)
      setState(STATES.READY)
      return
    }

    navigate(returnTo, { replace: true })
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === STATES.LOADING) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={session} />
        <div style={S.wrap}>
          <p style={S.muted}>Loading…</p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (state === STATES.ERROR) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={session} />
        <div style={S.wrap}>
          <p style={S.errBox}>{error}</p>
        </div>
      </div>
    )
  }

  // ── Already consented ─────────────────────────────────────────────────────
  if (state === STATES.ALREADY_CONSENTED) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={session} />
        <div style={S.wrap}>
          <p style={S.eyebrow}>{study?.name}</p>
          <h1 style={S.title}>You've already consented</h1>
          <p style={S.body}>Your consent for this study is on record.</p>
          <button style={S.btn} onClick={() => navigate(returnTo, { replace: true })}>
            Continue →
          </button>
        </div>
      </div>
    )
  }

  // ── Ready / Submitting ────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        <p style={S.eyebrow}>{study?.name}</p>
        <h1 style={S.title}>Research Consent Form</h1>

        {/* Scrollable form body */}
        <div ref={bodyRef} style={S.formBox}>
          <div
            style={S.formContent}
            dangerouslySetInnerHTML={{ __html: form?.html_content ?? '' }}
          />
        </div>

        {/* Agreement checkbox */}
        <label style={S.checkRow}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--pk)', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={S.checkLabel}>
            I have read this consent form in full and agree to participate in this study.
          </span>
        </label>

        {error && <p style={S.errBox}>{error}</p>}

        <button
          style={{ ...S.btn, opacity: (!agreed || state === STATES.SUBMITTING) ? 0.5 : 1 }}
          onClick={handleSubmit}
          disabled={!agreed || state === STATES.SUBMITTING}
        >
          {state === STATES.SUBMITTING ? 'Saving…' : 'Confirm consent & continue →'}
        </button>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", monospace'
const SERIF = '"DM Serif Display", serif'

const S = {
  wrap: {
    maxWidth: 720, margin: '0 auto', padding: '48px 24px',
    display: 'flex', flexDirection: 'column', gap: 24,
  },
  eyebrow: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--pk)', margin: 0,
  },
  title: {
    fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 36px)',
    color: 'var(--tx)', margin: 0, letterSpacing: -0.5,
  },
  body: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, margin: 0 },

  formBox: {
    border: '1px solid var(--bd)', borderRadius: 12,
    background: '#fff', height: 480, overflowY: 'auto',
    padding: '24px 28px',
    boxShadow: 'inset 0 -24px 20px -20px rgba(0,0,0,0.04)',
  },
  formContent: {
    fontSize: 14, lineHeight: 1.8, color: 'var(--tx)',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },

  checkRow: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    cursor: 'pointer', userSelect: 'none',
  },
  checkLabel: {
    fontSize: 14, color: 'var(--tx)', lineHeight: 1.5,
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },

  btn: {
    alignSelf: 'flex-start',
    padding: '13px 32px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
    transition: 'opacity 0.15s',
  },

  muted: { fontSize: 14, color: 'var(--tx3)', margin: 0 },
  errBox: {
    fontSize: 13, color: '#e04', background: '#fff0f0',
    border: '1px solid #fcc', borderRadius: 8, padding: '10px 16px', margin: 0,
  },
}
