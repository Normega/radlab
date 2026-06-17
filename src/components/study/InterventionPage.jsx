import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import StudyVideoPlayer from '../video/StudyVideoPlayer'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITION_LABELS = {
  non_reactivity:  'Non-Reactivity Practice',
  reappraisal:     'Reappraisal Practice',
  self_compassion: 'Self-Compassion Practice',
}

const SESSION_STEPS = [
  { label: 'Welcome',  state: 'done'     },
  { label: 'Check-in', state: 'done'     },
  { label: 'Practice', state: 'active'   },
  { label: 'Check-in', state: 'upcoming' },
  { label: 'Farewell', state: 'upcoming' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildScreens(module) {
  return [
    { type: 'lead_in', owl: module.lead_in.owl, text: module.lead_in.text },
    ...module.steps.map((s, i) => ({ ...s, _stepIndex: i })),
    { type: 'lead_out', owl: module.lead_out.owl, text: module.lead_out.text },
  ]
}

function initialNextEnabled(screen, demoMode) {
  if (demoMode) return screen.type !== 'prompt_response'
  return screen.type !== 'video' && screen.type !== 'prompt_response' && screen.type !== 'slider'
}

// ── InterventionPage ──────────────────────────────────────────────────────────

export default function InterventionPage({
  module,
  participantId,
  dayDataId,
  scheduleId,
  studyDay,
  onComplete,
  demoMode = false,
}) {
  const screens = buildScreens(module)

  const [screenIndex,   setScreenIndex]   = useState(0)
  const [nextEnabled,   setNextEnabled]   = useState(() => initialNextEnabled(screens[0], demoMode))
  const [responses,     setResponses]     = useState({})   // _stepIndex → text
  const [sliderValues,  setSliderValues]  = useState({})   // _stepIndex → number
  const [sliderTouched, setSliderTouched] = useState({})   // _stepIndex → bool
  const [saving,        setSaving]        = useState(false)

  const current = screens[screenIndex]
  const isLast  = screenIndex === screens.length - 1

  // Re-evaluate gate whenever screen changes
  useEffect(() => {
    const s = screens[screenIndex]
    if (s.type === 'video' && !demoMode) {
      setNextEnabled(false)
    } else if (s.type === 'prompt_response') {
      setNextEnabled((responses[s._stepIndex] ?? '').length > 0)
    } else if (s.type === 'slider') {
      setNextEnabled(!!sliderTouched[s._stepIndex])
    } else {
      setNextEnabled(true)
    }
  }, [screenIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResponseChange = useCallback((stepIndex, text) => {
    setResponses(prev => ({ ...prev, [stepIndex]: text }))
    setNextEnabled(text.length > 0)
  }, [])

  const handleVideoComplete = useCallback(() => {
    setNextEnabled(true)
  }, [])

  async function handleNext() {
    if (!nextEnabled || saving) return

    // Save prompt response before advancing
    if (current.type === 'prompt_response' && participantId) {
      setSaving(true)
      await supabase.from('intervention_responses').insert({
        participant_id: participantId,
        day_data_id:    dayDataId   ?? null,
        schedule_id:    scheduleId  ?? null,
        module_id:      module.module_id,
        study_day:      studyDay,
        response_index: current._stepIndex,
        block_type:     'prompt_response',
        response_text:  responses[current._stepIndex] ?? '',
      })
      setSaving(false)
    }

    // Save slider value before advancing (always saves, even if untouched)
    if (current.type === 'slider' && participantId) {
      setSaving(true)
      const mid = Math.round((current.min + current.max) / 2)
      await supabase.from('intervention_responses').insert({
        participant_id: participantId,
        day_data_id:    dayDataId   ?? null,
        schedule_id:    scheduleId  ?? null,
        module_id:      module.module_id,
        study_day:      studyDay,
        response_index: current._stepIndex,
        block_type:     'slider',
        response_value: { value: sliderValues[current._stepIndex] ?? mid },
      })
      setSaving(false)
    }

    if (isLast) {
      // Stamp completed_at on the day row
      if (dayDataId) {
        await supabase
          .from('liliana_day_data')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', dayDataId)
      }
      onComplete()
    } else {
      setScreenIndex(i => i + 1)
    }
  }

  const phaseLabel = module.phase === 'phase1' ? '1' : '2'

  return (
    <div style={S.bg}>
      <div style={S.page}>

        {/* 5-step session progress bar */}
        <div style={S.progressBar}>
          <div style={{ display: 'flex' }}>
            {SESSION_STEPS.map((step, i) => (
              <div key={i} style={S.stepCol}>
                <span style={{ ...S.stepLabel, color: step.state === 'done' ? '#639922' : step.state === 'active' ? '#2c2c2a' : '#a09d98' }}>
                  {step.label}
                </span>
                <div style={{ ...S.stepTrack, background: step.state === 'done' ? '#639922' : step.state === 'active' ? '#2c2c2a' : '#ddd' }}>
                  <div style={{ ...S.stepDot, background: step.state === 'done' ? '#639922' : step.state === 'active' ? '#2c2c2a' : '#ddd' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div style={S.header}>
          <div style={S.practiceBadge}>
            <div style={S.badgeDot} />
            {CONDITION_LABELS[module.condition] ?? module.condition}
          </div>
          <div style={S.dayNumber}>Phase {phaseLabel} · Day {module.lesson}</div>
          <div style={S.dayTitle}>{module.title}</div>
          {module.subtitle && <div style={S.daySubtitle}>{module.subtitle}</div>}
        </div>

        {/* Step pips */}
        <div style={S.pips}>
          {screens.map((_, i) => (
            <div key={i} style={{
              ...S.pip,
              background: i < screenIndex ? '#639922' : i === screenIndex ? '#2c2c2a' : '#ddd',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={S.content}>
          {(current.type === 'lead_in' || current.type === 'lead_out') && (
            <OwlScreen owl={current.owl} text={current.text} />
          )}
          {current.type === 'video' && (
            <VideoBlock step={current} onComplete={handleVideoComplete} />
          )}
          {current.type === 'text' && (
            <TextBlock step={current} />
          )}
          {current.type === 'prompt_response' && (
            <PromptResponseBlock
              step={current}
              value={responses[current._stepIndex] ?? ''}
              onChange={text => handleResponseChange(current._stepIndex, text)}
            />
          )}
          {current.type === 'closing' && (
            <ClosingBlock step={current} />
          )}
          {current.type === 'slider' && (
            <SliderBlock
              step={current}
              value={sliderValues[current._stepIndex] ?? Math.round((current.min + current.max) / 2)}
              touched={!!sliderTouched[current._stepIndex]}
              onChange={v => {
                setSliderValues(prev => ({ ...prev, [current._stepIndex]: v }))
                if (!sliderTouched[current._stepIndex]) {
                  setSliderTouched(prev => ({ ...prev, [current._stepIndex]: true }))
                  setNextEnabled(true)
                }
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button
            onClick={handleNext}
            disabled={!nextEnabled || saving}
            style={
              isLast
                ? S.btnDone
                : (!nextEnabled || saving)
                  ? { ...S.btnNext, ...S.btnDisabled }
                  : S.btnNext
            }
          >
            {saving ? 'Saving…' : isLast ? 'Complete Practice' : 'Next'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── OwlScreen ─────────────────────────────────────────────────────────────────

function OwlScreen({ owl, text }) {
  return (
    <div style={S.owlScreen}>
      <img
        src={`/assets/owls/${owl}.png`}
        alt=""
        style={S.owlImg}
      />
      <div style={S.speechBubble}>{text}</div>
    </div>
  )
}

// ── VideoBlock ────────────────────────────────────────────────────────────────

function VideoBlock({ step, onComplete }) {
  return (
    <div>
      {step.label && <p style={S.videoLabel}>{step.label}</p>}
      <StudyVideoPlayer
        storagePath={`liliana/${step.video_id}`}
        preview
        requiredWatchPct={0.9}
        onComplete={onComplete}
      />
      <p style={S.videoNote}>Next will unlock once the video has been watched.</p>
    </div>
  )
}

// ── TextBlock ─────────────────────────────────────────────────────────────────

function TextBlock({ step }) {
  return (
    <div>
      {step.content.map((item, i) =>
        item.tag === 'h3'
          ? <h3 key={i} style={S.textH3}>{item.text}</h3>
          : <p  key={i} style={S.textP}>{item.text}</p>
      )}
    </div>
  )
}

// ── PromptResponseBlock ───────────────────────────────────────────────────────

function PromptResponseBlock({ step, value, onChange }) {
  const rows = step.size === 'single_line' ? 1 : step.size === 'short' ? 3 : 5
  return (
    <div>
      <div style={S.promptBox}>{step.prompt}</div>
      {step.example && (
        <div style={S.exampleBox}>
          {step.example_label && (
            <p style={S.exampleLabel}>{step.example_label}</p>
          )}
          <p style={S.exampleText}>{step.example}</p>
        </div>
      )}
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Type your response here…"
        style={S.textarea}
      />
    </div>
  )
}

// ── ClosingBlock ──────────────────────────────────────────────────────────────

function ClosingBlock({ step }) {
  return (
    <div>
      {step.content.map((item, i) => (
        <p key={i} style={S.closingP}>{item.text}</p>
      ))}
    </div>
  )
}

// ── SliderBlock ───────────────────────────────────────────────────────────────

function SliderBlock({ step, value, touched, onChange }) {
  return (
    <div>
      <p style={S.promptLabel}>{step.prompt}</p>
      <div style={S.sliderWrap}>
        <input
          type="range"
          min={step.min}
          max={step.max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ ...S.bigSlider, accentColor: touched ? '#639922' : '#c0bdb8' }}
        />
        <div style={{ ...S.sliderLabels, color: touched ? '#5f5e5a' : '#b0ada8' }}>
          <span>{step.min_label}</span>
          {touched
            ? <span style={S.sliderVal}>{value}</span>
            : <span style={S.sliderValEmpty}>—</span>
          }
          <span>{step.max_label}</span>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const S = {
  bg: {
    background: '#f5f4f0',
    minHeight: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  page: {
    background: '#fff',
    width: '100%',
    maxWidth: 640,
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
  },

  // ── Progress bar
  progressBar: {
    background: '#f0ede8',
    borderBottom: '1px solid #e0ddd8',
    padding: '12px 20px 0',
  },
  stepCol: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
  },
  stepLabel: {
    fontSize: 10, fontWeight: 500, letterSpacing: '0.04em',
    textTransform: 'uppercase', marginBottom: 8, whiteSpace: 'nowrap',
  },
  stepTrack: {
    width: '100%', height: 3, position: 'relative',
  },
  stepDot: {
    width: 8, height: 8, borderRadius: '50%',
    position: 'absolute', left: '50%', top: '50%',
    transform: 'translate(-50%, -50%)',
  },

  // ── Header
  header: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid #ebe8e3',
  },
  practiceBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#f0ede8', border: '1px solid #ddd',
    borderRadius: 6, padding: '4px 10px',
    fontSize: 11, fontWeight: 500, color: '#5f5e5a',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: 10,
  },
  badgeDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#639922',
  },
  dayNumber: {
    fontSize: 22, fontWeight: 600, color: '#1a1a18',
  },
  dayTitle: {
    fontSize: 15, fontWeight: 500, color: '#1a1a18', marginTop: 2,
  },
  daySubtitle: {
    fontSize: 13, color: '#888780', marginTop: 2,
  },

  // ── Step pips
  pips: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '10px 24px',
    borderBottom: '1px solid #f0ede8',
    background: '#faf9f7',
  },
  pip: {
    width: 6, height: 6, borderRadius: '50%',
    transition: 'background 0.2s',
  },

  // ── Owl screen
  owlScreen: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '28px 24px', flex: 1,
  },
  owlImg: {
    width: 110, height: 110, flexShrink: 0, objectFit: 'contain',
  },
  speechBubble: {
    background: '#f9f8f5',
    border: '1px solid #e0ddd8',
    borderRadius: '12px 12px 12px 4px',
    padding: '14px 16px',
    fontSize: 14, lineHeight: 1.7, color: '#2c2c2a',
    flex: 1,
  },

  // ── Content area
  content: {
    flex: 1, padding: 24,
  },

  // ── Video
  videoLabel: {
    fontSize: 12, fontWeight: 500, color: '#5f5e5a',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    marginBottom: 10,
  },
  videoNote: {
    fontSize: 11, color: '#a09d98', marginTop: 8, textAlign: 'center',
  },

  // ── Text block
  textH3: {
    fontSize: 15, fontWeight: 600, color: '#1a1a18',
    margin: '0 0 8px',
  },
  textP: {
    fontSize: 14, lineHeight: 1.7, color: '#5f5e5a',
    margin: '0 0 12px',
  },

  // ── Prompt response
  promptBox: {
    background: '#f0ede8',
    border: '1px solid #e0ddd8',
    borderRadius: 8,
    padding: '14px 16px',
    fontSize: 14, lineHeight: 1.7, color: '#2c2c2a',
    marginBottom: 12,
  },
  exampleBox: {
    background: '#faf9f7',
    border: '1px solid #e8e5e0',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 12,
  },
  exampleLabel: {
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.04em', color: '#888780',
    margin: '0 0 4px',
  },
  exampleText: {
    fontSize: 13, lineHeight: 1.6, color: '#5f5e5a',
    fontStyle: 'italic', margin: 0,
  },
  textarea: {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #d9d6d1',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14, fontFamily: FONT, color: '#1a1a18',
    lineHeight: 1.6, resize: 'vertical',
    outline: 'none',
    background: '#fff',
  },

  // ── Closing
  closingP: {
    fontSize: 14, lineHeight: 1.7, color: '#5f5e5a',
    margin: '0 0 12px',
  },

  // ── Slider block
  promptLabel: {
    fontSize: 14, lineHeight: 1.7, color: '#2c2c2a',
    margin: '0 0 16px', fontFamily: FONT,
  },
  sliderWrap: {
    background: '#faf9f7',
    border: '1px solid #e8e5e0',
    borderRadius: 12,
    padding: '20px 20px 16px',
  },
  bigSlider: {
    width: '100%',
    height: 8,
    accentColor: '#639922',
    cursor: 'pointer',
    marginBottom: 12,
    display: 'block',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    color: '#5f5e5a',
    fontFamily: FONT,
  },
  sliderVal: {
    fontSize: 22,
    fontWeight: 700,
    color: '#639922',
    fontFamily: FONT,
  },
  sliderValEmpty: {
    fontSize: 22,
    fontWeight: 400,
    color: '#c0bdb8',
    fontFamily: FONT,
  },

  // ── Footer
  footer: {
    padding: '16px 24px 28px',
    borderTop: '1px solid #ebe8e3',
  },
  btnNext: {
    width: '100%', background: '#2c2c2a', color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '14px 24px', fontSize: 15, fontWeight: 500,
    cursor: 'pointer', fontFamily: FONT, letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  },
  btnDisabled: {
    background: '#c8c5c0', cursor: 'not-allowed',
  },
  btnDone: {
    width: '100%', background: '#3b6d11', color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '14px 24px', fontSize: 15, fontWeight: 500,
    cursor: 'pointer', fontFamily: FONT, letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  },
}
