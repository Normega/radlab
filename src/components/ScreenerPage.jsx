import { useState, useEffect } from 'react'
import { evaluatePhase2 } from '../lib/screenerUtils'

// ── ScreenerPage ───────────────────────────────────────────────────────────────
//
// Pre-consent gate. Runs before ConsentPage for studies that have a screener
// attached (study.screener != null). No item-level data is ever saved.
//
// Props:
//   study           — { id, screener } — study.screener is the screener JSON
//   participant     — { id }
//   supabaseClient  — participant-authenticated Supabase client
//   onPass          — () => void — called when both phases pass
//   onFail          — () => void — called when either phase fails

const GREEN   = '#639922'
const RED_BG  = '#fff3f3'
const RED_BDR = '#f5c6c6'
const RED_TXT = '#7a1f1f'

const DEFAULT_SCALE = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
]

const PHASE_META = {
  description: { step: 'Step 1 of 4', prog: 25,  title: 'Study Overview',        sub: 'Please read carefully before continuing' },
  eligibility:  { step: 'Step 2 of 4', prog: 50,  title: 'Eligibility Criteria',  sub: 'Please answer Yes or No to each statement' },
  gad7:         { step: 'Step 3 of 4', prog: 75,  title: 'Pre-Screening Measure', sub: 'Part 1 of 2' },
  phq8:         { step: 'Step 3 of 4', prog: 75,  title: 'Pre-Screening Measure', sub: 'Part 2 of 2' },
  outcome:      { step: 'Step 4 of 4', prog: 100, title: 'Screening Result',      sub: '' },
}

export default function ScreenerPage({ study, participant, supabaseClient, onPass, onFail, previewMode = false }) {
  const screener = study.screener

  const [phase,        setPhase]        = useState('description')
  const [eligAnswers,  setEligAnswers]  = useState({})  // { itemIndex: 'yes'|'no' }
  const [gad7Answers,  setGad7Answers]  = useState({})  // { itemIndex: 0|1|2|3 }
  const [phq8Answers,  setPhq8Answers]  = useState({})  // { itemIndex: 0|1|2|3 }
  const [outcome,      setOutcome]      = useState(null)
  const [eligResult,   setEligResult]   = useState(null) // null | 'pass' | 'fail'
  const [gad7Def,      setGad7Def]      = useState(null)
  const [phq8Def,      setPhq8Def]      = useState(null)
  const [saving,       setSaving]       = useState(false)

  const meta = PHASE_META[phase] ?? PHASE_META.description

  // Load questionnaire definitions on mount so there's no delay when reaching phase 2
  useEffect(() => {
    const slugs = screener?.phase2?.questionnaires ?? []
    const slug1 = slugs[0]?.questionnaire_slug ?? 'gad-7'
    const slug2 = slugs[1]?.questionnaire_slug ?? 'phq-8'

    Promise.all([
      supabaseClient.from('questionnaires').select('definition').eq('slug', slug1).single(),
      supabaseClient.from('questionnaires').select('definition').eq('slug', slug2).single(),
    ]).then(([r1, r2]) => {
      if (r1.data?.definition) setGad7Def(r1.data.definition)
      if (r2.data?.definition) setPhq8Def(r2.data.definition)
    })
  }, [])

  // ── Phase 1 ────────────────────────────────────────────────────────────────

  function setEligAnswer(idx, val) {
    setEligAnswers(prev => ({ ...prev, [idx]: val }))
    if (eligResult === 'pass') setEligResult(null) // reset banner on any change
  }

  const phase1Items    = screener?.phase1?.items ?? []
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

  // ── Phase 2 ────────────────────────────────────────────────────────────────

  const gad7Items     = gad7Def?.items ?? []
  const phq8Items     = phq8Def?.items ?? []
  const gad7Scale     = gad7Def?.scale_labels ?? DEFAULT_SCALE
  const phq8Scale     = phq8Def?.scale_labels ?? DEFAULT_SCALE
  const gad7Answered  = Object.keys(gad7Answers).length
  const phq8Answered  = Object.keys(phq8Answers).length

  async function submitPhase2() {
    const result = evaluatePhase2(gad7Answers, phq8Answers)
    setOutcome(result)
    setPhase('outcome')
    await saveResult(true, result === 'pass', result)
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
    if (outcome === 'fail_phase1') {
      const fm = screener?.phase1?.fail_message ?? {}
      return {
        icon:     '⚠️',
        cardCls:  'fail-low',
        heading:  fm.heading ?? 'Thank you for your interest — this study may not be the right fit for you at this time.',
        body:     fm.body    ?? 'Based on your responses, you do not meet the eligibility criteria for this study.',
        showResources: true,
        showContinue:  false,
      }
    }
    const outcomes = screener?.phase2?.outcomes ?? {}
    if (outcome === 'pass') {
      const o = outcomes.pass ?? {}
      return {
        icon:     '✅',
        cardCls:  'pass',
        heading:  o.heading ?? 'You appear to be a good candidate for this study.',
        body:     o.body    ?? 'Based on your responses, you seem to be experiencing a level of emotional distress that this study is designed to support. Press Next to continue to the consent form and baseline survey.',
        showResources: false,
        showContinue:  true,
      }
    }
    if (outcome === 'fail_low') {
      const o = outcomes.fail_low ?? {}
      return {
        icon:     '🌿',
        cardCls:  'fail-low',
        heading:  o.heading ?? 'You appear to be coping well with everyday demands.',
        body:     o.body    ?? 'This study is designed for people experiencing a moderate level of emotional distress, and your responses suggest that may not apply to you right now.',
        showResources: true,
        showContinue:  false,
      }
    }
    if (outcome === 'fail_high') {
      const o = outcomes.fail_high ?? {}
      return {
        icon:     '💙',
        cardCls:  'fail-high',
        heading:  o.heading ?? 'It sounds like you may be going through a particularly difficult time.',
        body:     o.body    ?? 'We want to make sure you have the right level of support. Because this study is not a substitute for professional mental health care, we are not able to enroll participants who are currently experiencing high levels of distress.',
        showResources: true,
        showContinue:  false,
      }
    }
    return { icon: '', heading: '', body: '', showResources: false, showContinue: false }
  }

  const resources = screener?.resources ?? []

  // ── Render helpers ─────────────────────────────────────────────────────────

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
              background:   val === 'yes' ? '#f0f7eb' : val === 'no' ? RED_BG : '#fff',
              borderColor:  val === 'yes' ? GREEN     : val === 'no' ? '#e57373' : '#e0ddd8',
            }}>
              <div style={S.eligNum}>{i + 1}</div>
              <div style={S.eligText}>{item.text}</div>
              <div style={S.eligBtns}>
                <button
                  onClick={() => setEligAnswer(i, 'yes')}
                  style={{ ...S.eligBtn, ...(val === 'yes' ? S.eligBtnYesActive : S.eligBtnYes) }}
                >Yes</button>
                <button
                  onClick={() => setEligAnswer(i, 'no')}
                  style={{ ...S.eligBtn, ...(val === 'no' ? S.eligBtnNoActive : S.eligBtnNo) }}
                >No</button>
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

  function renderQuestionnaire(qDef, answers, setAnswers, scaleLabels, totalItems) {
    const items = qDef?.items ?? []
    const scale = scaleLabels ?? DEFAULT_SCALE
    const answered = Object.keys(answers).length

    return (
      <div style={S.content}>
        <div style={S.partLabel}>Pre-Screening Measure</div>
        {qDef?.title && <div style={S.qSectionLabel}>{qDef.title}</div>}
        {qDef?.instruction && <p style={S.qInstruction}>{qDef.instruction}</p>}
        <div style={S.qProgressRow}>
          <div style={S.qProgressBar}>
            <div style={{ ...S.qProgressInner, width: `${totalItems > 0 ? (answered / totalItems) * 100 : 0}%` }} />
          </div>
          <span style={S.qProgressLabel}>{answered} of {totalItems}</span>
        </div>
        {items.map((item, i) => {
          const itemText = item.text ?? item.label ?? item.stem ?? ''
          const selected = answers[i]
          return (
            <div key={item.id ?? i} style={S.qItem}>
              <div style={S.qText}>{itemText}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scale.map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => setAnswers(prev => ({ ...prev, [i]: opt.value }))}
                    style={{
                      ...S.qOpt,
                      background:   selected === opt.value ? '#f0f7eb' : '#fff',
                      borderColor:  selected === opt.value ? GREEN : '#e0ddd8',
                    }}
                  >
                    <div style={{
                      ...S.qRadio,
                      borderColor:  selected === opt.value ? GREEN : '#d0cdc8',
                      background:   selected === opt.value ? GREEN : 'transparent',
                      boxShadow:    selected === opt.value ? 'inset 0 0 0 3px #fff' : 'none',
                    }} />
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderOutcome() {
    const { icon, cardCls, heading, body, showResources, showContinue } = getOutcomeContent()
    const cardStyle = {
      ...S.outcomeCard,
      ...(cardCls === 'pass'      ? { background: '#f0f7eb', border: '1.5px solid #b8d9a0' } :
          cardCls === 'fail-low'  ? { background: '#faf6ed', border: '1.5px solid #e8d5a3' } :
                                    { background: RED_BG,    border: `1.5px solid ${RED_BDR}` }),
    }
    return (
      <div style={S.content}>
        <div style={cardStyle}>
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
            <button
              onClick={onPass}
              disabled={saving}
              style={S.btnProceed}
            >
              Continue to Consent Form ›
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Footer buttons by phase ────────────────────────────────────────────────

  function renderFooter() {
    if (phase === 'outcome') return null // footer embedded in outcome content

    if (phase === 'description') {
      return (
        <div style={S.footer}>
          <button onClick={() => setPhase('eligibility')} style={S.btnNext}>
            Next →
          </button>
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

    if (phase === 'gad7') {
      const allAnswered = gad7Answered === gad7Items.length && gad7Items.length > 0
      return (
        <div style={S.footer}>
          <button
            onClick={() => setPhase('phq8')}
            disabled={!allAnswered}
            style={{ ...S.btnNext, ...(allAnswered ? {} : S.btnDisabled) }}
          >
            Next →
          </button>
        </div>
      )
    }

    if (phase === 'phq8') {
      const allAnswered = phq8Answered === phq8Items.length && phq8Items.length > 0
      return (
        <div style={S.footer}>
          <button
            onClick={submitPhase2}
            disabled={!allAnswered || saving}
            style={{ ...S.btnNext, ...(allAnswered && !saving ? {} : S.btnDisabled) }}
          >
            Submit →
          </button>
        </div>
      )
    }

    return null
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={S.topBadge}>
          <span style={S.topBadgeDot} />
          Pre-Consent Screener
        </div>
        <span style={S.stepIndicator}>{meta.step}</span>
      </div>

      {/* Progress bar */}
      <div style={S.progressWrap}>
        <div style={{ ...S.progressFill, width: `${meta.prog}%` }} />
      </div>

      {/* Header */}
      <div style={S.header}>
        <div style={S.pageTitle}>{meta.title}</div>
        {meta.sub && <div style={S.pageSubtitle}>{meta.sub}</div>}
      </div>

      {/* Content */}
      <div style={S.scrollArea}>
        {phase === 'description' && renderDescription()}
        {phase === 'eligibility' && renderEligibility()}
        {phase === 'gad7'  && renderQuestionnaire(gad7Def, gad7Answers, setGad7Answers, gad7Scale, gad7Items.length)}
        {phase === 'phq8'  && renderQuestionnaire(phq8Def, phq8Answers, setPhq8Answers, phq8Scale, phq8Items.length)}
        {phase === 'outcome' && renderOutcome()}
      </div>

      {/* Footer */}
      {renderFooter()}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    background: '#fff',
    width: '100%',
    maxWidth: 680,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  topBar: {
    background: '#f0ede8',
    borderBottom: '1px solid #e0ddd8',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  topBadge: {
    fontSize: 11,
    fontFamily: '"Space Mono", monospace',
    fontWeight: 700,
    color: '#5f5e5a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  topBadgeDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#639922',
  },
  stepIndicator: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    color: '#888780',
    fontWeight: 500,
  },
  progressWrap: {
    height: 4,
    background: '#e0ddd8',
    flexShrink: 0,
  },
  progressFill: {
    height: '100%',
    background: '#639922',
    transition: 'width 0.4s',
  },
  header: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid #ebe8e3',
    flexShrink: 0,
  },
  pageTitle: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 21,
    fontWeight: 700,
    color: 'var(--tx, #1c1c1e)',
  },
  pageSubtitle: {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 13,
    color: '#888780',
    marginTop: 3,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
  },
  content: {
    padding: 24,
  },
  partLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--tx, #1c1c1e)',
    padding: '10px 14px',
    background: '#f5f4f0',
    borderLeft: `3px solid ${GREEN}`,
    borderRadius: '0 6px 6px 0',
    marginBottom: 16,
  },
  introText: {
    fontSize: 14,
    lineHeight: 1.75,
    color: '#2c2c2a',
    marginBottom: 16,
  },
  studyStep: {
    display: 'flex',
    gap: 12,
    padding: '11px 14px',
    border: '1px solid #ebe8e3',
    borderRadius: 8,
    marginBottom: 8,
    background: '#fff',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#f0ede8',
    fontSize: 11,
    fontFamily: '"Space Mono", monospace',
    fontWeight: 700,
    color: '#5f5e5a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: '#2c2c2a',
  },
  infoBox: {
    background: '#faf9f7',
    border: '1px solid #e0ddd8',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 1.7,
    color: '#5f5e5a',
  },
  eligItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    border: '1.5px solid #e0ddd8',
    borderRadius: 10,
    marginBottom: 8,
    transition: 'border-color 0.15s, background 0.15s',
  },
  eligNum: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 12,
    fontWeight: 700,
    color: '#a09d98',
    flexShrink: 0,
    width: 20,
    paddingTop: 1,
  },
  eligText: {
    fontSize: 13,
    lineHeight: 1.55,
    color: '#2c2c2a',
    flex: 1,
  },
  eligBtns: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
    marginLeft: 'auto',
    paddingLeft: 10,
  },
  eligBtn: {
    width: 36,
    height: 28,
    borderRadius: 6,
    border: '1.5px solid #e0ddd8',
    background: '#f5f4f0',
    fontSize: 11,
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  eligBtnYes: { color: '#3b6d11' },
  eligBtnYesActive: { background: GREEN, borderColor: GREEN, color: '#fff' },
  eligBtnNo:  { color: '#c0392b' },
  eligBtnNoActive:  { background: '#e57373', borderColor: '#e57373', color: '#fff' },
  statusBanner: {
    borderRadius: 10,
    padding: '14px 16px',
    marginTop: 12,
    fontSize: 13,
    lineHeight: 1.6,
  },
  qSectionLabel: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#888780',
    marginBottom: 10,
    marginTop: 10,
  },
  qInstruction: {
    fontSize: 13,
    color: '#5f5e5a',
    lineHeight: 1.6,
    marginBottom: 18,
    fontStyle: 'italic',
  },
  qProgressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  qProgressBar: {
    flex: 1,
    height: 4,
    background: '#e0ddd8',
    borderRadius: 2,
    overflow: 'hidden',
  },
  qProgressInner: {
    height: '100%',
    background: GREEN,
    transition: 'width 0.3s',
  },
  qProgressLabel: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    color: '#888780',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  qItem: {
    marginBottom: 22,
  },
  qText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--tx, #1c1c1e)',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  qOpt: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    border: '1.5px solid #e0ddd8',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    color: '#2c2c2a',
    transition: 'background 0.1s, border-color 0.1s',
  },
  qRadio: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '2px solid #d0cdc8',
    flexShrink: 0,
    transition: 'all 0.1s',
  },
  outcomeCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 8,
  },
  outcomeIcon: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 14,
  },
  outcomeHeading: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 19,
    fontWeight: 700,
    color: 'var(--tx, #1c1c1e)',
    lineHeight: 1.4,
    marginBottom: 12,
  },
  outcomeBody: {
    fontSize: 14,
    lineHeight: 1.75,
    color: '#2c2c2a',
  },
  resourcesHeading: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#5f5e5a',
    marginBottom: 10,
  },
  resourceItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 12px',
    border: '1px solid #e0ddd8',
    borderRadius: 8,
    marginBottom: 6,
    background: '#fff',
  },
  resourceName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--tx, #1c1c1e)',
  },
  resourceContact: {
    fontSize: 12,
    color: '#5f5e5a',
    marginTop: 2,
    fontFamily: '"Space Mono", monospace',
  },
  footer: {
    padding: '16px 24px 28px',
    borderTop: '1px solid #ebe8e3',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  btnNext: {
    width: '100%',
    border: 'none',
    borderRadius: 8,
    padding: '14px 24px',
    fontSize: 15,
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontWeight: 500,
    cursor: 'pointer',
    background: '#2c2c2a',
    color: '#fff',
    transition: 'background 0.15s',
  },
  btnProceed: {
    width: '100%',
    border: 'none',
    borderRadius: 8,
    padding: '14px 24px',
    fontSize: 15,
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontWeight: 500,
    cursor: 'pointer',
    background: '#3b6d11',
    color: '#fff',
    transition: 'background 0.15s',
  },
  btnDisabled: {
    background: '#c8c5c0',
    cursor: 'default',
  },
}
