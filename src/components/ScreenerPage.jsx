import { useState, useEffect, useRef } from 'react'
import { evaluatePhase2 } from '../lib/screenerUtils'
import QuestionnaireRenderer from './questionnaire/QuestionnaireRenderer'

// ── ScreenerPage ───────────────────────────────────────────────────────────────
//
// Pre-consent gate. Phase 1: eligibility criteria (custom UI). Phase 2: two
// questionnaires rendered via QuestionnaireRenderer (same component as session
// steps). On pass, answers are buffered to sessionStorage keyed by study+participant.
// SessionEntry flushes that buffer to questionnaire_responses after consent is
// confirmed; the browser clears it automatically if consent is never given.
//
// Props:
//   study           — { id, screener }
//   participant     — { id }
//   supabaseClient  — participant-authenticated Supabase client
//   onPass          — () => void
//   onFail          — () => void
//   previewMode     — bool — skips DB writes and sessionStorage when true

const GREEN  = '#639922'
const RED_BG = '#fff3f3'

const DEFAULT_SCALE = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
]

const PHASE_META = {
  description: { step: 'Step 1 of 4', prog: 25,  title: 'Study Overview',       sub: 'Please read carefully before continuing' },
  eligibility:  { step: 'Step 2 of 4', prog: 50,  title: 'Eligibility Criteria', sub: 'Please answer Yes or No to each statement' },
  outcome:      { step: 'Step 4 of 4', prog: 100, title: 'Screening Result',     sub: '' },
}

export default function ScreenerPage({ study, participant, supabaseClient, onPass, onFail, previewMode = false }) {
  const screener    = study.screener
  const phase2Slugs = screener?.phase2?.questionnaires ?? []
  const gad7Slug    = phase2Slugs[0]?.questionnaire_slug ?? 'gad-7'
  const phq8Slug    = phase2Slugs[1]?.questionnaire_slug ?? 'phq-8'

  const [phase,         setPhase]         = useState('description')
  const [eligAnswers,   setEligAnswers]   = useState({})
  const [eligResult,    setEligResult]    = useState(null)
  const [gad7Def,       setGad7Def]       = useState(null)
  const [phq8Def,       setPhq8Def]       = useState(null)
  const [outcome,       setOutcome]       = useState(null)
  const [saving,        setSaving]        = useState(false)

  // gad7 responses held in a ref so phq8's onComplete closure always reads the
  // current value without stale-closure risk across the phase transition render.
  const gad7ResponsesRef = useRef(null)

  const meta = PHASE_META[phase] ?? { step: 'Step 3 of 4', prog: 75 }

  // Pre-load questionnaire definitions so there's no lag when phase 2 starts.
  useEffect(() => {
    Promise.all([
      supabaseClient.from('questionnaires').select('definition').eq('slug', gad7Slug).single(),
      supabaseClient.from('questionnaires').select('definition').eq('slug', phq8Slug).single(),
    ]).then(([r1, r2]) => {
      if (r1.data?.definition) setGad7Def(r1.data.definition)
      if (r2.data?.definition) setPhq8Def(r2.data.definition)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 1: eligibility ───────────────────────────────────────────────────

  function setEligAnswer(idx, val) {
    setEligAnswers(prev => ({ ...prev, [idx]: val }))
    if (eligResult === 'pass') setEligResult(null)
  }

  const phase1Items     = screener?.phase1?.items ?? []
  const allEligAnswered = phase1Items.length > 0 && Object.keys(eligAnswers).length === phase1Items.length

  function checkEligibility() {
    const allYes = phase1Items.every((_, i) => eligAnswers[i] === 'yes')
    if (allYes) {
      setEligResult('pass')
    } else {
      saveResult(false, null, null)
      setOutcome('fail_phase1')
      setPhase('outcome')
    }
  }

  // ── Phase 2: questionnaires ────────────────────────────────────────────────

  function handleGad7Complete({ responses }) {
    gad7ResponsesRef.current = responses
    setPhase('phq8')
  }

  async function handlePhq8Complete({ responses }) {
    await submitPhase2(gad7ResponsesRef.current, responses)
  }

  async function submitPhase2(gad7R, phq8R) {
    const result = evaluatePhase2(gad7R, phq8R)
    setOutcome(result)
    setPhase('outcome')
    await saveResult(true, result === 'pass', result)

    if (result === 'pass' && !previewMode) {
      try {
        sessionStorage.setItem(
          `screener_draft_${study.id}_${participant.id}`,
          JSON.stringify({
            completedAt: new Date().toISOString(),
            questionnaires: [
              { slug: gad7Slug, responses: gad7R },
              { slug: phq8Slug, responses: phq8R },
            ],
          })
        )
      } catch (e) {
        console.warn('[Screener] sessionStorage write failed:', e)
      }
    }
  }

  // ── Data persistence ───────────────────────────────────────────────────────

  async function saveResult(phase1Passed, phase2Passed, phase2Outcome) {
    if (previewMode) return
    setSaving(true)
    try {
      await supabaseClient.from('screener_results').upsert(
        {
          participant_id: participant.id,
          study_id:       study.id,
          screened_at:    new Date().toISOString(),
          phase1_passed:  phase1Passed,
          phase2_passed:  phase1Passed ? phase2Passed : null,
          phase2_outcome: phase1Passed ? phase2Outcome : null,
        },
        { onConflict: 'participant_id,study_id' }
      )
    } catch (err) {
      console.error('[Screener] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Outcome content ────────────────────────────────────────────────────────

  function getOutcomeContent() {
    const resources = screener?.resources ?? []
    if (outcome === 'fail_phase1') {
      const fm = screener?.phase1?.fail_message ?? {}
      return {
        cardStyle: { background: '#faf6ed', border: '1.5px solid #e8d5a3' },
        icon: '⚠️',
        heading: fm.heading ?? 'Thank you for your interest — this study may not be the right fit for you at this time.',
        body:    fm.body    ?? 'Based on your responses, you do not meet the eligibility criteria for this study.',
        showResources: true, showContinue: false, resources,
      }
    }
    const outcomes = screener?.phase2?.outcomes ?? {}
    if (outcome === 'pass') {
      const o = outcomes.pass ?? {}
      return {
        cardStyle: { background: '#f0f7eb', border: '1.5px solid #b8d9a0' },
        icon: '✅',
        heading: o.heading ?? 'You appear to be a good candidate for this study.',
        body:    o.body    ?? 'Based on your responses, you seem to be experiencing a level of emotional distress that this study is designed to support. Press Next to continue to the consent form and baseline survey.',
        showResources: false, showContinue: true, resources: [],
      }
    }
    if (outcome === 'fail_low') {
      const o = outcomes.fail_low ?? {}
      return {
        cardStyle: { background: '#faf6ed', border: '1.5px solid #e8d5a3' },
        icon: '🌿',
        heading: o.heading ?? 'You appear to be coping well with everyday demands.',
        body:    o.body    ?? 'This study is designed for people experiencing a moderate level of emotional distress, and your responses suggest that may not apply to you right now.',
        showResources: true, showContinue: false, resources,
      }
    }
    if (outcome === 'fail_high') {
      const o = outcomes.fail_high ?? {}
      return {
        cardStyle: { background: RED_BG, border: '1.5px solid #f5c6c6' },
        icon: '💙',
        heading: o.heading ?? 'It sounds like you may be going through a particularly difficult time.',
        body:    o.body    ?? 'We want to make sure you have the right level of support. Because this study is not a substitute for professional mental health care, we are not able to enroll participants who are currently experiencing high levels of distress.',
        showResources: true, showContinue: false, resources,
      }
    }
    return { cardStyle: {}, icon: '', heading: '', body: '', showResources: false, showContinue: false, resources: [] }
  }

  // ── Phase 2 renders standalone — QuestionnaireRenderer is the viewport ─────
  // (its fixed bottom bar and sticky ProgressLabel expect to own the scroll root)

  if (phase === 'gad7') {
    if (!gad7Def) return <div style={S.loading}>Loading questionnaire…</div>
    return (
      <QuestionnaireRenderer
        questionnaire={gad7Def}
        partNumber={1}
        totalParts={2}
        onComplete={handleGad7Complete}
        onBack={() => { gad7ResponsesRef.current = null; setEligResult(null); setPhase('eligibility') }}
      />
    )
  }

  if (phase === 'phq8') {
    if (!phq8Def) return <div style={S.loading}>Loading questionnaire…</div>
    return (
      <QuestionnaireRenderer
        questionnaire={phq8Def}
        partNumber={2}
        totalParts={2}
        onComplete={handlePhq8Complete}
        onBack={() => { gad7ResponsesRef.current = null; setPhase('gad7') }}
      />
    )
  }

  // ── All other phases: screener chrome ──────────────────────────────────────

  function renderDescription() {
    const desc = screener?.description
    return (
      <div style={S.content}>
        {desc ? (
          <>
            {desc.part_label && <div style={S.partLabel}>{desc.part_label}</div>}
            {(desc.intro ?? []).map((p, i) => (
              <p key={i} style={{ ...S.introText, marginTop: i === 0 ? 6 : 0 }}>{p}</p>
            ))}
            {(desc.steps ?? []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {desc.steps.map((text, i) => (
                  <div key={i} style={S.studyStep}>
                    <div style={S.stepNum}>{i + 1}</div>
                    <div style={S.stepText} dangerouslySetInnerHTML={{ __html: text }} />
                  </div>
                ))}
              </div>
            )}
            {(desc.info_boxes ?? []).map((box, i) => (
              <div key={i} style={S.infoBox} dangerouslySetInnerHTML={{ __html: box }} />
            ))}
          </>
        ) : (
          <p style={S.introText}>
            Before beginning, please read the information below about how this study works and what will be asked of you.
          </p>
        )}
      </div>
    )
  }

  function renderEligibility() {
    return (
      <div style={S.content}>
        <div style={S.partLabel}>Eligibility Criteria</div>
        <p style={{ ...S.introText, marginTop: 6 }}>
          {screener?.phase1?.instruction ?? 'Please indicate whether each of the following statements applies to you. You must answer Yes to all items to be eligible.'}
        </p>
        {phase1Items.map((item, i) => {
          const val = eligAnswers[i]
          return (
            <div key={item.id ?? i} style={{
              ...S.eligItem,
              background:  val === 'yes' ? '#f0f7eb' : val === 'no' ? RED_BG : '#fff',
              borderColor: val === 'yes' ? GREEN     : val === 'no' ? '#e57373' : '#e0ddd8',
            }}>
              <div style={S.eligNum}>{i + 1}</div>
              <div style={S.eligText}>{item.text}</div>
              <div style={S.eligBtns}>
                <button onClick={() => setEligAnswer(i, 'yes')} style={{ ...S.eligBtn, ...(val === 'yes' ? S.eligBtnYesActive : S.eligBtnYes) }}>Yes</button>
                <button onClick={() => setEligAnswer(i, 'no')}  style={{ ...S.eligBtn, ...(val === 'no'  ? S.eligBtnNoActive  : S.eligBtnNo)  }}>No</button>
              </div>
            </div>
          )
        })}
        {eligResult === 'pass' && (
          <div style={{ ...S.statusBanner, background: '#f0f7eb', border: '1px solid #b8d9a0', color: '#2c5c0a' }}>
            <strong>✓ &nbsp;You appear to meet the eligibility criteria.</strong><br />
            You will now complete a brief questionnaire about your emotional well-being. This helps us ensure the study is the right fit for you at this time.
          </div>
        )}
      </div>
    )
  }

  function renderOutcome() {
    const { cardStyle, icon, heading, body, showResources, showContinue, resources } = getOutcomeContent()
    return (
      <div style={S.content}>
        <div style={{ ...S.outcomeCard, ...cardStyle }}>
          <div style={S.outcomeIcon}>{icon}</div>
          <div style={S.outcomeHeading}>{heading}</div>
          <div style={S.outcomeBody}>{body}</div>
        </div>
        {showResources && resources.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={S.resourcesHeading}>Support Resources</div>
            {resources.map((r, i) => (
              <div key={i} style={S.resourceItem}>
                <span style={S.resourceName}>{r.name}</span>
                <span style={S.resourceContact}>{r.contact}</span>
              </div>
            ))}
          </div>
        )}
        {showContinue && (
          <div style={S.footer}>
            <button onClick={onPass} disabled={saving} style={S.btnProceed}>
              Continue to Consent Form ›
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderFooter() {
    if (phase === 'outcome') return null

    if (phase === 'description') {
      return (
        <div style={S.footer}>
          <button onClick={() => setPhase('eligibility')} style={S.btnNext}>Next →</button>
        </div>
      )
    }

    if (phase === 'eligibility') {
      if (eligResult === 'pass') {
        return (
          <div style={S.footer}>
            <button onClick={() => setPhase('gad7')} style={S.btnProceed}>
              Continue to Pre-Screening ›
            </button>
          </div>
        )
      }
      return (
        <div style={S.footer}>
          <button
            onClick={checkEligibility}
            disabled={!allEligAnswered}
            style={{ ...S.btnNext, ...(allEligAnswered ? {} : S.btnDisabled) }}
          >
            Check Eligibility
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <div style={S.topBadge}>
          <span style={S.topBadgeDot} />
          Pre-Consent Screener
        </div>
        <span style={S.stepIndicator}>{meta.step}</span>
      </div>

      <div style={S.progressWrap}>
        <div style={{ ...S.progressFill, width: `${meta.prog}%` }} />
      </div>

      <div style={S.header}>
        <div style={S.pageTitle}>{meta.title}</div>
        {meta.sub && <div style={S.pageSubtitle}>{meta.sub}</div>}
      </div>

      <div style={S.scrollArea}>
        {phase === 'description' && renderDescription()}
        {phase === 'eligibility' && renderEligibility()}
        {phase === 'outcome'     && renderOutcome()}
      </div>

      {renderFooter()}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page:         { background: '#fff', width: '100%', maxWidth: 680, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"DM Sans", system-ui, sans-serif' },
  topBar:       { background: '#f0ede8', borderBottom: '1px solid #e0ddd8', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  topBadge:     { fontSize: 11, fontFamily: '"Space Mono", monospace', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 },
  topBadgeDot:  { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#639922' },
  stepIndicator:{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: '#888780', fontWeight: 500 },
  progressWrap: { height: 4, background: '#e0ddd8', flexShrink: 0 },
  progressFill: { height: '100%', background: '#639922', transition: 'width 0.4s' },
  header:       { padding: '20px 24px 16px', borderBottom: '1px solid #ebe8e3', flexShrink: 0 },
  pageTitle:    { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 21, fontWeight: 700, color: 'var(--tx, #1c1c1e)' },
  pageSubtitle: { fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, color: '#888780', marginTop: 3 },
  scrollArea:   { flex: 1, overflowY: 'auto' },
  content:      { padding: 24 },
  partLabel:    { fontSize: 13, fontWeight: 700, color: 'var(--tx, #1c1c1e)', padding: '10px 14px', background: '#f5f4f0', borderLeft: `3px solid ${GREEN}`, borderRadius: '0 6px 6px 0', marginBottom: 16 },
  introText:    { fontSize: 14, lineHeight: 1.75, color: '#2c2c2a', marginBottom: 16 },
  studyStep:    { display: 'flex', gap: 12, padding: '11px 14px', border: '1px solid #ebe8e3', borderRadius: 8, marginBottom: 8, background: '#fff' },
  stepNum:      { width: 24, height: 24, borderRadius: '50%', background: '#f0ede8', fontSize: 11, fontFamily: '"Space Mono", monospace', fontWeight: 700, color: '#5f5e5a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepText:     { fontSize: 13, lineHeight: 1.6, color: '#2c2c2a' },
  infoBox:      { background: '#faf9f7', border: '1px solid #e0ddd8', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: '#5f5e5a' },
  eligItem:     { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: '1.5px solid #e0ddd8', borderRadius: 10, marginBottom: 8, transition: 'border-color 0.15s, background 0.15s' },
  eligNum:      { fontFamily: '"Space Mono", monospace', fontSize: 12, fontWeight: 700, color: '#a09d98', flexShrink: 0, width: 20, paddingTop: 1 },
  eligText:     { fontSize: 13, lineHeight: 1.55, color: '#2c2c2a', flex: 1 },
  eligBtns:     { display: 'flex', gap: 6, flexShrink: 0, marginLeft: 'auto', paddingLeft: 10 },
  eligBtn:      { width: 36, height: 28, borderRadius: 6, border: '1.5px solid #e0ddd8', background: '#f5f4f0', fontSize: 11, fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' },
  eligBtnYes:       { color: '#3b6d11' },
  eligBtnYesActive: { background: GREEN, borderColor: GREEN, color: '#fff' },
  eligBtnNo:        { color: '#c0392b' },
  eligBtnNoActive:  { background: '#e57373', borderColor: '#e57373', color: '#fff' },
  statusBanner: { borderRadius: 10, padding: '14px 16px', marginTop: 12, fontSize: 13, lineHeight: 1.6 },
  outcomeCard:     { borderRadius: 12, padding: 20, marginBottom: 8 },
  outcomeIcon:     { fontSize: 36, textAlign: 'center', marginBottom: 14 },
  outcomeHeading:  { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 19, fontWeight: 700, color: 'var(--tx, #1c1c1e)', lineHeight: 1.4, marginBottom: 12 },
  outcomeBody:     { fontSize: 14, lineHeight: 1.75, color: '#2c2c2a' },
  resourcesHeading:{ fontFamily: '"Space Mono", monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5f5e5a', marginBottom: 10 },
  resourceItem:    { display: 'flex', flexDirection: 'column', padding: '10px 12px', border: '1px solid #e0ddd8', borderRadius: 8, marginBottom: 6, background: '#fff' },
  resourceName:    { fontSize: 13, fontWeight: 600, color: 'var(--tx, #1c1c1e)' },
  resourceContact: { fontSize: 12, color: '#5f5e5a', marginTop: 2, fontFamily: '"Space Mono", monospace' },
  footer:       { padding: '16px 24px 28px', borderTop: '1px solid #ebe8e3', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  btnNext:      { width: '100%', border: 'none', borderRadius: 8, padding: '14px 24px', fontSize: 15, fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 500, cursor: 'pointer', background: '#2c2c2a', color: '#fff', transition: 'background 0.15s' },
  btnProceed:   { width: '100%', border: 'none', borderRadius: 8, padding: '14px 24px', fontSize: 15, fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 500, cursor: 'pointer', background: '#3b6d11', color: '#fff', transition: 'background 0.15s' },
  btnDisabled:  { background: '#c8c5c0', cursor: 'default' },
  loading:      { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
}
