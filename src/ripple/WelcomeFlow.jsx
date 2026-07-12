import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CONSENT_VERSION, TOS_VERSION, CONSENT_DOC, TOS_DOC } from './consentDocs'

// ── WelcomeFlow ───────────────────────────────────────────────────────────────
// Route: /welcome — public-tier onboarding (Ripple WP1, spec §4.1).
// Steps: intro → consent + ToS → demographics → bridge into avatar creation.
// WP2 replaces the bridge's /profile/avatar handoff with the full
// meet-your-Ripple customize + name beat.
//
// Steps already on record (consents at current versions, an existing
// demographics row) are skipped, so the flow is safe to re-enter.

const STEPS = {
  LOADING:      'loading',
  INTRO:        'intro',
  CONSENT:      'consent',
  DEMOGRAPHICS: 'demographics',
  BRIDGE:       'bridge',
}

const SES_PROMPT = 'Imagine a ladder that represents where people stand in society. At the top are people who are the best off — those with the most money, most education, and the best jobs. At the bottom are people who are the worst off. Where would you place yourself on this ladder?'

export default function WelcomeFlow({ session, onComplete }) {
  const navigate = useNavigate()

  const [step,  setStep]  = useState(STEPS.LOADING)
  const [error, setError] = useState(null)
  const [busy,  setBusy]  = useState(false)

  // Which steps are already satisfied (re-entry / partial completion)
  const [consentDone,      setConsentDone]      = useState(false)
  const [demographicsDone, setDemographicsDone] = useState(false)

  // Consent step state
  const [agreedConsent, setAgreedConsent] = useState(false)
  const [agreedTos,     setAgreedTos]     = useState(false)

  // Demographics step state (same instrument as the study DemographicsStep)
  const [age,        setAge]        = useState('')
  const [gender,     setGender]     = useState('')
  const [racialized, setRacialized] = useState(null)
  const [sesLadder,  setSesLadder]  = useState(null)

  async function load() {
    const userId = session.user.id

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete, role')
      .eq('id', userId)
      .single()

    if (profile?.onboarding_complete) {
      navigate('/dashboard', { replace: true })
      return
    }

    const [{ data: consentRows }, { data: demoRows }] = await Promise.all([
      supabase.from('consents')
        .select('doc_type, version')
        .eq('user_id', userId),
      supabase.from('demographics')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
    ])

    const hasConsent = (consentRows ?? []).some(r => r.doc_type === 'consent' && r.version === CONSENT_VERSION)
    const hasTos     = (consentRows ?? []).some(r => r.doc_type === 'tos'     && r.version === TOS_VERSION)
    setConsentDone(hasConsent && hasTos)
    setDemographicsDone((demoRows ?? []).length > 0)

    setStep(STEPS.INTRO)
  }

  useEffect(() => {
    if (!session) return
    load()
  }, [session])  // eslint-disable-line react-hooks/exhaustive-deps

  function nextAfterIntro() {
    if (!consentDone)           setStep(STEPS.CONSENT)
    else if (!demographicsDone) setStep(STEPS.DEMOGRAPHICS)
    else                        finish()
  }

  async function submitConsent() {
    if (!agreedConsent || !agreedTos || busy) return
    setBusy(true); setError(null)

    const userId = session.user.id
    const { error: dbErr } = await supabase.from('consents').upsert([
      { user_id: userId, doc_type: 'consent', version: CONSENT_VERSION },
      { user_id: userId, doc_type: 'tos',     version: TOS_VERSION },
    ], { onConflict: 'user_id,doc_type,version', ignoreDuplicates: true })

    setBusy(false)
    if (dbErr) { setError('Could not save your agreement — please try again.'); console.error('consents upsert:', dbErr); return }

    setConsentDone(true)
    if (!demographicsDone) setStep(STEPS.DEMOGRAPHICS)
    else finish()
  }

  const canSubmitDemographics =
    age !== '' && parseInt(age) > 0 && gender.trim() !== '' && racialized !== null && sesLadder !== null

  async function submitDemographics() {
    if (!canSubmitDemographics || busy) return
    setBusy(true); setError(null)

    const { error: dbErr } = await supabase.from('demographics').insert({
      user_id:    session.user.id,
      age:        parseInt(age),
      gender:     gender.trim(),
      racialized,
      ses_ladder: sesLadder,
    })

    setBusy(false)
    if (dbErr) { setError('Could not save — please try again.'); console.error('demographics insert:', dbErr); return }

    setDemographicsDone(true)
    finish()
  }

  async function finish() {
    setBusy(true); setError(null)
    const userId = session.user.id

    // Ripple identity row with default settings (name arrives in WP2's beat)
    const { error: rippleErr } = await supabase.from('ripples')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (rippleErr) { setBusy(false); setError('Something went wrong — please try again.'); console.error('ripples upsert:', rippleErr); return }

    const { error: profileErr } = await supabase.from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', userId)
    if (profileErr) { setBusy(false); setError('Something went wrong — please try again.'); console.error('profiles update:', profileErr); return }

    setBusy(false)
    onComplete?.()
    setStep(STEPS.BRIDGE)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === STEPS.LOADING) {
    return <div style={S.page}><div style={S.wrap}><p style={S.muted}>Loading…</p></div></div>
  }

  if (step === STEPS.INTRO) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <p style={S.eyebrow}>RADlab</p>
          <h1 style={S.title}>Welcome</h1>
          <p style={S.body}>
            When the water is still, you can see what&rsquo;s moving underneath.
            In a moment you&rsquo;ll meet your <strong>Ripple</strong> — a companion
            that reflects how you&rsquo;re doing, and a partner in noticing it.
          </p>
          <p style={S.body}>
            Two quick things first: how your data is used here, and a few
            questions about you.
          </p>
          <button style={S.btn} onClick={nextAfterIntro}>Let&rsquo;s go →</button>
        </div>
      </div>
    )
  }

  if (step === STEPS.CONSENT) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <p style={S.eyebrow}>Step 1 of 2</p>
          <h1 style={S.title}>Your data, plainly</h1>

          <DocBox doc={CONSENT_DOC} agreed={agreedConsent} onToggle={setAgreedConsent} />
          <DocBox doc={TOS_DOC}     agreed={agreedTos}     onToggle={setAgreedTos} />

          {error && <p style={S.errBox}>{error}</p>}

          <button
            style={{ ...S.btn, opacity: (!agreedConsent || !agreedTos || busy) ? 0.5 : 1 }}
            disabled={!agreedConsent || !agreedTos || busy}
            onClick={submitConsent}
          >
            {busy ? 'Saving…' : 'Agree & continue →'}
          </button>
        </div>
      </div>
    )
  }

  if (step === STEPS.DEMOGRAPHICS) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <p style={S.eyebrow}>Step 2 of 2</p>
          <h1 style={S.title}>A little about you</h1>
          <p style={S.body}>
            These questions help our research account for how wellbeing differs
            across backgrounds. They&rsquo;re stored separately from your name.
          </p>

          <div style={S.field}>
            <label style={S.fieldLabel}>Age</label>
            <input
              type="number" min="16" max="120" value={age}
              onChange={e => setAge(e.target.value)}
              style={S.input}
            />
          </div>

          <div style={S.field}>
            <label style={S.fieldLabel}>Gender</label>
            <input
              type="text" value={gender} placeholder="In your own words"
              onChange={e => setGender(e.target.value)}
              style={S.input}
            />
          </div>

          <div style={S.field}>
            <label style={S.fieldLabel}>Do you identify as a member of a racialized group?</label>
            <div style={S.radioRow}>
              {[['yes', 'Yes'], ['no', 'No'], ['prefer_not_to_answer', 'Prefer not to answer']].map(([val, label]) => (
                <label key={val} style={S.radioLabel}>
                  <input
                    type="radio" name="racialized" checked={racialized === val}
                    onChange={() => setRacialized(val)}
                    style={{ accentColor: 'var(--pk)' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.fieldLabel}>{SES_PROMPT}</label>
            <div style={S.ladderRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  style={{
                    ...S.ladderBtn,
                    background: sesLadder === n ? 'var(--pk)' : 'transparent',
                    color:      sesLadder === n ? '#fff'      : 'var(--tx)',
                  }}
                  onClick={() => setSesLadder(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={S.muted}>1 = bottom of the ladder · 10 = top</p>
          </div>

          {error && <p style={S.errBox}>{error}</p>}

          <button
            style={{ ...S.btn, opacity: (!canSubmitDemographics || busy) ? 0.5 : 1 }}
            disabled={!canSubmitDemographics || busy}
            onClick={submitDemographics}
          >
            {busy ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      </div>
    )
  }

  // BRIDGE — WP2 replaces this handoff with the full meet/customize/name beat
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <p style={S.eyebrow}>One more thing</p>
        <h1 style={S.title}>Time to meet your Ripple</h1>
        <p style={S.body}>
          Your Ripple starts as a face you choose. It will grow with you as you
          play and check in — this is your partner here, made visible.
        </p>
        {error && <p style={S.errBox}>{error}</p>}
        <button style={S.btn} onClick={() => navigate('/profile/avatar', { replace: true })}>
          Choose a face →
        </button>
      </div>
    </div>
  )
}

// ── DocBox — scrollable doc with its own agreement checkbox ──────────────────
function DocBox({ doc, agreed, onToggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={S.docBox}>
        <h2 style={S.docTitle}>{doc.title}</h2>
        {doc.paragraphs.map((p, i) => <p key={i} style={S.docPara}>{p}</p>)}
      </div>
      <label style={S.checkRow}>
        <input
          type="checkbox" checked={agreed}
          onChange={e => onToggle(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--pk)', cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={S.checkLabel}>{doc.checkboxLabel}</span>
      </label>
    </div>
  )
}

// ── Styles (ConsentPage idiom) ────────────────────────────────────────────────

const MONO  = '"Space Mono", monospace'
const SERIF = '"DM Serif Display", serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  page: { background: 'var(--bg)', minHeight: '100vh' },
  wrap: {
    maxWidth: 640, margin: '0 auto', padding: '64px 24px',
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
  body: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.7, margin: 0, fontFamily: SANS },

  docBox: {
    border: '1px solid var(--bd)', borderRadius: 12,
    background: '#fff', maxHeight: 280, overflowY: 'auto',
    padding: '20px 24px',
    boxShadow: 'inset 0 -24px 20px -20px rgba(0,0,0,0.04)',
  },
  docTitle: { fontFamily: MONO, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx)', margin: '0 0 12px' },
  docPara:  { fontSize: 14, lineHeight: 1.7, color: 'var(--tx)', fontFamily: SANS, margin: '0 0 12px' },

  checkRow:   { display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' },
  checkLabel: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.5, fontFamily: SANS },

  field:      { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel: { fontSize: 14, color: 'var(--tx)', fontFamily: SANS, fontWeight: 600, lineHeight: 1.5 },
  input: {
    padding: '10px 14px', borderRadius: 10, border: '1px solid var(--bd)',
    fontSize: 15, fontFamily: SANS, color: 'var(--tx)', background: '#fff',
    maxWidth: 320,
  },
  radioRow:   { display: 'flex', gap: 20, flexWrap: 'wrap' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontFamily: SANS, color: 'var(--tx)', cursor: 'pointer' },
  ladderRow:  { display: 'flex', gap: 8, flexWrap: 'wrap' },
  ladderBtn: {
    width: 40, height: 40, borderRadius: 10, border: '1px solid var(--bd)',
    fontFamily: MONO, fontSize: 14, cursor: 'pointer', transition: 'background 0.1s',
  },

  btn: {
    alignSelf: 'flex-start',
    padding: '13px 32px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
    transition: 'opacity 0.15s',
  },

  muted:  { fontSize: 13, color: 'var(--tx3)', margin: 0, fontFamily: SANS },
  errBox: {
    fontSize: 13, color: '#e04', background: '#fff0f0',
    border: '1px solid #fcc', borderRadius: 8, padding: '10px 16px', margin: 0,
  },
}
