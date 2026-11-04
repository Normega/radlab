import { useEffect, useRef, useState } from 'react'
import { createAwayTracker } from './awayTracker'
import { PASSAGES } from './readingPassages'
import { useScrollToTopOn } from '../../../lib/scrollToTop'

// The reading arm of PracticeTaskStep: a neutral passage, then three
// multiple-choice questions. As in Sandy's prototype, no answers and no score are
// ever shown (performance feedback could raise stress); the answers are saved as
// an attention check. Time away from the page is counted from the passage to the
// last question.

export default function ReadingTask({ config, onDone }) {
  const key     = config?.passage ?? 'mail_sorting_centre'
  const passage = PASSAGES[key]

  const [stage, setStage]     = useState('intro')   // intro → passage → questions
  const [answers, setAnswers] = useState({})
  const awayRef  = useRef(null)
  const timesRef = useRef({})
  useScrollToTopOn(stage)

  useEffect(() => () => awayRef.current?.stop(), [])

  if (!passage) return <div className="pt-note">Unknown reading passage “{key}”.</div>

  function begin() {
    awayRef.current = createAwayTracker()
    timesRef.current.readStart = performance.now()
    setStage('passage')
  }

  function finishedReading() {
    const now = performance.now()
    timesRef.current.readMs = Math.round(now - timesRef.current.readStart)
    timesRef.current.qStart = now
    setStage('questions')
  }

  function submit() {
    const away = awayRef.current.stop()
    const list = passage.questions.map((q, i) => ({
      question:    i + 1,
      answer:      answers[i],
      answer_text: q.o[answers[i]],
      correct:     answers[i] === q.correct,
    }))
    onDone({
      passage:         key,
      read_ms:         timesRef.current.readMs,
      questions_ms:    Math.round(performance.now() - timesRef.current.qStart),
      hidden_ms:       away.hidden_ms,
      left_page_count: away.left_page_count,
      answers:         list,
      total_correct:   list.filter(a => a.correct).length,
    })
  }

  if (stage === 'intro') {
    return (
      <div className="pt-card">
        <h2>Next: a short reading task</h2>
        <p>It takes about {passage.minutes} minutes. You will read a short passage, then answer three questions about it. Please stay on this page during the task, and do not switch tabs. Press Start to begin the task.</p>
        <div className="pt-actions"><button type="button" className="pt-btn" onClick={begin}>Start</button></div>
      </div>
    )
  }

  if (stage === 'passage') {
    return (
      <div className="pt-card pt-passage">
        <h2>{passage.title}</h2>
        {passage.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        <div className="pt-actions">
          <button type="button" className="pt-btn" onClick={finishedReading}>I have finished reading</button>
        </div>
      </div>
    )
  }

  const complete = passage.questions.every((_, i) => answers[i] !== undefined)
  return (
    <div className="pt-card">
      <h3>Three questions about the passage</h3>
      {passage.questions.map((q, i) => (
        <div key={i} role="radiogroup" aria-labelledby={`pt-q${i}`}>
          <div className="pt-q" id={`pt-q${i}`}>{i + 1}. {q.q}</div>
          {q.o.map((o, j) => (
            <button
              key={j}
              type="button"
              role="radio"
              aria-checked={answers[i] === j}
              className="pt-opt"
              onClick={() => setAnswers(a => ({ ...a, [i]: j }))}
            >
              {o}
            </button>
          ))}
        </div>
      ))}
      <div className="pt-actions">
        <button type="button" className="pt-btn" disabled={!complete} onClick={submit}>Continue</button>
      </div>
    </div>
  )
}
