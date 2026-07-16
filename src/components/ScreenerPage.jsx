import { useState, useEffect, useRef } from 'react'
import { evaluateScreenerPhase2 } from '../lib/screenerUtils'
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
  // Ordered phase-2 questionnaires (1 or 2). Zerin: [phq-8]; Liliana: [gad-7, phq-8].
  const phase2Slugs = (screener?.phase2?.questionnaires ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(q => q.questionnaire_slug)

  const [phase,         setPhase]         = useState('description')
  const [eligAnswers,   setEligAnswers]   = useState({})
  const [eligResult,    setEligResult]    = useState(null)
  const [q2Defs,        setQ2Defs]        = useState([])   // definitions aligned to phase2Slugs
  const [q2Index,       setQ2Index]       = useState(0)    // which phase-2 questionnaire is showing
  const [outcome,       setOutcome]       = useState(null)
  const [saving,        setSaving]        = useState(false)

  // Phase-2 responses accumulate here (keyed by slug) so each questionnaire's
  // onComplete closure reads a stable ref across phase-transition renders.
  const q2ResponsesRef = useRef({})

  const meta = PHASE_META[phase] ?? { step: 'Step 3 of 4', prog: 75 }

  // Pre-load questionnaire definitions so there's no lag when phase 2 starts.
  useEffect(() => {
    if (phase2Slugs.length === 0) return
    Promise.all(
      phase2Slugs.map(slug =>
        supabaseClient.from('questionnaires').select('definition').eq('slug', slug).single()
      )
    ).then(results => {
      setQ2Defs(results.map(r => r.data?.definition ?? null))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 1: eligibility ───────────────────────────────────────────────────

  function setEligAnswer(idx, val) {
    setEligAnswers(prev => ({ ...prev, [idx]: val }))
    if (eligResult === 'pass') setEligResult(null)
  }

  const phase1Items     = screener?.phase1?.items ?? []
  const allEligAnswered = phase1Items.length > 0 && Object.keys(eligAnswers).length === phase1Items.length

  // A phase-1 item passes on its `pass_answer` (default 'yes'). Items that opt
  // into an "unsure" option (Zerin distress safety gate) treat 'unsure' as a
  // pass-through by default — the participant continues and the answer is
  // recorded for follow-up — unless the item sets unsure_action: 'stop'.
  function itemPasses(item, answer) {
    const passAnswer = item.pass_answer ?? 'yes'
    if (answer === passAnswer) return true
    if (answer === 'unsure' && item.unsure && (item.unsure_action ?? 'continue') === 'continue') return true
    return false
  }

  function checkEligibility() {
    const allPass = phase1Items.every((item, i) => itemPasses(item, eligAnswers[i]))
    if (allPass) {
      setEligResult('pass')
    } else {
      saveResult(false, null, null)
      setOutcome('fail_phase1')
      setPhase('outcome')
    }
  }

  // ── Phase 2: questionnaires (index-driven over phase2Slugs) ─────────────────

  async function handleQuestionnaireComplete({ responses }) {
    const slug = phase2Slugs[q2Index]
    q2ResponsesRef.current = { ...q2ResponsesRef.current, [slug]: responses }
    if (q2Index < phase2Slugs.length - 1) {
      setQ2Index(q2Index + 1)
    } else {
      await submitPhase2(q2ResponsesRef.current)
    }
  }

  async function submitPhase2(responsesBySlug) {
    const result = evaluateScreenerPhase2(responsesBySlug, screener?.phase2)
    setOutcome(result)
    setPhase('outcome')
    await saveResult(true, result === 'pass', result)

    if (result === 'pass' && !previewMode) {
      try {
        sessionStorage.setItem(
          `screener_draft_${study.id}_${participant.id}`,
          JSON.stringify({
            completedAt: new Date().toISOString(),
            questionnaires: phase2Slugs.map(slug => ({ slug, responses: responsesBySlug[slug] })),
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
    const phase1Answers = phase1Items.map((item, i) => ({
      id:     item.id ?? String(i),
      text:   item.text,
      answer: eligAnswers[i] ?? null,
    }))
    try {
      await supabaseClient.from('screener_results').upsert(
        {
          participant_id: participant.id,
          study_id:       study.id,
          screened_at:    new Date().toISOString(),
          phase1_passed:  phase1Passed,
          phase2_passed:  phase1Passed ? phase2Passed : null,
          phase2_outcome: phase1Passed ? phase2Outcome : null,
          phase1_answers: phase1Answers,
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

  if (phase === 'phase2') {
    const def = q2Defs[q2Index]
    if (!def) return <div style={S.loading}>Loading questionnaire…</div>
    return (
      <QuestionnaireRenderer
        key={`screener-q2-${q2Index}`}
        questionnaire={def}
        partNumber={q2Index + 1}
        totalParts={phase2Slugs.length}
        onComplete={handleQuestionnaireComplete}
        onBack={() => {
          if (q2Index > 0) {
            setQ2Index(q2Index - 1)
          } else {
            q2ResponsesRef.current = {}
            setEligResult(null)
            setPhase('eligibility')
          }
        }}
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
          // An answered item is highlighted green when it passes, red/amber when it
          // doesn't — regardless of whether the passing answer is Yes or No.
          const passes = val != null && itemPasses(item, val)
          const isUnsure = val === 'unsure'
          return (
            <div key={item.id ?? i} style={{
              ...S.eligItem,
              background:  val == null ? '#fff'  : isUnsure ? '#fbf6e9' : passes ? '#f0f7eb' : RED_BG,
              borderColor: val == null ? '#e0ddd8' : isUnsure ? '#e0c169' : passes ? GREEN : '#e57373',
            }}>
              <div style={S.eligNum}>{i + 1}</div>
              <div style={S.eligText}>{item.text}</div>
              <div style={S.eligBtns}>
                <button onClick={() => setEligAnswer(i, 'yes')} style={{ ...S.eligBtn, ...(val === 'yes' ? S.eligBtnYesActive : S.eligBtnYes) }}>Yes</button>
                <button onClick={() => setEligAnswer(i, 'no')}  style={{ ...S.eligBtn, ...(val === 'no'  ? S.eligBtnNoActive  : S.eligBtnNo)  }}>No</button>
                {item.unsure && (
                  <button onClick={() => setEligAnswer(i, 'unsure')} style={{ ...S.eligBtn, ...S.eligBtnUnsure, ...(val === 'unsure' ? S.eligBtnUnsureActive : {}) }}>Unsure</button>
                )}
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
            <button onClick={() => { setQ2Index(0); setPhase('phase2') }} style={S.btnProceed}>
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
  stepIndicator:{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: '#888780', fontWeight: 600 },
  progressWrap: { height: 4, background: '#e0ddd8', flexShrink: 0 },
  progressFill: { height: '100%', background: '#639922', transition: 'width 0.4s' },
  header:       { padding: '20px 24px 16px', borderBottom: '1px solid #ebe8e3', flexShrink: 0 },
  pageTitle:    { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 21, fontWeight: 400, color: 'var(--tx, #1c1c1e)' },
  pageSubtitle: { fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, color: '#888780', marginTop: 3 },
  scrollArea:   { flex: 1, overflowY: 'auto' },
  content:      { padding: 24 },
  partLabel:    { fontSize: 13, fontWeight: 600, color: 'var(--tx, #1c1c1e)', padding: '10px 14px', background: '#f5f4f0', borderLeft: `3px solid ${GREEN}`, borderRadius: '0 6px 6px 0', marginBottom: 16 },
  introText:    { fontSize: 14, lineHeight: 1.75, color: '#2c2c2a', marginBottom: 16 },
  studyStep:    { display: 'flex', gap: 12, padding: '11px 14px', border: '1px solid #ebe8e3', borderRadius: 8, marginBottom: 8, background: '#fff' },
  stepNum:      { width: 24, height: 24, borderRadius: '50%', background: '#f0ede8', fontSize: 11, fontFamily: '"Space Mono", monospace', fontWeight: 700, color: '#5f5e5a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepText:     { fontSize: 13, lineHeight: 1.6, color: '#2c2c2a' },
  infoBox:      { background: '#faf9f7', border: '1px solid #e0ddd8', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: '#5f5e5a' },
  eligItem:     { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: '1.5px solid #e0ddd8', borderRadius: 10, marginBottom: 8, transition: 'border-color 0.15s, background 0.15s' },
  eligNum:      { fontFamily: '"Space Mono", monospace', fontSize: 12, fontWeight: 700, color: '#a09d98', flexShrink: 0, width: 20, paddingTop: 1 },
  eligText:     { fontSize: 13, lineHeight: 1.55, color: '#2c2c2a', flex: 1 },
  eligBtns:     { display: 'flex', gap: 6, flexShrink: 0, marginLeft: 'auto', paddingLeft: 10 },
  eligBtn:      { width: 36, height: 28, borderRadius: 6, border: '1.5px solid #e0ddd8', background: '#f5f4f0', fontSize: 11, fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' },
  eligBtnYes:       { color: '#3b6d11' },
  eligBtnYesActive: { background: GREEN, borderColor: GREEN, color: '#fff' },
  eligBtnNo:        { color: '#c0392b' },
  eligBtnNoActive:  { background: '#e57373', borderColor: '#e57373', color: '#fff' },
  eligBtnUnsure:       { width: 'auto', padding: '0 10px', color: '#8a6d1a' },
  eligBtnUnsureActive: { background: '#e0c169', borderColor: '#e0c169', color: '#fff' },
  statusBanner: { borderRadius: 10, padding: '14px 16px', marginTop: 12, fontSize: 13, lineHeight: 1.6 },
  outcomeCard:     { borderRadius: 12, padding: 20, marginBottom: 8 },
  outcomeIcon:     { fontSize: 36, textAlign: 'center', marginBottom: 14 },
  outcomeHeading:  { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 19, fontWeight: 400, color: 'var(--tx, #1c1c1e)', lineHeight: 1.4, marginBottom: 12 },
  outcomeBody:     { fontSize: 14, lineHeight: 1.75, color: '#2c2c2a' },
  resourcesHeading:{ fontFamily: '"Space Mono", monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5f5e5a', marginBottom: 10 },
  resourceItem:    { display: 'flex', flexDirection: 'column', padding: '10px 12px', border: '1px solid #e0ddd8', borderRadius: 8, marginBottom: 6, background: '#fff' },
  resourceName:    { fontSize: 13, fontWeight: 600, color: 'var(--tx, #1c1c1e)' },
  resourceContact: { fontSize: 12, color: '#5f5e5a', marginTop: 2, fontFamily: '"Space Mono", monospace' },
  footer:       { padding: '16px 24px 28px', borderTop: '1px solid #ebe8e3', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  btnNext:      { width: '100%', border: 'none', borderRadius: 8, padding: '14px 24px', fontSize: 15, fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600, cursor: 'pointer', background: '#2c2c2a', color: '#fff', transition: 'background 0.15s' },
  btnProceed:   { width: '100%', border: 'none', borderRadius: 8, padding: '14px 24px', fontSize: 15, fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600, cursor: 'pointer', background: '#3b6d11', color: '#fff', transition: 'background 0.15s' },
  btnDisabled:  { background: '#c8c5c0', cursor: 'default' },
  loading:      { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
}
