import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MoodTap from './MoodTap'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const PACING_LABELS = ['Too slow', '', '', '', 'Too fast']

function PacingTap({ onSubmit }) {
  const [selected, setSelected] = useState(null)
  function handleTap(v) {
    setSelected(v)
    setTimeout(() => onSubmit({ pacing: v }), 280)
  }
  return (
    <div style={S.stepWrap}>
      <p style={S.eyebrow}>Pacing</p>
      <h2 style={S.title}>How's the pace of class right now?</h2>
      <div style={S.pacingRow}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} style={S.pacingBtn(selected === v)} onClick={() => handleTap(v)}>{v}</button>
        ))}
      </div>
      <div style={S.pacingLabels}>
        <span>{PACING_LABELS[0]}</span>
        <span>{PACING_LABELS[4]}</span>
      </div>
    </div>
  )
}

function PromptTap({ promptText, onSubmit }) {
  const [value, setValue] = useState('')
  return (
    <div style={S.stepWrap}>
      <p style={S.eyebrow}>Prompt</p>
      <h2 style={S.title}>{promptText || 'What was on your mind just now?'}</h2>
      <textarea
        value={value} onChange={(e) => setValue(e.target.value)}
        style={S.textarea} rows={4} placeholder="Type your answer…"
      />
      <button style={S.primaryBtn} onClick={() => onSubmit({ prompt_response: value })}>Next →</button>
    </div>
  )
}

function QuestionBoxTap({ checkinId, userId, onSubmit }) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function handleSubmit() {
    setSubmitting(true)
    if (value.trim()) {
      await supabase.from('class_questions').insert({ checkin_id: checkinId, profile_id: userId, question_text: value.trim() })
    }
    setSubmitting(false)
    onSubmit({})
  }
  return (
    <div style={S.stepWrap}>
      <p style={S.eyebrow}>Question box</p>
      <h2 style={S.title}>Ask the instructor anything — anonymous, always</h2>
      <textarea
        value={value} onChange={(e) => setValue(e.target.value)}
        style={S.textarea} rows={4} placeholder="Optional — leave blank to skip"
      />
      <button style={S.primaryBtn} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Sending…' : value.trim() ? 'Send →' : 'Skip →'}
      </button>
    </div>
  )
}

// Renders the config activity sequence one step at a time, phone-first.
// Draft answers persist in component state across steps; a single upsert
// writes the full checkin_responses row on the final step (re-submit while
// the checkin is still open just updates it, per the unique constraint).
export default function CheckinRunner({ checkinId, config, session, onComplete }) {
  const activities = config?.activities ?? []
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function submitFinal(finalDraft) {
    setSubmitting(true)
    setError(null)
    const mood = finalDraft.emotionId !== undefined || finalDraft.neutral
      ? { emotion_id: finalDraft.emotionId ?? null, zone: finalDraft.zone ?? null, valence: finalDraft.valence, arousal: finalDraft.arousal, label: finalDraft.label }
      : null

    const { error: upsertErr } = await supabase
      .from('checkin_responses')
      .upsert({
        checkin_id: checkinId,
        profile_id: session.user.id,
        mood,
        pacing: finalDraft.pacing ?? null,
        prompt_response: finalDraft.prompt_response ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'checkin_id,profile_id' })

    if (upsertErr) { setSubmitting(false); setError(upsertErr.message); return }

    await supabase.rpc('award_checkin_points', { p_checkin_id: checkinId })
    setSubmitting(false)
    onComplete()
  }

  function handleStepSubmit(patch) {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (stepIndex + 1 < activities.length) setStepIndex(stepIndex + 1)
    else submitFinal(next)
  }

  const current = activities[stepIndex]

  // Config with zero activities (shouldn't happen — the console requires at
  // least one before it lets you save a checkin) or stepIndex somehow past
  // the end. Submitting belongs in an effect, not render, since it's a side
  // effect with its own setState calls.
  useEffect(() => {
    if (current === undefined && !submitting && !error) {
      // Deferred to a microtask so submitFinal's setSubmitting(true) doesn't
      // run synchronously within the effect body.
      Promise.resolve().then(() => submitFinal(draft))
    }
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  if (submitting) return <div style={S.stepWrap}><p style={S.hint}>Saving…</p></div>

  if (error) {
    return (
      <div style={S.stepWrap}>
        <p style={S.errorText}>{error}</p>
        <button style={S.primaryBtn} onClick={() => submitFinal(draft)}>Try again</button>
      </div>
    )
  }

  switch (current) {
    case 'mood':         return <MoodTap onSubmit={handleStepSubmit} />
    case 'pacing':        return <PacingTap onSubmit={handleStepSubmit} />
    case 'prompt':         return <PromptTap promptText={config?.prompt_text} onSubmit={handleStepSubmit} />
    case 'question_box':  return <QuestionBoxTap checkinId={checkinId} userId={session.user.id} onSubmit={handleStepSubmit} />
    default:
      return null // handled by the effect above
  }
}

const S = {
  stepWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 20px', maxWidth: 380, margin: '0 auto' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', marginBottom: 20 },
  hint: { fontSize: 13, color: 'var(--tx3)' },
  errorText: { fontSize: 13, color: '#c04a4a', marginBottom: 12 },
  textarea: {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--bds)',
    fontSize: 15, fontFamily: 'inherit', resize: 'vertical', marginBottom: 16, boxSizing: 'border-box',
  },
  primaryBtn: {
    padding: '12px 28px', borderRadius: 10, border: 'none', background: 'var(--pk)',
    color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  pacingRow: { display: 'flex', gap: 10, marginBottom: 10 },
  pacingBtn: (active) => ({
    width: 52, height: 52, borderRadius: '50%', fontSize: 17, fontWeight: 600,
    border: `2px solid ${active ? 'var(--pk)' : 'var(--bds)'}`,
    background: active ? 'var(--pk)' : 'var(--bgc)', color: active ? '#fff' : 'var(--tx)',
    cursor: 'pointer', fontFamily: 'inherit',
  }),
  pacingLabels: { display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 280, fontSize: 12, color: 'var(--tx3)' },
}
