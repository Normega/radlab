import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
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

// Types always enabled (no gating needed)
const ALWAYS_ENABLED = new Set(['lead_in', 'lead_out', 'text', 'closing', 'slider'])

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildScreens(module) {
  return [
    { type: 'lead_in',  owl: module.lead_in.owl,  text: module.lead_in.text  },
    ...module.steps.map((s, i) => ({ ...s, _stepIndex: i })),
    { type: 'lead_out', owl: module.lead_out.owl, text: module.lead_out.text },
  ]
}

function initialNextEnabled(screen, demoMode) {
  if (ALWAYS_ENABLED.has(screen.type)) return true
  if (screen.type === 'video') return demoMode
  return false  // all gated types start disabled; handlers enable them
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
  supabaseClient = null,
}) {
  // In a participant session the caller passes the participant-authenticated
  // client; the global client (anon on a link, lab in admin demo) is the
  // fallback. Shadows the old module-level import so every write below uses it.
  const supabase = supabaseClient ?? globalSupabase

  const screens = buildScreens(module)

  // Session context: multi_response → thought_rating / thought_choice
  const sessionCtxRef = useRef({})

  // Core navigation state
  const [screenIndex, setScreenIndex] = useState(0)
  const [nextEnabled, setNextEnabled] = useState(() => initialNextEnabled(screens[0], demoMode))
  const [saving,      setSaving]      = useState(false)

  // ── Per-block state (keyed by _stepIndex) ──────────────────────────────────

  // prompt_response
  const [responses,     setResponses]     = useState({})

  // slider (existing)
  const [sliderValues,  setSliderValues]  = useState({})
  const [sliderTouched, setSliderTouched] = useState({})

  // multi_response
  const [multiResponses, setMultiResponses] = useState({})  // {stepIdx: string[]}

  // timer
  const [timerDone, setTimerDone] = useState({})  // {stepIdx: bool}

  // training_response (single-select)
  const [trainingSelected, setTrainingSelected] = useState({})  // {stepIdx: {selected, other_text?}}

  // training_response_multi (multi-select)
  const [trainingMultiSel, setTrainingMultiSel] = useState({})  // {stepIdx: string[]}

  // word_select
  const [wordSelected, setWordSelected] = useState({})  // {stepIdx: string[]}

  // thought_rating: ratings + which-sliders-moved
  const [thoughtRatings,    setThoughtRatings]    = useState({})  // {stepIdx: {thought, value}[]}
  const [thoughtMovedMap,   setThoughtMovedMap]   = useState({})  // {stepIdx: {thoughtIdx: bool}}

  // thought_choice
  const [thoughtChoice, setThoughtChoice] = useState({})  // {stepIdx: string}

  // trigger_map
  const [triggerValues, setTriggerValues] = useState({})  // {stepIdx: {catId: text}}

  // body_diagram
  const [bodyValues, setBodyValues] = useState({})  // {stepIdx: {body,chest,head,behavior}}

  // quality_explorer
  const [qualityState, setQualityState] = useState({})  // {stepIdx: {quality, slider_value, sliderMoved, description}}

  const current = screens[screenIndex]
  const isLast  = screenIndex === screens.length - 1

  // ── Gate re-evaluation on screen change ───────────────────────────────────

  useEffect(() => {
    const s = screens[screenIndex]

    if (ALWAYS_ENABLED.has(s.type)) {
      setNextEnabled(true)
      return
    }

    switch (s.type) {
      case 'video':
        setNextEnabled(!!demoMode)
        break
      case 'audio':
        setNextEnabled(false)
        break
      case 'prompt_response':
        setNextEnabled((responses[s._stepIndex] ?? '').length > 0)
        break
      case 'slider':
        setNextEnabled(true)
        break
      case 'multi_response': {
        const vals = multiResponses[s._stepIndex] ?? []
        setNextEnabled(vals.filter(v => v.trim()).length >= (s.min_required ?? 1))
        break
      }
      case 'timer':
        setNextEnabled(!!timerDone[s._stepIndex])
        break
      case 'training_response': {
        const sel = trainingSelected[s._stepIndex]
        if (!sel?.selected) { setNextEnabled(false); break }
        const opt = (s.options ?? []).find(o => (o.label ?? o) === sel.selected)
        const needsText = opt?.has_text_field
        setNextEnabled(!needsText || (sel.other_text ?? '').trim().length > 0)
        break
      }
      case 'training_response_multi': {
        const sel = trainingMultiSel[s._stepIndex] ?? []
        setNextEnabled(sel.length >= (s.min_required ?? 1))
        break
      }
      case 'word_select': {
        const sel = wordSelected[s._stepIndex] ?? []
        setNextEnabled(sel.length >= (s.min_required ?? 1))
        break
      }
      case 'thought_rating': {
        const thoughts = (sessionCtxRef.current['multi_response_values'] ?? []).filter(t => t.trim())
        const moved    = thoughtMovedMap[s._stepIndex] ?? {}
        setNextEnabled(thoughts.length > 0 && thoughts.every((_, i) => moved[i]))
        // Initialize ratings if not yet set
        if (!thoughtRatings[s._stepIndex] && thoughts.length > 0) {
          setThoughtRatings(prev => ({
            ...prev,
            [s._stepIndex]: thoughts.map(t => ({ thought: t, value: 50 })),
          }))
        }
        break
      }
      case 'thought_choice':
        setNextEnabled(!!thoughtChoice[s._stepIndex])
        break
      case 'trigger_map': {
        const vals   = triggerValues[s._stepIndex] ?? {}
        const filled = Object.values(vals).filter(v => v.trim()).length
        setNextEnabled(filled >= (s.min_required ?? 1))
        break
      }
      case 'body_diagram': {
        const vals = bodyValues[s._stepIndex] ?? {}
        setNextEnabled(['body','chest','head','behavior'].every(k => (vals[k] ?? '').trim()))
        break
      }
      case 'quality_explorer': {
        const qs = qualityState[s._stepIndex]
        setNextEnabled(!!(qs?.sliderMoved && (qs?.description ?? '').trim()))
        break
      }
      default:
        setNextEnabled(true)
    }
  }, [screenIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleResponseChange = useCallback((stepIndex, text) => {
    setResponses(prev => ({ ...prev, [stepIndex]: text }))
    setNextEnabled(text.length > 0)
  }, [])

  const handleVideoComplete = useCallback(() => setNextEnabled(true), [])

  async function handleNext() {
    if (!nextEnabled || saving) return
    if (participantId) await saveCurrentBlock()
    if (isLast) {
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

  async function saveCurrentBlock() {
    const s   = current
    const idx = s._stepIndex

    // Lead-in / lead-out / text / closing: no data to save
    if (idx === undefined) return

    const base = {
      participant_id: participantId,
      day_data_id:    dayDataId  ?? null,
      schedule_id:    scheduleId ?? null,
      module_id:      module.module_id,
      study_day:      studyDay,
      response_index: idx,
      block_type:     s.type,
    }

    setSaving(true)
    try {
      switch (s.type) {
        case 'prompt_response':
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: responses[idx] ?? '',
          })
          break

        case 'slider': {
          const mid = Math.round((s.min + s.max) / 2)
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ value: sliderValues[idx] ?? mid }),
          })
          break
        }

        case 'audio':
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ completed: true }),
          })
          break

        case 'multi_response': {
          const vals = multiResponses[idx] ?? Array(s.count).fill('')
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ responses: vals }),
          })
          break
        }

        case 'timer':
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ completed: true, duration_seconds: s.duration_seconds }),
          })
          break

        case 'training_response': {
          const sel = trainingSelected[idx] ?? {}
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify(sel),
          })
          break
        }

        case 'training_response_multi':
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ selected: trainingMultiSel[idx] ?? [] }),
          })
          break

        case 'word_select':
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ selected: wordSelected[idx] ?? [] }),
          })
          break

        case 'thought_rating': {
          const ratings = thoughtRatings[idx] ?? []
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ ratings }),
          })
          break
        }

        case 'thought_choice':
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({ selected: thoughtChoice[idx] ?? '' }),
          })
          break

        case 'trigger_map': {
          const vals = triggerValues[idx] ?? {}
          const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim()))
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify(clean),
          })
          break
        }

        case 'body_diagram': {
          const vals = bodyValues[idx] ?? {}
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify(vals),
          })
          break
        }

        case 'quality_explorer': {
          const qs = qualityState[idx] ?? {}
          await supabase.from('intervention_responses').insert({
            ...base,
            response_text: JSON.stringify({
              quality:      qs.quality,
              slider_value: qs.slider_value,
              description:  qs.description,
            }),
          })
          break
        }

        default:
          break
      }
    } finally {
      setSaving(false)
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
                <span style={{ ...S.stepLabel, color: step.state === 'done' ? 'var(--pk)' : step.state === 'active' ? 'var(--tx)' : 'var(--gy)' }}>
                  {step.label}
                </span>
                <div style={{ ...S.stepTrack, background: step.state === 'done' ? 'var(--pk)' : step.state === 'active' ? 'var(--tx)' : '#ddd' }}>
                  <div style={{ ...S.stepDot, background: step.state === 'done' ? 'var(--pk)' : step.state === 'active' ? 'var(--tx)' : '#ddd' }} />
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
              background: i < screenIndex ? 'var(--pk)' : i === screenIndex ? 'var(--tx)' : '#ddd',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={S.content}>
          {(current.type === 'lead_in' || current.type === 'lead_out') && (
            <OwlScreen owl={current.owl} text={current.text} />
          )}

          {current.type === 'video' && (
            <VideoBlock step={current} demoMode={demoMode} onComplete={handleVideoComplete} db={supabase} />
          )}

          {current.type === 'audio' && (
            <AudioBlock
              step={current}
              db={supabase}
              onComplete={() => setNextEnabled(true)}
            />
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
                }
              }}
            />
          )}

          {current.type === 'multi_response' && (
            <MultiResponseBlock
              step={current}
              values={multiResponses[current._stepIndex] ?? Array(current.count).fill('')}
              onChange={(idx, val) => {
                setMultiResponses(prev => {
                  const cur = prev[current._stepIndex] ?? Array(current.count).fill('')
                  const next = cur.map((v, i) => i === idx ? val : v)
                  sessionCtxRef.current['multi_response_values'] = next
                  setNextEnabled(next.filter(v => v.trim()).length >= (current.min_required ?? 1))
                  return { ...prev, [current._stepIndex]: next }
                })
              }}
            />
          )}

          {current.type === 'timer' && (
            <TimerBlock
              step={current}
              onComplete={() => {
                setTimerDone(prev => ({ ...prev, [current._stepIndex]: true }))
                setNextEnabled(true)
              }}
            />
          )}

          {current.type === 'training_response' && (
            <TrainingResponseBlock
              step={current}
              selected={trainingSelected[current._stepIndex] ?? {}}
              onSelect={(selected, otherText) => {
                const payload = { selected, other_text: otherText }
                setTrainingSelected(prev => ({ ...prev, [current._stepIndex]: payload }))
                const opt = (current.options ?? []).find(o => (o.label ?? o) === selected)
                const needsText = opt?.has_text_field
                setNextEnabled(!needsText || (otherText ?? '').trim().length > 0)
              }}
            />
          )}

          {current.type === 'training_response_multi' && (
            <TrainingResponseMultiBlock
              step={current}
              selected={trainingMultiSel[current._stepIndex] ?? []}
              onToggle={sel => {
                setTrainingMultiSel(prev => ({ ...prev, [current._stepIndex]: sel }))
                setNextEnabled(sel.length >= (current.min_required ?? 1))
              }}
            />
          )}

          {current.type === 'word_select' && (
            <WordSelectBlock
              step={current}
              selected={wordSelected[current._stepIndex] ?? []}
              onToggle={sel => {
                setWordSelected(prev => ({ ...prev, [current._stepIndex]: sel }))
                setNextEnabled(sel.length >= (current.min_required ?? 1))
              }}
            />
          )}

          {current.type === 'thought_rating' && (
            <ThoughtRatingBlock
              step={current}
              thoughts={(sessionCtxRef.current['multi_response_values'] ?? []).filter(t => t.trim())}
              ratings={thoughtRatings[current._stepIndex] ?? []}
              movedMap={thoughtMovedMap[current._stepIndex] ?? {}}
              onRatingChange={(thoughtIdx, value, allThoughts) => {
                setThoughtRatings(prev => {
                  const prev_r = prev[current._stepIndex] ?? allThoughts.map(t => ({ thought: t, value: 50 }))
                  return { ...prev, [current._stepIndex]: prev_r.map((r, i) => i === thoughtIdx ? { ...r, value } : r) }
                })
                setThoughtMovedMap(prev => {
                  const prevMoved = prev[current._stepIndex] ?? {}
                  const newMoved  = { ...prevMoved, [thoughtIdx]: true }
                  setNextEnabled(allThoughts.every((_, i) => newMoved[i]))
                  return { ...prev, [current._stepIndex]: newMoved }
                })
              }}
            />
          )}

          {current.type === 'thought_choice' && (
            <ThoughtChoiceBlock
              step={current}
              thoughts={(sessionCtxRef.current['multi_response_values'] ?? []).filter(t => t.trim())}
              selected={thoughtChoice[current._stepIndex] ?? ''}
              onSelect={label => {
                setThoughtChoice(prev => ({ ...prev, [current._stepIndex]: label }))
                setNextEnabled(true)
              }}
            />
          )}

          {current.type === 'trigger_map' && (
            <TriggerMapBlock
              step={current}
              values={triggerValues[current._stepIndex] ?? {}}
              onChange={(catId, text) => {
                setTriggerValues(prev => {
                  const next = { ...(prev[current._stepIndex] ?? {}), [catId]: text }
                  const filled = Object.values(next).filter(v => v.trim()).length
                  setNextEnabled(filled >= (current.min_required ?? 1))
                  return { ...prev, [current._stepIndex]: next }
                })
              }}
            />
          )}

          {current.type === 'body_diagram' && (
            <BodyDiagramBlock
              step={current}
              values={bodyValues[current._stepIndex] ?? {}}
              onChange={(field, text) => {
                setBodyValues(prev => {
                  const next = { ...(prev[current._stepIndex] ?? {}), [field]: text }
                  const allFilled = ['body','chest','head','behavior'].every(k => (next[k] ?? '').trim())
                  setNextEnabled(allFilled)
                  return { ...prev, [current._stepIndex]: next }
                })
              }}
            />
          )}

          {current.type === 'quality_explorer' && (
            <QualityExplorerBlock
              step={current}
              state={qualityState[current._stepIndex] ?? {}}
              onChange={st => {
                setQualityState(prev => ({ ...prev, [current._stepIndex]: st }))
                setNextEnabled(!!(st.sliderMoved && (st.description ?? '').trim()))
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

export function OwlScreen({ owl, text }) {
  // Support both bare key ("owl_happy") and filename ("Owl_graduation.png")
  const src = owl.endsWith('.png') ? `/assets/owls/${owl}` : `/assets/owls/${owl}.png`
  return (
    <div style={S.owlScreen}>
      <img src={src} alt="" style={S.owlImg} />
      <div style={S.speechBubble}>{text}</div>
    </div>
  )
}

// ── VideoBlock ────────────────────────────────────────────────────────────────

function VideoBlock({ step, demoMode, onComplete, db = globalSupabase }) {
  return (
    <div>
      {step.label && <p style={S.videoLabel}>{step.label}</p>}
      <StudyVideoPlayer
        storagePath={`liliana/${step.video_id}`}
        preview
        requiredWatchPct={0.9}
        onComplete={onComplete}
        supabaseClient={db}
      />
      {!demoMode && (
        <p style={S.videoNote}>Next will unlock once the video has been watched.</p>
      )}
    </div>
  )
}

// ── AudioBlock ────────────────────────────────────────────────────────────────

function AudioBlock({ step, onComplete, db = globalSupabase }) {
  const [url,        setUrl]        = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [progress,   setProgress]   = useState(0)   // 0–1
  const [complete,   setComplete]   = useState(false)
  const maxListened  = useRef(0)
  const audioRef     = useRef(null)

  useEffect(() => {
    // Strip bucket prefix from audio_path to get the key within the bucket
    const key = step.audio_path ? step.audio_path.replace(/^audios\//, '') : step.audio_id
    db.storage.from('audios').createSignedUrl(key, 3600).then(({ data, error: err }) => {
      if (err || !data?.signedUrl) { setError('Could not load audio.'); setLoading(false); return }
      setUrl(data.signedUrl)
      setLoading(false)
    })
  }, [step.audio_id, step.audio_path])

  function handleTimeUpdate(e) {
    const el = e.target
    if (!el.duration) return
    const pct = el.currentTime / el.duration
    if (el.currentTime > maxListened.current) maxListened.current = el.currentTime
    setProgress(pct)
    if (pct >= 0.9 && !complete) {
      setComplete(true)
      onComplete()
    }
  }

  function handleSeeking(e) {
    // Prevent seeking ahead of max listened
    const el = e.target
    if (el.currentTime > maxListened.current + 1) {
      el.currentTime = maxListened.current
    }
  }

  if (loading) return <p style={S.audioNote}>Loading audio…</p>
  if (error)   return <p style={{ ...S.audioNote, color: 'var(--err-tx)' }}>{error}</p>

  const pct = Math.round(progress * 100)
  return (
    <div>
      {step.label && <p style={S.videoLabel}>{step.label}</p>}
      <div style={S.audioWrap}>
        <audio
          ref={audioRef}
          src={url}
          controls
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          style={{ width: '100%', outline: 'none' }}
        />
        <div style={S.audioProgressRow}>
          <div style={S.audioProgressTrack}>
            <div style={{ ...S.audioProgressFill, width: `${pct}%`, background: complete ? 'var(--pk)' : 'var(--tx)' }} />
          </div>
          <span style={{ ...S.audioProgressLabel, color: complete ? 'var(--pk)' : 'var(--tx2)' }}>
            {complete ? '✓ Complete' : `${pct}% listened`}
          </span>
        </div>
      </div>
      {!complete && <p style={S.audioNote}>Next will unlock after listening to 90% of the audio.</p>}
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

// ── PromptResponseBlock (heading + preamble optional) ─────────────────────────

function PromptResponseBlock({ step, value, onChange }) {
  const rows = step.size === 'single_line' ? 1 : step.size === 'short' ? 3 : 5
  return (
    <div>
      {step.heading  && <h3 style={S.prHeading}>{step.heading}</h3>}
      {step.preamble && <p  style={S.prPreamble}>{step.preamble}</p>}
      <div style={S.promptBox}>{step.prompt}</div>
      {step.example && (
        <div style={S.exampleBox}>
          {step.example_label && <p style={S.exampleLabel}>{step.example_label}</p>}
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

// ── ClosingBlock (optional owl) ───────────────────────────────────────────────

function ClosingBlock({ step }) {
  const hasOwl = !!step.owl
  const owlSrc = step.owl
    ? (step.owl.endsWith('.png') ? `/assets/owls/${step.owl}` : `/assets/owls/${step.owl}.png`)
    : null

  return (
    <div>
      {hasOwl && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src={owlSrc} alt="" style={{ width: 110, height: 110, objectFit: 'contain' }} />
        </div>
      )}
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
          style={{ ...S.bigSlider, accentColor: 'var(--pk)' }}
        />
        <div style={S.sliderLabels}>
          <span style={{ whiteSpace: 'pre-line' }}>{step.min_label}</span>
          <span style={S.sliderVal}>{value}</span>
          <span style={{ whiteSpace: 'pre-line', textAlign: 'right' }}>{step.max_label}</span>
        </div>
      </div>
    </div>
  )
}

// ── MultiResponseBlock ────────────────────────────────────────────────────────

function MultiResponseBlock({ step, values, onChange }) {
  return (
    <div>
      <p style={S.promptLabel}>{step.prompt}</p>
      {values.map((val, i) => (
        <div key={i} style={S.multiRow}>
          <div style={S.inputNum}>{i + 1}</div>
          <input
            type="text"
            value={val}
            onChange={e => onChange(i, e.target.value)}
            style={S.multiInput}
          />
        </div>
      ))}
    </div>
  )
}

// ── TimerBlock ────────────────────────────────────────────────────────────────

function TimerBlock({ step, onComplete }) {
  const total    = step.duration_seconds ?? 30
  const [rem, setRem] = useState(total)
  const [done, setDone] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRem(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current)
          setDone(true)
          onComplete()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const mins = String(Math.floor(rem / 60)).padStart(1, '0')
  const secs = String(rem % 60).padStart(2, '0')
  const fillPct = ((total - rem) / total) * 100

  return (
    <div style={S.timerWrap}>
      {step.heading     && <h3 style={S.textH3}>{step.heading}</h3>}
      {step.instruction && <p  style={S.textP}>{step.instruction}</p>}
      <div style={{ ...S.timerDisplay, color: done ? 'var(--pk)' : 'var(--tx)' }}>
        {mins}:{secs}
      </div>
      <p style={S.timerSublabel}>
        {done ? 'Done — you can continue' : 'Observing…'}
      </p>
      <div style={S.timerTrack}>
        <div style={{ ...S.timerFill, width: `${fillPct}%` }} />
      </div>
    </div>
  )
}

// ── TrainingResponseBlock (single-select, 3 variants) ────────────────────────

function TrainingResponseBlock({ step, selected, onSelect }) {
  const [otherText, setOtherText] = useState(selected.other_text ?? '')

  function pickOption(label) {
    if (label === selected.selected) return
    const newOther = label === 'Other' ? otherText : ''
    setOtherText(newOther)
    onSelect(label, newOther)
  }

  function handleOtherText(e) {
    const t = e.target.value
    setOtherText(t)
    onSelect(selected.selected, t)
  }

  const opts = (step.options ?? []).map(o =>
    typeof o === 'string' ? { label: o } : o
  )

  return (
    <div>
      {step.scenario && (
        <div style={S.scenarioBox}>{step.scenario}</div>
      )}
      <p style={S.promptLabel}>{step.prompt}</p>
      {opts.map(opt => {
        const isSelected = selected.selected === opt.label
        return (
          <div key={opt.label}>
            <div
              style={{ ...S.mcOption, ...(isSelected ? S.mcOptionSelected : {}) }}
              onClick={() => pickOption(opt.label)}
            >
              <div style={{ ...S.mcRadio, ...(isSelected ? S.mcRadioSelected : {}) }} />
              <div>
                <div style={S.mcLabel}>{opt.label}</div>
                {opt.description && <div style={S.mcDesc}>{opt.description}</div>}
              </div>
            </div>
            {isSelected && opt.has_text_field && (
              <input
                type="text"
                value={otherText}
                onChange={handleOtherText}
                placeholder={opt.text_field_placeholder ?? 'Specify…'}
                style={{ ...S.multiInput, marginBottom: 10 }}
                autoFocus
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── TrainingResponseMultiBlock ────────────────────────────────────────────────

function TrainingResponseMultiBlock({ step, selected, onToggle }) {
  function toggle(label) {
    const next = selected.includes(label)
      ? selected.filter(l => l !== label)
      : [...selected, label]
    onToggle(next)
  }

  return (
    <div>
      <p style={S.promptLabel}>{step.prompt}</p>
      {(step.options ?? []).map(opt => {
        const isSel = selected.includes(opt.label)
        return (
          <div
            key={opt.label}
            style={{ ...S.mcOption, ...(isSel ? S.mcOptionSelected : {}), alignItems: 'flex-start' }}
            onClick={() => toggle(opt.label)}
          >
            <div style={{ ...S.distCheckbox, ...(isSel ? S.distCheckboxSelected : {}) }}>
              {isSel && <span style={S.distCheck}>✓</span>}
            </div>
            <div>
              <div style={S.distLabel}>{opt.label}</div>
              {opt.description && <div style={S.distDesc}>{opt.description}</div>}
              {opt.example     && <div style={S.distExample}>{opt.example}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── WordSelectBlock ───────────────────────────────────────────────────────────

function WordSelectBlock({ step, selected, onToggle }) {
  function toggle(word) {
    const next = selected.includes(word)
      ? selected.filter(w => w !== word)
      : [...selected, word]
    onToggle(next)
  }

  return (
    <div>
      <p style={S.promptLabel}>{step.prompt}</p>
      <div style={S.wordGrid}>
        {(step.words ?? []).map(word => {
          const isSel = selected.includes(word)
          return (
            <div
              key={word}
              style={{ ...S.wordChip, ...(isSel ? S.wordChipSelected : {}) }}
              onClick={() => toggle(word)}
            >
              {word}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ThoughtRatingBlock ────────────────────────────────────────────────────────

function ThoughtRatingBlock({ step, thoughts, ratings, movedMap, onRatingChange }) {
  if (thoughts.length === 0) {
    return <p style={S.textP}>No thoughts recorded. Please go back and complete the previous step.</p>
  }

  const ratingMap = Object.fromEntries((ratings ?? []).map(r => [r.thought, r.value]))

  return (
    <div>
      <p style={S.promptLabel}>{step.prompt}</p>
      {thoughts.map((thought, i) => {
        const val   = ratingMap[thought] ?? 50
        const moved = !!movedMap[i]
        return (
          <div key={i} style={S.thoughtSliderRow}>
            <div style={S.thoughtSliderLabel}>
              <span>"{thought}"</span>
              <span style={{ color: 'var(--pk)' }}>{moved ? val : '—'}</span>
            </div>
            <input
              type="range"
              min={step.min ?? 0}
              max={step.max ?? 100}
              value={val}
              onChange={e => onRatingChange(i, Number(e.target.value), thoughts)}
              style={{ width: '100%', accentColor: 'var(--pk)' }}
            />
            <div style={S.sliderEnds}>
              <span>{step.min ?? 0}</span>
              <span>{step.max ?? 100}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── ThoughtChoiceBlock ────────────────────────────────────────────────────────

function ThoughtChoiceBlock({ step, thoughts, selected, onSelect }) {
  if (thoughts.length === 0) {
    return <p style={S.textP}>No thoughts recorded. Please go back and complete the previous step.</p>
  }

  return (
    <div>
      <p style={S.promptLabel}>{step.prompt}</p>
      {thoughts.map(thought => {
        const isSel = selected === thought
        return (
          <div
            key={thought}
            style={{ ...S.mcOption, ...(isSel ? S.mcOptionSelected : {}) }}
            onClick={() => onSelect(thought)}
          >
            <div style={{ ...S.mcRadio, ...(isSel ? S.mcRadioSelected : {}) }} />
            <div style={S.mcLabel}>"{thought}"</div>
          </div>
        )
      })}
    </div>
  )
}

// ── TriggerMapBlock ───────────────────────────────────────────────────────────

function TriggerMapBlock({ step, values, onChange }) {
  const [openId, setOpenId] = useState(null)

  const filled    = Object.fromEntries(
    (step.categories ?? []).map(c => [c.id, (values[c.id] ?? '').trim().length > 0])
  )
  const filledCount = Object.values(filled).filter(Boolean).length
  const minReq = step.min_required ?? 1

  return (
    <div>
      {step.instruction && <p style={S.promptLabel}>{step.instruction}</p>}
      <div style={S.triggerGrid}>
        {(step.categories ?? []).map(cat => {
          const isOpen   = openId === cat.id
          const isFilled = filled[cat.id]
          return (
            <div
              key={cat.id}
              style={{
                ...S.triggerTile,
                ...(isFilled ? S.triggerTileFilled : {}),
                ...(isOpen   ? S.triggerTileOpen   : {}),
                gridColumn: isOpen ? '1 / -1' : undefined,
              }}
            >
              <div
                style={{ ...S.triggerHeader, ...(isOpen || isFilled ? S.triggerHeaderActive : {}) }}
                onClick={() => setOpenId(isOpen ? null : cat.id)}
              >
                <span>{cat.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--tx)', fontFamily: FONT }}>{cat.label}</span>
                <span style={{ ...S.triggerArrow, ...(isOpen ? S.triggerArrowOpen : {}) }}>▶</span>
              </div>
              {isOpen && (
                <div style={S.triggerBody}>
                  <textarea
                    value={values[cat.id] ?? ''}
                    onChange={e => onChange(cat.id, e.target.value)}
                    placeholder="Describe…"
                    style={S.triggerTextarea}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--tx2)', margin: '8px 0 0', fontFamily: FONT }}>
        {filledCount} categor{filledCount === 1 ? 'y' : 'ies'} filled.{' '}
        {filledCount >= minReq ? 'You may continue, or add more.' : `Fill at least ${minReq} to continue.`}
      </p>
    </div>
  )
}

// ── BodyDiagramBlock ──────────────────────────────────────────────────────────

const BODY_HOTSPOTS = [
  { id: 'body',     label: 'My body feels:',        cx: 65, cy: 130 },
  { id: 'chest',    label: 'I have emotions like:',  cx: 65, cy: 95  },
  { id: 'head',     label: 'I start thinking:',      cx: 65, cy: 28  },
  { id: 'behavior', label: 'I behave this way:',     cx: null, cy: null },  // full-width below
]

function BodyDiagramBlock({ step, values, onChange }) {
  // Determine which fields are unlocked
  const unlocked = {
    body:     true,
    chest:    (values.body ?? '').trim().length > 0,
    head:     (values.chest ?? '').trim().length > 0,
    behavior: (values.head ?? '').trim().length > 0,
  }

  function dotState(id) {
    if ((values[id] ?? '').trim()) return 'done'
    if (unlocked[id]) return 'active'
    return 'locked'
  }

  return (
    <div>
      {step.title       && <h3 style={S.textH3}>{step.title}</h3>}
      {step.instruction && <p style={S.textP}>{step.instruction}</p>}

      <style>{`
        @keyframes bodyDotPulse {
          0%   { r: 9; opacity: 0.8; }
          70%  { r: 14; opacity: 0; }
          100% { r: 9; opacity: 0; }
        }
      `}</style>

      {/* Layout: SVG left + three field pairs right */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>

        {/* Body figure SVG */}
        <svg viewBox="0 0 130 300" width="100" height="230" style={{ flexShrink: 0 }}>
          {/* Legs */}
          <line x1="55" y1="200" x2="40" y2="290" stroke="#1a9e9e" strokeWidth="8" strokeLinecap="round"/>
          <line x1="75" y1="200" x2="90" y2="290" stroke="#1a9e9e" strokeWidth="8" strokeLinecap="round"/>
          {/* Arms */}
          <line x1="47" y1="95"  x2="15" y2="170" stroke="#1a9e9e" strokeWidth="8" strokeLinecap="round"/>
          <line x1="83" y1="95"  x2="115" y2="170" stroke="#1a9e9e" strokeWidth="8" strokeLinecap="round"/>
          {/* Body torso */}
          <ellipse cx="65" cy="140" rx="28" ry="60" fill="#f0fafa" stroke="#1a9e9e" strokeWidth="2"/>
          {/* Head */}
          <circle  cx="65" cy="28" r="22" fill="#f0fafa" stroke="#1a9e9e" strokeWidth="2"/>

          {/* Hotspot dots (body, chest, head) */}
          {BODY_HOTSPOTS.filter(h => h.cx !== null).map(h => {
            const state = dotState(h.id)
            return (
              <g key={h.id}>
                {state === 'active' && (
                  <circle cx={h.cx} cy={h.cy} r="9" fill="#f59e0b" opacity="0.3">
                    <animate attributeName="r"       values="9;14;9" dur="1.4s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.8;0;0" dur="1.4s" repeatCount="indefinite"/>
                  </circle>
                )}
                <circle
                  cx={h.cx} cy={h.cy} r="7"
                  fill={state === 'done' ? 'var(--pk)' : state === 'active' ? '#f59e0b' : '#ddd'}
                  opacity={state === 'locked' ? 0.3 : 1}
                />
              </g>
            )
          })}
        </svg>

        {/* Fields: body, chest, head */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BODY_HOTSPOTS.filter(h => h.cx !== null).map(h => (
            <div
              key={h.id}
              style={{
                opacity: unlocked[h.id] ? 1 : 0.35,
                transform: unlocked[h.id] ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.25s, transform 0.25s',
              }}
            >
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', fontFamily: FONT, display: 'block', marginBottom: 4 }}>
                {h.label}
              </label>
              <textarea
                rows={2}
                disabled={!unlocked[h.id]}
                value={values[h.id] ?? ''}
                onChange={e => unlocked[h.id] && onChange(h.id, e.target.value)}
                placeholder={unlocked[h.id] ? 'Type here…' : 'Complete the field above first.'}
                style={{ ...S.triggerTextarea, resize: 'none', height: 54 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Behavior field — full width */}
      <div style={{
        opacity: unlocked.behavior ? 1 : 0.35,
        transform: unlocked.behavior ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 0.25s, transform 0.25s',
      }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', fontFamily: FONT, display: 'block', marginBottom: 4 }}>
          I behave this way:
        </label>
        <textarea
          rows={2}
          disabled={!unlocked.behavior}
          value={values.behavior ?? ''}
          onChange={e => unlocked.behavior && onChange('behavior', e.target.value)}
          placeholder={unlocked.behavior ? 'Type here…' : 'Complete the fields above first.'}
          style={{ ...S.triggerTextarea, resize: 'none', width: '100%', height: 54 }}
        />
      </div>
    </div>
  )
}

// ── QualityExplorerBlock ──────────────────────────────────────────────────────

function QualityExplorerBlock({ step, state, onChange }) {
  const activeIdx   = state.activeIdx ?? null
  const sliderValue = state.slider_value ?? 3
  const sliderMoved = state.sliderMoved ?? false
  const description = state.description ?? ''

  const activeQuality = activeIdx !== null ? (step.qualities ?? [])[activeIdx] : null

  function selectQuality(idx) {
    onChange({
      ...state,
      activeIdx:   idx,
      quality:     (step.qualities ?? [])[idx]?.label,
      slider_value: 3,
      sliderMoved: false,
      description: '',
    })
  }

  function handleSlider(v) {
    const next = {
      ...state,
      slider_value: v,
      sliderMoved:  true,
      quality:      activeQuality?.label,
    }
    onChange(next)
  }

  function handleDescription(e) {
    onChange({ ...state, description: e.target.value })
  }

  return (
    <div>
      {step.instruction && <p style={S.promptLabel}>{step.instruction}</p>}

      {/* Quality grid */}
      <div style={S.qualityGrid}>
        {(step.qualities ?? []).map((q, i) => (
          <div
            key={q.label}
            style={{ ...S.qualityBtn, ...(activeIdx === i ? S.qualityBtnActive : {}) }}
            onClick={() => selectQuality(i)}
          >
            {q.label}
          </div>
        ))}
      </div>

      {/* Active quality panel */}
      {activeQuality && (
        <div style={S.qualityPanel}>
          <p style={{ ...S.promptLabel, marginBottom: 12 }}>{activeQuality.label}</p>
          <input
            type="range"
            min={1}
            max={6}
            value={sliderValue}
            onChange={e => handleSlider(Number(e.target.value))}
            style={{ ...S.bigSlider, accentColor: sliderMoved ? 'var(--pk)' : 'var(--gy)' }}
          />
          <div style={S.sliderLabels}>
            <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{activeQuality.min_label}</span>
            <span style={{ ...S.sliderVal, color: sliderMoved ? 'var(--pk)' : 'var(--gy)' }}>{sliderValue}</span>
            <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{activeQuality.max_label}</span>
          </div>

          {/* Description — fades in after slider moved */}
          {sliderMoved && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 6, fontFamily: FONT }}>
                {step.describe_prompt ?? 'Describe this quality in your own words.'}
              </p>
              <input
                type="text"
                value={description}
                onChange={handleDescription}
                placeholder="e.g. heavy, sinking"
                style={{ ...S.multiInput, marginBottom: 0 }}
                autoFocus
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FONT = '"DM Sans", system-ui, sans-serif'

const S = {
  bg: {
    background: 'var(--bgp)',
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
    background: 'var(--bgp)',
    borderBottom: '1px solid var(--bds)',
    padding: '12px 20px 0',
  },
  stepCol: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
  },
  stepLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
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
    borderBottom: '1px solid var(--bd)',
  },
  practiceBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--bgp)', border: '1px solid #ddd',
    borderRadius: 6, padding: '4px 10px',
    fontSize: 11, fontWeight: 600, color: 'var(--tx2)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: 10,
  },
  badgeDot: {
    width: 6, height: 6, borderRadius: '50%', background: 'var(--pk)',
  },
  dayNumber: {
    fontSize: 22, fontWeight: 600, color: 'var(--tx)',
  },
  dayTitle: {
    fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginTop: 2,
  },
  daySubtitle: {
    fontSize: 13, color: 'var(--tx2)', marginTop: 2,
  },

  // ── Step pips
  pips: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '10px 24px',
    borderBottom: '1px solid var(--bgp)',
    background: 'var(--bg)',
  },
  pip: {
    width: 6, height: 6, borderRadius: '50%',
    transition: 'background 0.2s',
  },

  // ── Owl screen
  owlScreen: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '28px 0', flex: 1,
  },
  owlImg: {
    width: 110, height: 110, flexShrink: 0, objectFit: 'contain',
  },
  speechBubble: {
    background: 'var(--bg)',
    border: '1px solid var(--bds)',
    borderRadius: '12px 12px 12px 4px',
    padding: '14px 16px',
    fontSize: 14, lineHeight: 1.7, color: 'var(--tx)',
    flex: 1,
  },

  // ── Content area
  content: {
    flex: 1, padding: 24,
  },

  // ── Video
  videoLabel: {
    fontSize: 12, fontWeight: 600, color: 'var(--tx2)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    marginBottom: 10,
  },
  videoNote: {
    fontSize: 11, color: 'var(--gy)', marginTop: 8, textAlign: 'center',
  },

  // ── Audio
  audioWrap: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 8,
  },
  audioProgressRow: {
    display: 'flex', alignItems: 'center', gap: 12, marginTop: 10,
  },
  audioProgressTrack: {
    flex: 1, height: 4, background: 'var(--bd)', borderRadius: 2, overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%', borderRadius: 2, transition: 'width 1s linear',
  },
  audioProgressLabel: {
    fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap',
  },
  audioNote: {
    fontSize: 11, color: 'var(--gy)', marginTop: 8, textAlign: 'center',
  },

  // ── Text block
  textH3: {
    fontSize: 15, fontWeight: 600, color: 'var(--tx)',
    margin: '0 0 8px',
  },
  textP: {
    fontSize: 14, lineHeight: 1.7, color: 'var(--tx2)',
    margin: '0 0 12px',
  },

  // ── prompt_response
  prHeading: {
    fontSize: 15, fontWeight: 600, color: 'var(--tx)',
    margin: '0 0 10px',
  },
  prPreamble: {
    fontSize: 14, lineHeight: 1.7, color: 'var(--tx2)',
    margin: '0 0 12px',
    fontStyle: 'italic',
  },
  promptBox: {
    background: 'var(--bgp)',
    border: '1px solid var(--bds)',
    borderRadius: 8,
    padding: '14px 16px',
    fontSize: 14, lineHeight: 1.7, color: 'var(--tx)',
    marginBottom: 12,
  },
  exampleBox: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 12,
  },
  exampleLabel: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.04em', color: 'var(--tx2)',
    margin: '0 0 4px',
  },
  exampleText: {
    fontSize: 13, lineHeight: 1.6, color: 'var(--tx2)',
    fontStyle: 'italic', margin: 0,
  },
  textarea: {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid var(--bds)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14, fontFamily: FONT, color: 'var(--tx)',
    lineHeight: 1.6, resize: 'vertical',
    outline: 'none',
    background: '#fff',
  },

  // ── Closing
  closingP: {
    fontSize: 14, lineHeight: 1.7, color: 'var(--tx2)',
    margin: '0 0 12px',
  },

  // ── Slider
  promptLabel: {
    fontSize: 14, lineHeight: 1.7, color: 'var(--tx)',
    margin: '0 0 16px', fontFamily: FONT,
  },
  sliderWrap: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '20px 20px 16px',
  },
  bigSlider: {
    width: '100%',
    height: 8,
    accentColor: 'var(--pk)',
    cursor: 'pointer',
    marginBottom: 12,
    display: 'block',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    color: 'var(--tx2)',
    fontFamily: FONT,
  },
  sliderVal: {
    fontSize: 22, fontWeight: 600, color: 'var(--pk)', fontFamily: FONT,
  },
  sliderEnds: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 10, color: 'var(--tx2)', marginTop: 2, fontFamily: FONT,
  },

  // ── MultiResponse
  multiRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  inputNum: {
    width: 24, height: 24, borderRadius: '50%',
    background: 'var(--bgp)', fontSize: 11, fontWeight: 600, color: 'var(--tx2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    fontFamily: FONT,
  },
  multiInput: {
    flex: 1, border: '1px solid var(--bds)', borderRadius: 8,
    padding: '9px 12px', fontSize: 14, fontFamily: FONT,
    color: 'var(--tx)', background: '#fff', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  },

  // ── Timer
  timerWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 20px', gap: 12,
  },
  timerDisplay: {
    fontSize: 64, fontWeight: 600, color: 'var(--tx)',
    fontVariantNumeric: 'tabular-nums', letterSpacing: -2,
    fontFamily: FONT,
  },
  timerSublabel: {
    fontSize: 13, color: 'var(--tx2)', textAlign: 'center', fontFamily: FONT,
  },
  timerTrack: {
    width: 160, height: 4, background: 'var(--bd)', borderRadius: 2, overflow: 'hidden', marginTop: 8,
  },
  timerFill: {
    height: '100%', background: 'var(--pk)', borderRadius: 2, transition: 'width 1s linear',
  },

  // ── Training response (single-select)
  scenarioBox: {
    background: 'var(--bgp)', borderLeft: '3px solid var(--pk)', borderRadius: 6,
    padding: '10px 14px', fontSize: 13, color: 'var(--tx2)', marginBottom: 14,
    fontFamily: FONT,
  },
  mcOption: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '12px 14px', border: '1px solid var(--bds)',
    borderRadius: 10, cursor: 'pointer', marginBottom: 10, background: '#fff',
    fontFamily: FONT,
  },
  mcOptionSelected: {
    background: 'var(--bgp)', borderColor: 'var(--pk)',
  },
  mcRadio: {
    width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--bds)',
    flexShrink: 0, marginTop: 2,
  },
  mcRadioSelected: {
    borderColor: 'var(--pk)', background: 'var(--pk)', boxShadow: 'inset 0 0 0 3px #fff',
  },
  mcLabel: {
    fontSize: 14, fontWeight: 600, color: 'var(--tx)', fontFamily: FONT,
  },
  mcDesc: {
    fontSize: 12, color: 'var(--tx2)', marginTop: 2, fontFamily: FONT,
  },

  // ── Training response multi (checkbox)
  distCheckbox: {
    width: 18, height: 18, borderRadius: 4, border: '2px solid var(--bds)',
    flexShrink: 0, marginTop: 2, position: 'relative',
  },
  distCheckboxSelected: {
    borderColor: 'var(--pk)', background: 'var(--pk)',
  },
  distCheck: {
    position: 'absolute', top: -1, left: 1,
    fontSize: 12, color: '#fff', fontWeight: 600, fontFamily: FONT,
  },
  distLabel: {
    fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 4, fontFamily: FONT,
  },
  distDesc: {
    fontSize: 13, color: 'var(--tx2)', marginBottom: 4, fontFamily: FONT,
  },
  distExample: {
    fontSize: 12, color: 'var(--tx2)', fontStyle: 'italic', fontFamily: FONT,
  },

  // ── Word select
  wordGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12,
  },
  wordChip: {
    padding: '10px 18px', border: '1.5px solid var(--bds)', borderRadius: 20,
    fontSize: 14, fontWeight: 600, color: 'var(--tx)',
    background: '#fff', cursor: 'pointer', userSelect: 'none',
    transition: 'all 0.15s', fontFamily: FONT,
  },
  wordChipSelected: {
    background: 'var(--bgp)', borderColor: 'var(--pk)', color: 'var(--pkd)', fontWeight: 600,
  },

  // ── Thought sliders
  thoughtSliderRow: {
    marginBottom: 16,
  },
  thoughtSliderLabel: {
    fontSize: 13, fontWeight: 600, color: 'var(--tx)',
    marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontFamily: FONT,
  },

  // ── Trigger map
  triggerGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6,
  },
  triggerTile: {
    border: '1px solid var(--bds)', borderRadius: 10,
    overflow: 'hidden', background: '#fff',
  },
  triggerTileFilled: {
    borderColor: 'var(--pk)',
  },
  triggerTileOpen: {
    // gridColumn set inline
  },
  triggerHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 14px', cursor: 'pointer',
    background: 'var(--bg)', userSelect: 'none',
  },
  triggerHeaderActive: {
    background: 'var(--bgp)',
  },
  triggerArrow: {
    fontSize: 11, color: 'var(--tx2)',
    transition: 'transform 0.2s',
  },
  triggerArrowOpen: {
    transform: 'rotate(90deg)', color: 'var(--pk)',
  },
  triggerBody: {
    padding: '10px 14px', borderTop: '1px solid var(--bd)',
  },
  triggerTextarea: {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid var(--bds)', borderRadius: 6,
    padding: '8px 10px', fontSize: 13, fontFamily: FONT,
    resize: 'none', height: 68, outline: 'none',
    color: 'var(--tx)', background: '#fff',
  },

  // ── Quality explorer
  qualityGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
  },
  qualityBtn: {
    padding: '7px 14px', border: '1.5px solid var(--bds)', borderRadius: 16,
    fontSize: 13, fontWeight: 600, color: 'var(--tx)', background: '#fff',
    cursor: 'pointer', fontFamily: FONT,
  },
  qualityBtnActive: {
    background: 'var(--bgp)', borderColor: 'var(--pk)', color: 'var(--pkd)', fontWeight: 600,
  },
  qualityPanel: {
    background: 'var(--bg)', border: '1px solid var(--bd)',
    borderRadius: 12, padding: '16px 20px', marginBottom: 12,
  },

  // ── Footer
  footer: {
    padding: '16px 24px 28px',
    borderTop: '1px solid var(--bd)',
  },
  btnNext: {
    width: '100%', background: 'var(--tx)', color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '14px 24px', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT, letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  },
  btnDisabled: {
    background: 'var(--gy)', cursor: 'not-allowed',
  },
  btnDone: {
    width: '100%', background: 'var(--pkd)', color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '14px 24px', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT, letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  },
}

// Shared with WrapperElementPage so the standard session screens (welcome,
// check-ins, farewell) render in exactly this visual system.
export const interventionStyles = S
