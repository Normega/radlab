import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
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

function QuestionBoxTap({ checkinId, userId, intro, onSubmit, preview }) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function handleSubmit() {
    setSubmitting(true)
    // A preview must never write: this step inserts the moment it is pressed,
    // not at the end, so it needs its own guard as well as submitFinal's.
    if (value.trim() && !preview) {
      await supabase.from('class_questions').insert({ checkin_id: checkinId, profile_id: userId, question_text: value.trim() })
    }
    setSubmitting(false)
    onSubmit({})
  }
  return (
    <div style={S.stepWrap}>
      <p style={S.eyebrow}>Question box</p>
      <h2 style={S.title}>Ask the instructor anything — anonymous, always</h2>
      {intro && <p style={S.qbIntro}>{intro}</p>}
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

function QuizTap({ items, onSubmit }) {
  const [answers, setAnswers] = useState({})
  const allAnswered = items.length > 0 && items.every((q) => q.id in answers)
  return (
    <div style={S.stepWrap}>
      <p style={S.eyebrow}>Quiz</p>
      <h2 style={S.title}>Quick check</h2>
      {items.map((q) => (
        <div key={q.id} style={S.quizQuestion}>
          <p style={S.quizQuestionText}>{q.text}</p>
          {q.options.map((opt, i) => (
            <label key={i} style={S.quizOptionLabel(answers[q.id] === i)}>
              <input
                type="radio" name={q.id} checked={answers[q.id] === i}
                onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                style={{ marginRight: 8 }}
              />
              {opt}
            </label>
          ))}
        </div>
      ))}
      <button style={S.primaryBtn} onClick={() => onSubmit({ quiz_answers: answers })} disabled={!allAnswered}>
        Submit →
      </button>
    </div>
  )
}

// The end of a preview: where a student's answer would have been saved. For a
// quiz this is the point of the whole exercise — each pick is graded against
// the saved key, and an item with NO key is called out, because that is the
// failure "Reveal correct answers" would otherwise discover in front of the
// room.
function PreviewSummary({ config, result, answerKey, onRestart }) {
  const items = config?.quiz_items ?? []
  const picks = result.quiz_answers ?? {}
  const keyed = answerKey ?? {}
  const unkeyed = items.filter((q) => !(q.id in keyed))
  const agree = items.filter((q) => q.id in keyed && picks[q.id] === keyed[q.id]).length

  return (
    <div style={{ ...S.stepWrap, alignItems: 'stretch', textAlign: 'left' }}>
      <p style={{ ...S.eyebrow, textAlign: 'center' }}>End of the check-in</p>
      <h2 style={{ ...S.title, textAlign: 'center', marginBottom: 8 }}>This is where it would save</h2>
      <p style={{ ...S.hint, textAlign: 'center', marginBottom: 18 }}>
        Preview only — nothing was sent, and no points were awarded.
      </p>

      {items.length > 0 && (
        <div style={S.pvBlock}>
          <p style={S.pvHead}>
            Quiz key check · {answerKey ? `your picks match the key on ${agree} of ${items.length}` : 'loading the key…'}
          </p>
          {answerKey && unkeyed.length > 0 && (
            <p style={S.pvWarn}>⚠ {unkeyed.length} item{unkeyed.length === 1 ? ' has' : 's have'} no answer key saved. Reveal would show nothing for {unkeyed.length === 1 ? 'it' : 'them'}.</p>
          )}
          {items.map((q, i) => {
            const pick = picks[q.id]
            const key = keyed[q.id]
            const hasKey = q.id in keyed
            const match = hasKey && pick === key
            return (
              <div key={q.id} style={S.pvItem}>
                <p style={S.pvStem}>{i + 1}. {q.text.length > 110 ? `${q.text.slice(0, 110)}…` : q.text}</p>
                <p style={S.pvLine}>You picked: <strong>{pick != null ? q.options[pick] : '—'}</strong></p>
                <p style={{ ...S.pvLine, color: !hasKey ? '#b8860b' : match ? '#2e7d32' : '#c04a4a' }}>
                  {!hasKey ? '⚠ No key saved' : <>Key says: <strong>{q.options[key]}</strong>{match ? ' ✓' : ' ✗'}</>}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {result.prompt_response != null && (
        <div style={S.pvBlock}>
          <p style={S.pvHead}>Prompt answer</p>
          <p style={S.pvLine}>{result.prompt_response.trim() || '(left blank)'}</p>
        </div>
      )}
      {result.pacing != null && (
        <div style={S.pvBlock}><p style={S.pvHead}>Pacing</p><p style={S.pvLine}>{result.pacing} of 5</p></div>
      )}

      {onRestart && <button style={{ ...S.primaryBtn, alignSelf: 'center', marginTop: 8 }} onClick={onRestart}>Run it again</button>}
    </div>
  )
}

// Renders the config activity sequence one step at a time, phone-first.
// Draft answers persist in component state across steps; a single upsert
// writes the full checkin_responses row on the final step (re-submit while
// the checkin is still open just updates it, per the unique constraint).
//
// preview — { answerKey, onRestart } — runs the same steps an instructor's
// students will see, but writes nothing: the final upsert, the points award
// and the question-box insert are all skipped, and the end screen shows what
// WOULD have been recorded, grading quiz picks against the saved key. Built so
// a check-in can be seen as students see it without pressing Play (Norm,
// 2026-09-22) — and above all so a quiz key can be checked before it is live:
// a first-lecture in-class quiz had marked all four cases "Disorder", including
// the three the deck uses as counterexamples, and nothing short of answering
// it would have shown that.
export default function CheckinRunner({ checkinId, config, session, onComplete, preview }) {
  const activities = config?.activities ?? []
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [previewResult, setPreviewResult] = useState(null)

  async function submitFinal(finalDraft) {
    if (preview) { setPreviewResult(finalDraft); return }
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
        quiz_answers: finalDraft.quiz_answers ?? null,
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

  if (previewResult) {
    return <PreviewSummary config={config} result={previewResult}
                           answerKey={preview?.answerKey} onRestart={preview?.onRestart} />
  }

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
    // prompt_text doubles as the question box's intro line when there is no
    // prompt step to claim it (the closers) — with a prompt in the sequence
    // it already appeared one step earlier, so repeating it would be noise.
    case 'question_box':  return <QuestionBoxTap checkinId={checkinId} userId={session?.user?.id} intro={activities.includes('prompt') ? null : config?.prompt_text} onSubmit={handleStepSubmit} preview={!!preview} />
    case 'quiz':           return <QuizTap items={config?.quiz_items ?? []} onSubmit={handleStepSubmit} />
    default:
      return null // handled by the effect above
  }
}

const S = {
  stepWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 20px', maxWidth: 380, margin: '0 auto' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', marginBottom: 20 },
  qbIntro: { fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.5, margin: '-8px 0 16px', maxWidth: 340 },
  hint: { fontSize: 14, color: 'var(--tx3)' },
  errorText: { fontSize: 14, color: '#c04a4a', marginBottom: 12 },
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
  pvBlock: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 },
  pvHead: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 8px' },
  pvWarn: { fontSize: 13.5, color: '#b8860b', margin: '0 0 10px', lineHeight: 1.45 },
  pvItem: { borderTop: '1px solid var(--bd)', padding: '8px 0' },
  pvStem: { fontSize: 13.5, color: 'var(--tx2)', margin: '0 0 4px', lineHeight: 1.4 },
  pvLine: { fontSize: 14, color: 'var(--tx)', margin: '2px 0', lineHeight: 1.45 },
  quizQuestion: { width: '100%', textAlign: 'left', marginBottom: 20 },
  quizQuestionText: { fontSize: 15, color: 'var(--tx)', fontWeight: 600, marginBottom: 10 },
  quizOptionLabel: (active) => ({
    display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 10, fontSize: 14, marginBottom: 6, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--pk)' : 'var(--bds)'}`, background: active ? 'var(--bgp)' : 'var(--bgc)', color: 'var(--tx)',
  }),
}
