import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCourseCode, loungePath } from '../courseRoutes'
import { AcademicShell } from '../AcademicChrome'
import AvatarMenu from '../fieldguide/AvatarMenu'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Weekly quiz runner. Completion-graded (the syllabus's 10%): the grade is
// for finishing, not for the score, so the page is deliberately relaxed —
// open book, all items on one scrolling page, answer whenever.
//
// Keys never reach the client ahead of an answer: answer_weekly_quiz_item()
// records the response and RETURNS the reveal (correct answer, rationale,
// Field Guide link). First answer is final — the reveal makes re-answering
// meaningless — and repeating a call is idempotent, so a double-tap or a
// retry after a network error cannot lose or duplicate anything.
// The optional confidence tap (syllabus: your personal "least sure of"
// list before the midterm) comes after the reveal and never blocks it.
export default function WeeklyQuiz({ session }) {
  const { courseCode, slug: slugParam, quizId } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)

  const [quiz, setQuiz] = useState(undefined)   // undefined = loading, null = unavailable
  const [quizError, setQuizError] = useState(null)
  // per-item UI state; the answered record itself lives in quiz.answers
  const [busyItem, setBusyItem] = useState(null)
  const [itemErrors, setItemErrors] = useState({})
  const [vsaDrafts, setVsaDrafts] = useState({})
  // Items answered in THIS session hold their reveal behind the confidence
  // tap (answer -> confidence -> reveal, so the rating is made before any
  // feedback can contaminate it). Items loaded already-answered from a
  // previous visit render fully revealed — they have seen it before.
  const [confPending, setConfPending] = useState({})

  const fetchQuiz = useCallback(async () => {
    // .rpc() reports failure in `error`, it does not throw — check it.
    const { data, error } = await supabase.rpc('get_weekly_quiz', { p_quiz_id: quizId })
    if (error) { setQuizError(error.message); setQuiz(null); return }
    setQuizError(null)
    setQuiz(data)
  }, [quizId])

  useEffect(() => { fetchQuiz() }, [fetchQuiz])

  async function answer(item, response) {
    if (busyItem) return
    setBusyItem(item.id)
    setItemErrors((e) => ({ ...e, [item.id]: null }))
    const { data, error } = await supabase.rpc('answer_weekly_quiz_item', {
      p_quiz_id: quizId, p_item_id: item.id, p_response: response,
    })
    setBusyItem(null)
    if (error) { setItemErrors((e) => ({ ...e, [item.id]: error.message })); return }
    // Merge the reveal locally instead of refetching everything. The reveal
    // stays hidden behind the confidence prompt for this item.
    setConfPending((c) => ({ ...c, [item.id]: true }))
    setQuiz((q) => ({
      ...q,
      completed_at: data.completed_at ?? q.completed_at,
      answers: { ...q.answers, [item.id]: { response, confidence: null, reveal: data.reveal } },
    }))
  }

  async function setConfidence(itemId, level) {
    setConfPending((c) => ({ ...c, [itemId]: false }))
    if (level === null) return // skipped — nothing to record
    const { error } = await supabase.rpc('set_weekly_quiz_confidence', {
      p_quiz_id: quizId, p_item_id: itemId, p_confidence: level,
    })
    if (error) return // confidence is optional; a failed tap is not worth an error state
    setQuiz((q) => ({
      ...q,
      answers: { ...q.answers, [itemId]: { ...q.answers[itemId], confidence: level } },
    }))
  }

  if (quiz === undefined) {
    return <Shell slug={slug} session={session}><p style={S.sub}>Loading…</p></Shell>
  }
  if (quiz === null) {
    return (
      <Shell slug={slug} session={session}>
        <h1 style={S.title}>This quiz isn't available.</h1>
        <p style={S.sub}>{quizError ?? 'It may not have opened yet.'}</p>
      </Shell>
    )
  }

  const items = quiz.items ?? []
  const answers = quiz.answers ?? {}
  const answeredCount = Object.keys(answers).length
  const completed = !!quiz.completed_at

  return (
    <Shell slug={slug} session={session}>
      <p style={S.eyebrow}>Weekly quiz · week {quiz.week_no}</p>
      <h1 style={S.title}>{quiz.title}</h1>
      <p style={S.sub}>
        Open book — you're graded on <strong>completing</strong> this, not on your score.
        Each answer shows you the correct one, why, and where in the Field Guide it lives.
      </p>
      <p style={S.deadline}>{deadlineLine(quiz)}</p>

      <div style={completed ? S.doneBanner : S.progressBanner}>
        {completed
          ? `Completed ${fmtDate(quiz.completed_at)} — you're done. Answers stay here to review.`
          : `${answeredCount} of ${items.length} answered`}
      </div>

      {items.map((item, idx) => {
        const a = answers[item.id]
        return (
          <div key={item.id} style={S.itemCard}>
            <p style={S.itemNo}>{idx + 1} of {items.length}{item.format === 'vsa' ? ' · short answer' : ''}</p>
            <p style={S.stem}>{item.stem}</p>

            {!a && item.options && (
              <div style={S.optionCol}>
                {item.options.map((opt, i) => (
                  <button key={i} style={S.optionBtn} disabled={busyItem === item.id}
                          onClick={() => answer(item, { choice: i })}>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {!a && !item.options && (
              <form style={S.vsaRow} onSubmit={(e) => {
                e.preventDefault()
                const text = (vsaDrafts[item.id] ?? '').trim()
                if (text) answer(item, { text })
              }}>
                <input
                  style={S.vsaInput}
                  value={vsaDrafts[item.id] ?? ''}
                  onChange={(e) => setVsaDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  placeholder="Your answer…"
                />
                <button type="submit" style={S.primaryBtn}
                        disabled={busyItem === item.id || !(vsaDrafts[item.id] ?? '').trim()}>
                  {busyItem === item.id ? 'Saving…' : 'Answer'}
                </button>
              </form>
            )}

            {itemErrors[item.id] && <p style={S.error}>{itemErrors[item.id]}</p>}

            {a && (
              <Reveal item={item} answer={a}
                      awaitingConfidence={!!confPending[item.id]}
                      onConfidence={(level) => setConfidence(item.id, level)} />
            )}
          </div>
        )
      })}

      {completed && (
        <p style={S.sub}>
          That's everything for this week. <Link to={loungePath(slug)} style={S.link}>Back to the class →</Link>
        </p>
      )}
    </Shell>
  )
}

// Answer → confidence → reveal, in that order. The confidence rating is a
// metacognitive judgment; showing ANY feedback first (even which option is
// green) turns it into hindsight. So while confidence is pending, the item
// shows only a neutral "locked in" echo of the student's own answer.
function Reveal({ item, answer, awaitingConfidence, onConfidence }) {
  const r = answer.reveal ?? {}
  const myChoice = answer.response?.choice
  const hasKey = typeof r.correct_index === 'number'
  const gotIt = hasKey && myChoice === r.correct_index

  if (awaitingConfidence) {
    return (
      <div style={S.reveal}>
        <p style={S.vsaMine}>
          Locked in: <strong>{item.options ? item.options[myChoice] : answer.response?.text}</strong>
        </p>
        <div style={S.confRow}>
          <span style={S.confLabel}>Before you see the answer — how sure are you? (optional; builds your study list)</span>
          <button style={S.confBtn} onClick={() => onConfidence(1)}>Guessing</button>
          <button style={S.confBtn} onClick={() => onConfidence(2)}>Fairly sure</button>
          <button style={S.confBtn} onClick={() => onConfidence(3)}>Certain</button>
          <button style={S.confSkip} onClick={() => onConfidence(null)}>skip</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.reveal}>
      {item.options && (
        <div style={S.optionCol}>
          {item.options.map((opt, i) => {
            const isCorrect = hasKey && i === r.correct_index
            const isMine = i === myChoice
            return (
              <div key={i} style={S.optionResult(isCorrect, isMine)}>
                {opt}
                {isCorrect && <span style={S.tag}> ✓ answer</span>}
                {isMine && !isCorrect && <span style={S.tagDim}> · yours</span>}
              </div>
            )
          })}
        </div>
      )}
      {!item.options && (
        <>
          <p style={S.vsaMine}>Yours: {answer.response?.text}</p>
          <p style={S.vsaModel}>Model answer: <strong>{r.answer_text}</strong></p>
        </>
      )}
      {item.options && (
        <p style={gotIt ? S.gotIt : S.notGotIt}>
          {gotIt ? 'You had it.' : 'No penalty — the attempt is the point.'}
        </p>
      )}
      <p style={S.rationale}>{r.rationale}</p>
      {r.link && <Link to={r.link} style={S.link}>Read this in the Field Guide →</Link>}
    </div>
  )
}

// Tier line, straight from the syllabus: full credit to the deadline, one
// grace week (automatic, no email), then 75% until the hard close.
function deadlineLine(quiz) {
  const now = Date.now()
  const due = new Date(quiz.due_at).getTime()
  const grace = due + 7 * 86400_000
  const close = new Date(quiz.hard_close_at).getTime()
  if (now <= due) return `Full credit through ${fmtDate(quiz.due_at)} — and a further week after that, automatically.`
  if (now <= grace) return `Still full credit (the automatic grace week) through ${fmtDateMs(grace)}.`
  if (now <= close) return `Late window — 75% credit until ${fmtDate(quiz.hard_close_at)}.`
  return 'This quiz has closed.'
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-CA', {
  month: 'short', day: 'numeric', timeZone: 'America/Toronto',
})
const fmtDateMs = (ms) => fmtDate(new Date(ms).toISOString())

function Shell({ slug, session, children }) {
  return (
    <AcademicShell courseCode={slug} homeTo={loungePath(slug)}
                   menu={session ? (
                     <AvatarMenu email={session.user.email} courseCode={slug} />
                   ) : null}>
      <div style={S.wrap}>
        <Link to={loungePath(slug)} style={S.backLink}>← back to class</Link>
        {children}
      </div>
    </AcademicShell>
  )
}

const S = {
  wrap: { maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px' },
  backLink: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 18 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8, lineHeight: 1.25 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  deadline: { fontFamily: MONO, fontSize: 12, color: 'var(--pk)', margin: '10px 0 0' },
  progressBanner: {
    fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', background: 'var(--bgc)',
    border: '1px solid var(--bd)', borderRadius: 10, padding: '8px 14px', margin: '16px 0',
  },
  doneBanner: {
    fontFamily: MONO, fontSize: 12, color: '#2e7d32', background: 'var(--bgc)',
    border: '1px solid #2e7d3255', borderRadius: 10, padding: '8px 14px', margin: '16px 0',
  },
  itemCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 18px', margin: '14px 0' },
  itemNo: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 8 },
  stem: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.5, marginBottom: 12 },
  optionCol: { display: 'flex', flexDirection: 'column', gap: 8 },
  optionBtn: {
    textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--bds)',
    background: 'transparent', color: 'var(--tx)', fontSize: 14, lineHeight: 1.4,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  optionResult: (isCorrect, isMine) => ({
    textAlign: 'left', padding: '10px 14px', borderRadius: 10, fontSize: 14, lineHeight: 1.4,
    border: '1px solid ' + (isCorrect ? '#2e7d32' : isMine ? 'var(--pk)' : 'var(--bd)'),
    background: isCorrect ? '#2e7d3211' : 'transparent',
    color: isCorrect || isMine ? 'var(--tx)' : 'var(--tx3)',
  }),
  tag: { fontFamily: MONO, fontSize: 11, color: '#2e7d32' },
  tagDim: { fontFamily: MONO, fontSize: 11, color: 'var(--pk)' },
  vsaRow: { display: 'flex', gap: 8 },
  vsaInput: {
    flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bds)',
    fontSize: 14, fontFamily: 'inherit',
  },
  vsaMine: { fontSize: 14, color: 'var(--tx2)', marginBottom: 6 },
  vsaModel: { fontSize: 14, color: 'var(--tx)' },
  primaryBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--pk)',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  reveal: { marginTop: 4 },
  gotIt: { fontFamily: MONO, fontSize: 12, color: '#2e7d32', margin: '10px 0 0' },
  notGotIt: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', margin: '10px 0 0' },
  confRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 },
  confLabel: { fontSize: 12.5, color: 'var(--tx2)', width: '100%' },
  confBtn: {
    padding: '7px 14px', borderRadius: 16, border: '1px solid var(--bds)', background: 'transparent',
    color: 'var(--tx)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  confSkip: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 12.5, cursor: 'pointer', fontFamily: MONO },
  rationale: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55, margin: '12px 0 6px' },
  link: { color: 'var(--pk)', fontSize: 14 },
  error: { color: '#c04a4a', fontSize: 13, marginTop: 8 },
}
