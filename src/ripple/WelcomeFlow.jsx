import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CONSENT_VERSION, TOS_VERSION, CONSENT_DOC, TOS_DOC } from './consentDocs'
import { SKIN_COLORS, EYE_COLORS } from '../components/Avatar/BaseAvatar'
import RippleAvatar from './RippleAvatar'
import CheckinFlow from './CheckinFlow'

// ── WelcomeFlow ───────────────────────────────────────────────────────────────
// Route: /welcome — public-tier onboarding (Ripple WP1+WP2+WP3, spec §4.1).
// Steps: intro → consent + ToS → demographics → customize appearance → name Ripple → check-in.
// Each step is skipped when already satisfied, so the flow is safe to re-enter.

const STEPS = {
  LOADING:      'loading',
  INTRO:        'intro',
  CONSENT:      'consent',
  DEMOGRAPHICS: 'demographics',
  CUSTOMIZE:    'customize',
  NAME:         'name',
  CHECKIN:      'checkin',
}

const RIPPLE_NAMES = [
  'Mira', 'Orin', 'Sage', 'Wren', 'Lumi', 'Crest',
  'Fenn', 'Zara', 'Coda', 'Tavi', 'River', 'Bay',
  'Reef', 'Tide', 'Beck', 'Haven', 'Marsh', 'Sol',
]

function pickRandom(current) {
  const others = RIPPLE_NAMES.filter(n => n !== current)
  return others[Math.floor(Math.random() * others.length)]
}

const SES_PROMPT = 'Imagine a ladder that represents where people stand in society. At the top are people who are the best off — those with the most money, most education, and the best jobs. At the bottom are people who are the worst off. Where would you place yourself on this ladder?'

export default function WelcomeFlow({ session, onComplete }) {
  const navigate = useNavigate()

  const [step,  setStep]  = useState(STEPS.LOADING)
  const [error, setError] = useState(null)
  const [busy,  setBusy]  = useState(false)

  // Which steps are already satisfied
  const [consentDone,      setConsentDone]      = useState(false)
  const [demographicsDone, setDemographicsDone] = useState(false)
  const [avatarDone,       setAvatarDone]       = useState(false)
  const [rippleNameDone,   setRippleNameDone]   = useState(false)

  // Consent step state
  const [agreedConsent, setAgreedConsent] = useState(false)
  const [agreedTos,     setAgreedTos]     = useState(false)

  // Demographics step state
  const [age,        setAge]        = useState('')
  const [gender,     setGender]     = useState('')
  const [racialized, setRacialized] = useState(null)
  const [sesLadder,  setSesLadder]  = useState(null)

  // Customize step state (pre-populated if avatar row already exists)
  const [skin, setSkin] = useState(SKIN_COLORS[1])  // Peach default
  const [eye,  setEye]  = useState(EYE_COLORS[3])   // Sky Blue default

  // Name step state
  const [rippleName, setRippleName] = useState(() => pickRandom(''))

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

    const [
      { data: consentRows },
      { data: demoRows },
      { data: existingAvatar },
      { data: rippleRow },
    ] = await Promise.all([
      supabase.from('consents').select('doc_type, version').eq('user_id', userId),
      supabase.from('demographics').select('id').eq('user_id', userId).limit(1),
      supabase.from('avatars').select('skin_color, eye_color').eq('user_id', userId).maybeSingle(),
      supabase.from('ripples').select('name').eq('user_id', userId).maybeSingle(),
    ])

    const hasConsent = (consentRows ?? []).some(r => r.doc_type === 'consent' && r.version === CONSENT_VERSION)
    const hasTos     = (consentRows ?? []).some(r => r.doc_type === 'tos'     && r.version === TOS_VERSION)
    setConsentDone(hasConsent && hasTos)
    setDemographicsDone((demoRows ?? []).length > 0)

    if (existingAvatar) {
      setAvatarDone(true)
      const foundSkin = SKIN_COLORS.find(c => c.hex === existingAvatar.skin_color)
      const foundEye  = EYE_COLORS.find(c => c.hex === existingAvatar.eye_color)
      if (foundSkin) setSkin(foundSkin)
      if (foundEye)  setEye(foundEye)
    }
    setRippleNameDone(!!(rippleRow?.name))

    setStep(STEPS.INTRO)
  }

  useEffect(() => {
    if (!session) return
    load()
  }, [session])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step progression helpers ──────────────────────────────────────────────

  function advance(options = {}) {
    const cd  = options.consentDone      ?? consentDone
    const dd  = options.demographicsDone ?? demographicsDone
    const ad  = options.avatarDone       ?? avatarDone
    const rnd = options.rippleNameDone   ?? rippleNameDone
    if (!cd)  return setStep(STEPS.CONSENT)
    if (!dd)  return setStep(STEPS.DEMOGRAPHICS)
    if (!ad)  return setStep(STEPS.CUSTOMIZE)
    if (!rnd) return setStep(STEPS.NAME)
    setStep(STEPS.CHECKIN)
  }

  // ── Consent submit ────────────────────────────────────────────────────────

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
    advance({ consentDone: true })
  }

  // ── Demographics submit ───────────────────────────────────────────────────

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
    advance({ demographicsDone: true })
  }

  // ── Customize submit ──────────────────────────────────────────────────────

  async function submitCustomize() {
    if (busy) return
    setBusy(true); setError(null)

    const { error: dbErr } = await supabase.from('avatars').upsert(
      { user_id: session.user.id, skin_color: skin.hex, eye_color: eye.hex, species: 'human' },
      { onConflict: 'user_id' }
    )

    setBusy(false)
    if (dbErr) { setError('Could not save your appearance — please try again.'); console.error('avatars upsert:', dbErr); return }

    setAvatarDone(true)
    advance({ avatarDone: true })
  }

  // ── Name submit ───────────────────────────────────────────────────────────

  async function submitName() {
    if (!rippleName.trim() || busy) return
    setBusy(true); setError(null)

    const { error: dbErr } = await supabase.from('ripples')
      .upsert({ user_id: session.user.id, name: rippleName.trim() }, { onConflict: 'user_id' })

    setBusy(false)
    if (dbErr) { setError('Could not save — please try again.'); console.error('ripples upsert:', dbErr); return }

    setRippleNameDone(true)
    advance({ rippleNameDone: true })
  }

  // ── Final: mark onboarding complete ──────────────────────────────────────

  async function finalFinish() {
    setBusy(true); setError(null)
    const userId = session.user.id

    // Ensure ripples row exists even if name was skipped
    await supabase.from('ripples')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

    const { error: profileErr } = await supabase.from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', userId)

    setBusy(false)
    if (profileErr) { setError('Something went wrong — please try again.'); console.error('profiles update:', profileErr); return }

    onComplete?.()
    navigate('/dashboard', { replace: true })
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
          <button style={S.btn} onClick={() => advance()}>Let&rsquo;s go →</button>
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

  if (step === STEPS.CUSTOMIZE) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <p style={S.eyebrow}>Almost there</p>
          <h1 style={S.title}>Choose a face</h1>
          <p style={S.body}>
            This is your Ripple. Pick a look that feels like you — more features
            unlock as you explore.
          </p>

          <div style={S.previewBox}>
            <RippleAvatar skinColor={skin.hex} eyeColor={eye.hex} size={180} />
          </div>

          <div style={S.pickerSection}>
            <p style={S.pickerLabel}>Skin · Fur · Scales</p>
            <div style={S.swatchRow}>
              {SKIN_COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setSkin(c)}
                  style={{
                    ...S.swatch,
                    background: c.hex,
                    border: skin.hex === c.hex ? '3px solid var(--pk)' : '3px solid transparent',
                    outline: skin.hex === c.hex ? '2px solid white' : 'none',
                    outlineOffset: '-4px',
                    transform: skin.hex === c.hex ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={S.pickerSection}>
            <p style={S.pickerLabel}>Eye color</p>
            <div style={S.swatchRow}>
              {EYE_COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setEye(c)}
                  style={{
                    ...S.swatch,
                    background: c.hex,
                    border: eye.hex === c.hex ? '3px solid var(--pk)' : '3px solid transparent',
                    outline: eye.hex === c.hex ? '2px solid white' : 'none',
                    outlineOffset: '-4px',
                    transform: eye.hex === c.hex ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {error && <p style={S.errBox}>{error}</p>}

          <button style={{ ...S.btn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={submitCustomize}>
            {busy ? 'Saving…' : 'Looks good →'}
          </button>
        </div>
      </div>
    )
  }

  if (step === STEPS.NAME) {
    const label = rippleName.trim() || 'your Ripple'
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <p style={S.eyebrow}>One last thing</p>
          <h1 style={S.title}>Name your Ripple</h1>
          <p style={S.body}>
            Give your Ripple a name — it&rsquo;s yours to change anytime.
          </p>

          <div style={S.previewBox}>
            <RippleAvatar skinColor={skin.hex} eyeColor={eye.hex} size={180} />
          </div>

          <div style={S.nameRow}>
            <input
              type="text"
              value={rippleName}
              onChange={e => setRippleName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitName()}
              placeholder="Your Ripple's name"
              style={S.input}
              maxLength={32}
              autoFocus
            />
            <button style={S.genBtn} onClick={() => setRippleName(pickRandom(rippleName))} title="Suggest another name">
              ✦
            </button>
          </div>

          {error && <p style={S.errBox}>{error}</p>}

          <button
            style={{ ...S.btn, opacity: (!rippleName.trim() || busy) ? 0.5 : 1 }}
            disabled={!rippleName.trim() || busy}
            onClick={submitName}
          >
            {busy ? 'Saving…' : `Meet ${label} →`}
          </button>
        </div>
      </div>
    )
  }

  if (step === STEPS.CHECKIN) {
    return (
      <div style={S.page}>
        <CheckinFlow session={session} context="onboarding" onComplete={finalFinish} />
      </div>
    )
  }

  return null
}

// ── DocBox ────────────────────────────────────────────────────────────────────
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

// ── Styles ────────────────────────────────────────────────────────────────────
const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
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
    flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--bd)',
    fontSize: 15, fontFamily: SANS, color: 'var(--tx)', background: 'var(--bg)',
  },
  radioRow:   { display: 'flex', gap: 20, flexWrap: 'wrap' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontFamily: SANS, color: 'var(--tx)', cursor: 'pointer' },
  ladderRow:  { display: 'flex', gap: 8, flexWrap: 'wrap' },
  ladderBtn: {
    width: 40, height: 40, borderRadius: 10, border: '1px solid var(--bd)',
    fontFamily: MONO, fontSize: 14, cursor: 'pointer', transition: 'background 0.1s',
  },

  previewBox: {
    alignSelf: 'center',
    background: 'var(--bgp)', borderRadius: 32, padding: 20,
    boxShadow: '0 8px 40px rgba(240,104,164,0.15)',
  },
  pickerSection: { display: 'flex', flexDirection: 'column', gap: 10 },
  pickerLabel: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--tx3)', margin: 0,
  },
  swatchRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', padding: 0,
    flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },

  nameRow: { display: 'flex', gap: 10, alignItems: 'center' },
  genBtn: {
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    border: '1px solid var(--bd)', background: 'var(--bgp)',
    color: 'var(--pk)', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
