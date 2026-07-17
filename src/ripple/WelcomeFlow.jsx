import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CONSENT_VERSION, TOS_VERSION, CONSENT_DOC, TOS_DOC } from './consentDocs'
import { SKIN_COLORS, EYE_COLORS } from '../components/Avatar/BaseAvatar'
import RippleAvatar from './RippleAvatar'
import Nav from '../components/Nav'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import FillableBox from '../components/ui/FillableBox'
import Checkbox from '../components/ui/Checkbox'
import OnboardingNavigation from '../components/ui/OnboardingNavigation'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import SecondaryCTA from '../components/ui/SecondaryCTA'

// ── WelcomeFlow ───────────────────────────────────────────────────────────────
// Route: /welcome — public-tier onboarding, rebuilt for Onboarding Redesign v1
// (Dev Spec §3.3; Figma 170:990 → 187:1927 → 187:2428 → 187:2743 → 187:2837).
// Structure: Welcome → 1/3 Data → 2/3 Demographics → 3/3 Ripple (customize +
// name COMBINED) → Finish. Check-in is no longer part of the mandatory flow —
// Finish offers it ("Check-in with [Name] →" → /checkin) beside Go to Dashboard.
// Every step is skipped when already satisfied, so the flow is safe to re-enter,
// and Previous across a saved step never double-writes (see submit guards).
// All DB writes are unchanged from WP1-3: versioned consents upsert,
// demographics insert, avatars/ripples upserts, profiles.onboarding_complete.

const STEPS = {
  LOADING:      'loading',
  WELCOME:      'welcome',
  DATA:         'data',
  DEMOGRAPHICS: 'demographics',
  RIPPLE:       'ripple',
  HABIT:        'habit',
  FINISH:       'finish',
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

// devInitialStep: DEV-only escape hatch for /dev/onboarding-preview — forces the
// flow to open on a given step so each screen can be eyeballed without a session.
export default function WelcomeFlow({ session, onComplete, devInitialStep }) {
  const navigate = useNavigate()

  const [step,  setStep]  = useState(STEPS.LOADING)
  const [error, setError] = useState(null)
  const [busy,  setBusy]  = useState(false)

  // Which steps are already satisfied
  const [consentDone,      setConsentDone]      = useState(false)
  const [demographicsDone, setDemographicsDone] = useState(false)
  const [rippleDone,       setRippleDone]       = useState(false) // avatar + name

  // Data step state
  const [agreedConsent, setAgreedConsent] = useState(false)
  const [agreedTos,     setAgreedTos]     = useState(false)

  // Demographics step state
  const [age,        setAge]        = useState('')
  const [gender,     setGender]     = useState('')
  const [racialized, setRacialized] = useState(null)
  const [sesLadder,  setSesLadder]  = useState(null)

  // Ripple step state (customize + name, one step per Dev Spec §4.3)
  const [skin,       setSkin]       = useState(SKIN_COLORS[1])  // Peach default
  const [eye,        setEye]        = useState(EYE_COLORS[3])   // Sky Blue default
  const [rippleName, setRippleName] = useState(() => pickRandom(''))

  // Habit step state (reminder prefs — Norm 2026-07-17: users start OPTED IN
  // to daily morning emails; this screen lets them opt out or change frequency/
  // time before finishing. Writes ripples.reminder_* + prompt_cadence, the
  // exact fields the live WP6 reminder engine reads.)
  const [remindersOn,  setRemindersOn]  = useState(true)
  const [reminderFreq, setReminderFreq] = useState('daily')   // 'daily' | 'weekly'
  const [reminderTime, setReminderTime] = useState('morning') // 'morning' | 'midday' | 'evening'

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
      supabase.from('ripples').select('name, reminder_enabled, reminder_time, prompt_cadence').eq('user_id', userId).maybeSingle(),
    ])

    const hasConsent = (consentRows ?? []).some(r => r.doc_type === 'consent' && r.version === CONSENT_VERSION)
    const hasTos     = (consentRows ?? []).some(r => r.doc_type === 'tos'     && r.version === TOS_VERSION)
    setConsentDone(hasConsent && hasTos)
    if (hasConsent && hasTos) { setAgreedConsent(true); setAgreedTos(true) }
    setDemographicsDone((demoRows ?? []).length > 0)

    if (existingAvatar) {
      const foundSkin = SKIN_COLORS.find(c => c.hex === existingAvatar.skin_color)
      const foundEye  = EYE_COLORS.find(c => c.hex === existingAvatar.eye_color)
      if (foundSkin) setSkin(foundSkin)
      if (foundEye)  setEye(foundEye)
    }
    if (rippleRow?.name) setRippleName(rippleRow.name)
    setRippleDone(!!existingAvatar && !!(rippleRow?.name))
    // Re-entry: reflect saved reminder prefs if the row has been through Habit
    // before (reminder_enabled defaults false in the DB, but the flow's default
    // is opted-in — only override when a deliberate choice was stored).
    if (rippleRow && rippleRow.reminder_enabled === true) {
      setRemindersOn(true)
      setReminderFreq(rippleRow.prompt_cadence === 'weekly' ? 'weekly' : 'daily')
      setReminderTime(rippleRow.reminder_time ?? 'morning')
    }

    setStep(import.meta.env.DEV && devInitialStep ? devInitialStep : STEPS.WELCOME)
  }

  useEffect(() => {
    if (!session) return
    load()
  }, [session])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step progression ──────────────────────────────────────────────────────

  function advance(options = {}) {
    const cd = options.consentDone      ?? consentDone
    const dd = options.demographicsDone ?? demographicsDone
    const rd = options.rippleDone       ?? rippleDone
    if (!cd) return setStep(STEPS.DATA)
    if (!dd) return setStep(STEPS.DEMOGRAPHICS)
    if (!rd) return setStep(STEPS.RIPPLE)
    // Habit has no persistent "done" flag — passing through again on re-entry
    // just shows the saved prefs, which is the desired behavior.
    setStep(STEPS.HABIT)
  }

  // ── Data (consent + ToS) submit ───────────────────────────────────────────

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
    setStep(STEPS.DEMOGRAPHICS)
  }

  // ── Demographics submit ───────────────────────────────────────────────────

  const canSubmitDemographics =
    age !== '' && parseInt(age) > 0 && gender.trim() !== '' && racialized !== null && sesLadder !== null

  async function submitDemographics() {
    // Revisited via Previous after a successful save → don't insert a second row
    if (demographicsDone) { setStep(STEPS.RIPPLE); return }
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
    setStep(STEPS.RIPPLE)
  }

  // ── Ripple submit (appearance + name together) ────────────────────────────

  async function submitRipple() {
    if (!rippleName.trim() || busy) return
    setBusy(true); setError(null)
    const userId = session.user.id

    const { error: avatarErr } = await supabase.from('avatars').upsert(
      { user_id: userId, skin_color: skin.hex, eye_color: eye.hex, species: 'human' },
      { onConflict: 'user_id' }
    )
    if (avatarErr) {
      setBusy(false)
      setError('Could not save your Ripple — please try again.'); console.error('avatars upsert:', avatarErr); return
    }

    const { error: nameErr } = await supabase.from('ripples')
      .upsert({ user_id: userId, name: rippleName.trim() }, { onConflict: 'user_id' })

    setBusy(false)
    if (nameErr) { setError('Could not save — please try again.'); console.error('ripples upsert:', nameErr); return }

    setRippleDone(true)
    setStep(STEPS.HABIT)
  }

  // ── Habit submit (reminder prefs) ─────────────────────────────────────────

  async function submitHabit() {
    if (busy) return
    setBusy(true); setError(null)

    // Opted out → reminder_enabled false, cadence untouched (prompt_cadence
    // also drives the on-site check-in prompt, which stays at its default).
    const patch = remindersOn
      ? { reminder_enabled: true, reminder_time: reminderTime, prompt_cadence: reminderFreq }
      : { reminder_enabled: false }

    const { error: dbErr } = await supabase.from('ripples')
      .update(patch).eq('user_id', session.user.id)

    setBusy(false)
    if (dbErr) { setError('Could not save your preferences — please try again.'); console.error('ripples reminder update:', dbErr); return }

    setStep(STEPS.FINISH)
  }

  // ── Finish: mark onboarding complete, then go where the user chose ────────

  async function finalFinish(dest) {
    if (busy) return
    setBusy(true); setError(null)
    const userId = session.user.id

    // Ensure ripples row exists even if something upstream was skipped
    await supabase.from('ripples')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

    const { error: profileErr } = await supabase.from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', userId)

    setBusy(false)
    if (profileErr) { setError('Something went wrong — please try again.'); console.error('profiles update:', profileErr); return }

    onComplete?.()
    navigate(dest, { replace: true })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const name = rippleName.trim() || 'your Ripple'

  return (
    <div style={S.page}>
      <Nav session={session} />
      <div style={S.wrap}>

        {step === STEPS.LOADING && <p style={S.muted}>Loading…</p>}

        {step === STEPS.WELCOME && (
          <>
            <EyebrowLabel variant="nobg">RADLAB GAMES PLATFORM</EyebrowLabel>
            <h1 style={S.title}>Welcome</h1>
            <div style={S.infoBox}>
              <p style={S.body}>
                When the water is still, you can see what&rsquo;s moving underneath.
                In a moment you&rsquo;ll meet your <strong>Ripple</strong> — a companion
                that reflects how you&rsquo;re doing, and a partner in noticing it.
              </p>
              <p style={S.body}>
                Two quick things first: how your data is used here, and a few
                questions about you.
              </p>
            </div>
            <OnboardingNavigation onNext={() => advance()} />
          </>
        )}

        {step === STEPS.DATA && (
          <>
            <EyebrowLabel variant="nobg">STEP 1 OF 3</EyebrowLabel>
            <h1 style={S.title}>Your data, plainly</h1>

            <DocPanel doc={CONSENT_DOC} agreed={agreedConsent} onToggle={setAgreedConsent} />
            <DocPanel doc={TOS_DOC}     agreed={agreedTos}     onToggle={setAgreedTos} />

            {error && <p style={S.errBox}>{error}</p>}

            <OnboardingNavigation
              onPrevious={() => setStep(STEPS.WELCOME)}
              onNext={submitConsent}
              nextDisabled={!agreedConsent || !agreedTos || busy}
              nextLabel={busy ? 'Saving…' : 'Agree & continue →'}
            />
          </>
        )}

        {step === STEPS.DEMOGRAPHICS && (
          <>
            <EyebrowLabel variant="nobg">STEP 2 OF 3</EyebrowLabel>
            <h1 style={S.title}>A little about you</h1>
            <p style={S.body}>
              These questions help our research account for how wellbeing differs
              across backgrounds. They&rsquo;re stored separately from your name.
            </p>

            <div style={S.fieldGrid}>
              <FillableBox
                label="Age"
                type="number" min="16" max="120"
                value={age} onChange={e => setAge(e.target.value)}
                disabled={demographicsDone}
              />
              <FillableBox
                label="Gender"
                type="text" placeholder="In your own words"
                value={gender} onChange={e => setGender(e.target.value)}
                disabled={demographicsDone}
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
                      disabled={demographicsDone}
                      style={{ accentColor: 'var(--pk)' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div style={S.field}>
              <label style={S.fieldLabel}>{SES_PROMPT}</label>
              {/* 1–10 scale: white (--bgc) fill so buttons stand out against the
                  --bg page (fields-invisible report, 2026-07-17); wraps on
                  narrow screens per the 2026-07-17 designer call. */}
              <div style={S.ladderRow}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    disabled={demographicsDone}
                    style={{
                      ...S.ladderBtn,
                      background:  sesLadder === n ? 'var(--pk)' : 'var(--bgc)',
                      borderColor: sesLadder === n ? 'var(--pk)' : 'var(--bds)',
                      color:       sesLadder === n ? '#fff'      : 'var(--tx)',
                    }}
                    onClick={() => setSesLadder(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p style={S.muted}>1 = bottom of the ladder · 10 = top</p>
            </div>

            {demographicsDone && <p style={S.muted}>Already saved — these answers can&rsquo;t be edited here.</p>}
            {error && <p style={S.errBox}>{error}</p>}

            <OnboardingNavigation
              onPrevious={() => setStep(STEPS.DATA)}
              onNext={submitDemographics}
              nextDisabled={(!demographicsDone && !canSubmitDemographics) || busy}
              nextLabel={busy ? 'Saving…' : 'Next →'}
            />
          </>
        )}

        {step === STEPS.RIPPLE && (
          <>
            <EyebrowLabel variant="nobg">STEP 3 OF 3</EyebrowLabel>
            <h1 style={S.title}>Meet your Ripple</h1>
            <p style={S.body}>
              This is your Ripple. Pick a look that feels like you — more features
              unlock as you explore — and give it a name. Yours to change anytime.
            </p>

            {/* Live Ripple customizer (WP2), NOT the Figma placeholder screenshots
                — brief guardrail #4 / Dev Spec §4.3 integration warning. */}
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

            <div style={S.nameRow}>
              <FillableBox
                label="Ripple name"
                placeholder="Your Ripple's name"
                value={rippleName}
                onChange={e => setRippleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitRipple()}
                maxLength={32}
                style={{ flex: 1 }}
              />
              <button style={S.genBtn} onClick={() => setRippleName(pickRandom(rippleName))} title="Suggest another name">
                ✦
              </button>
            </div>

            {error && <p style={S.errBox}>{error}</p>}

            <OnboardingNavigation
              onPrevious={() => setStep(STEPS.DEMOGRAPHICS)}
              onNext={submitRipple}
              nextDisabled={!rippleName.trim() || busy}
              nextLabel={busy ? 'Saving…' : 'Next →'}
            />
          </>
        )}

        {step === STEPS.HABIT && (
          <>
            {/* Reminder prefs — added per Norm 2026-07-17, not in the Figma file.
                Copy honors the Ripple spec §5 guardrails: no guilt/neediness
                levers; frames rhythm as serving reflection, user in control. */}
            <EyebrowLabel variant="nobg">ONE SMALL THING</EyebrowLabel>
            <h1 style={S.title}>Reflection works in rhythms</h1>
            <p style={S.body}>
              {name} reflects you best when check-ins happen regularly — a minute
              most days is plenty. To help the habit take hold, we&rsquo;ll send a
              gentle morning email reminder. You&rsquo;re in control: adjust or turn
              it off here, or later from your profile.
            </p>

            <div style={S.habitCard}>
              <Checkbox checked={remindersOn} onChange={e => setRemindersOn(e.target.checked)}>
                Email me check-in reminders
              </Checkbox>

              {remindersOn && (
                <>
                  <div style={S.habitGroup}>
                    <p style={S.pickerLabel}>How often</p>
                    <div style={S.pillRow}>
                      {[['daily', 'Daily'], ['weekly', 'Weekly']].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setReminderFreq(val)}
                          style={{
                            ...S.pillBtn,
                            background:  reminderFreq === val ? 'var(--pk)' : 'var(--bg)',
                            borderColor: reminderFreq === val ? 'var(--pk)' : 'var(--bgp)',
                            color:       reminderFreq === val ? '#fff'      : 'var(--tx)',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={S.habitGroup}>
                    <p style={S.pickerLabel}>Time of day</p>
                    <div style={S.pillRow}>
                      {[['morning', 'Morning'], ['midday', 'Midday'], ['evening', 'Evening']].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setReminderTime(val)}
                          style={{
                            ...S.pillBtn,
                            background:  reminderTime === val ? 'var(--pk)' : 'var(--bg)',
                            borderColor: reminderTime === val ? 'var(--pk)' : 'var(--bgp)',
                            color:       reminderTime === val ? '#fff'      : 'var(--tx)',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!remindersOn && (
                <p style={S.muted}>No emails — {name} will simply be here when you visit.</p>
              )}
            </div>

            {error && <p style={S.errBox}>{error}</p>}

            <OnboardingNavigation
              onPrevious={() => setStep(STEPS.RIPPLE)}
              onNext={submitHabit}
              nextDisabled={busy}
              nextLabel={busy ? 'Saving…' : 'Next →'}
            />
          </>
        )}

        {step === STEPS.FINISH && (
          <>
            <EyebrowLabel variant="nobg">WELCOME ABOARD</EyebrowLabel>
            <h1 style={S.title}>You&rsquo;re all set</h1>
            <div style={S.finishRow}>
              <div style={S.previewBox}>
                <RippleAvatar skinColor={skin.hex} eyeColor={eye.hex} size={140} />
              </div>
              <p style={{ ...S.body, flex: 1, minWidth: 220 }}>
                Time for you and your Ripple to start exploring. Complete a
                check-in now, or take a look at our platform and games at your
                own pace.
              </p>
            </div>

            {error && <p style={S.errBox}>{error}</p>}

            <div style={S.finishCtas}>
              <SecondaryCTA onClick={() => finalFinish('/dashboard')}>Go to Dashboard</SecondaryCTA>
              <PrimaryCTA onClick={() => finalFinish('/checkin')} disabled={busy}>
                {busy ? 'One sec…' : `Check-in with ${name} →`}
              </PrimaryCTA>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ── DocPanel ──────────────────────────────────────────────────────────────────
// Scrollable doc panel + consent checkbox right-aligned below it, lining up
// with the Agree & continue button (Dev Spec §4.3; Figma 187:1927).
function DocPanel({ doc, agreed, onToggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={S.docBox}>
        <h2 style={S.docTitle}>{doc.title}</h2>
        {doc.paragraphs.map((p, i) => <p key={i} style={S.docPara}>{p}</p>)}
      </div>
      <label style={S.checkRow}>
        <span style={S.checkLabel}>{doc.checkboxLabel}</span>
        <Checkbox checked={agreed} onChange={e => onToggle(e.target.checked)} />
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
    maxWidth: 840, margin: '0 auto', padding: '40px 24px 80px',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16,
  },
  title: {
    fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(28px, 4vw, 36px)',
    lineHeight: 1.5, color: 'var(--tx)', margin: 0,
  },
  body: { fontSize: 16, color: 'var(--tx)', lineHeight: 1.5, margin: 0, fontFamily: SANS },
  infoBox: { display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12, width: '100%' },

  docBox: {
    border: '1px solid var(--bgp)', borderRadius: 12,
    background: 'var(--bgc)', maxHeight: 280, overflowY: 'auto',
    padding: '20px 24px', width: '100%', boxSizing: 'border-box',
    boxShadow: 'inset 0 -24px 20px -20px rgba(0,0,0,0.04)',
  },
  docTitle: { fontFamily: MONO, fontWeight: 400, fontSize: 16, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx)', margin: '0 0 12px' },
  docPara:  { fontSize: 16, lineHeight: 1.5, color: 'var(--tx)', fontFamily: SANS, margin: '0 0 12px' },

  // Consent row: label left, box right — right-aligned as a group so the
  // checkboxes line up with the Agree & continue button (Dev Spec §4.3).
  checkRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    alignSelf: 'flex-end', minHeight: 44, cursor: 'pointer', userSelect: 'none',
  },
  checkLabel: { fontSize: 12, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.5, fontFamily: SANS, textAlign: 'right' },

  fieldGrid:  { display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' },
  field:      { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  fieldLabel: { fontSize: 14, color: 'var(--tx)', fontFamily: SANS, fontWeight: 600, lineHeight: 1.5 },
  radioRow:   { display: 'flex', gap: 20, flexWrap: 'wrap' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontFamily: SANS, color: 'var(--tx)', cursor: 'pointer', minHeight: 40 },
  ladderRow:  { display: 'flex', gap: 8, flexWrap: 'wrap' },
  ladderBtn: {
    width: 40, height: 40, borderRadius: 12, border: '1px solid var(--bgp)',
    fontFamily: MONO, fontSize: 14, cursor: 'pointer', transition: 'background 0.1s',
  },

  previewBox: {
    alignSelf: 'center',
    background: 'var(--bgp)', borderRadius: 32, padding: 20,
    boxShadow: '0 8px 40px rgba(240,104,164,0.15)',
  },
  pickerSection: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%' },
  pickerLabel: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--gy)', margin: 0,
  },
  swatchRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', padding: 0,
    flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },

  nameRow: { display: 'flex', gap: 10, alignItems: 'flex-end', width: '100%', maxWidth: 420 },
  genBtn: {
    width: 40, height: 40, borderRadius: 24, flexShrink: 0, // clickable → 24px rule
    border: '1px solid var(--bgp)', background: 'var(--bgp)',
    color: 'var(--pk)', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  habitCard: {
    display: 'flex', flexDirection: 'column', gap: 16,
    background: 'var(--bgc)', border: '1px solid var(--bgp)', borderRadius: 12,
    padding: '16px 24px', width: '100%', boxSizing: 'border-box',
  },
  habitGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  pillRow:    { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pillBtn: {
    padding: '8px 20px', borderRadius: 24, border: '1px solid var(--bgp)',
    fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    transition: 'background 0.1s',
  },

  finishRow:  { display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', width: '100%' },
  finishCtas: { display: 'flex', gap: 12, flexWrap: 'wrap', alignSelf: 'stretch', justifyContent: 'flex-end' },

  muted:  { fontSize: 13, color: 'var(--gy)', margin: 0, fontFamily: SANS },
  errBox: {
    fontSize: 13, color: 'var(--err-tx)', background: 'var(--err-bg)',
    border: '1px solid var(--err-bd)', borderRadius: 12, padding: '10px 16px', margin: 0,
    width: '100%', boxSizing: 'border-box',
  },
}
