import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const ACTIVITY_LABELS = { mood: 'Mood', pacing: 'Pacing', prompt: 'Prompt', question_box: 'Question box', quiz: 'Quiz' }

function nearestLecture(lectures) {
  if (!lectures.length) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let best = lectures[0], bestDiff = Infinity
  for (const l of lectures) {
    if (!l.lecture_date) continue
    const diff = Math.abs(new Date(`${l.lecture_date}T00:00:00`) - today)
    if (diff < bestDiff) { bestDiff = diff; best = l }
  }
  return best
}

// Instructor's in-class control surface. Phone-first, one-thumb: open/close
// a check-in, watch responses land live, ride out (or extend) an auto-close
// countdown. Planning happens on the console — this is the live surface.
export default function ClassRemote({ session }) {
  // Resolved by ClassAdminRoute already (it needs the class to run the
  // admin check) — reusing it here instead of fetching it a second time.
  const classInfo = useOutletContext()
  const [lecture, setLecture] = useState(undefined)
  const [checkins, setCheckins] = useState([])
  const [responseCounts, setResponseCounts] = useState({})
  const [questionsByCheckin, setQuestionsByCheckin] = useState({})
  const [voteCounts, setVoteCounts] = useState({})
  const [connStatus, setConnStatus] = useState('connecting')
  const [actionError, setActionError] = useState(null)
  const [countdown, setCountdown] = useState(null)

  const broadcastRef = useRef(null)
  const respondedSetsRef = useRef({})
  const autoCloseFiredRef = useRef(new Set())

  // Shapes an embedded checkins(*, class_questions(*)) result into the
  // separate checkins/questionsByCheckin state shape the rest of the
  // component uses. Pure — no fetching — so both the initial combined-embed
  // load and later targeted refreshes can share it.
  function applyCheckinsData(rows) {
    // Leaving the embedded class_questions array on each checkin row is
    // harmless (the render logic reads from questionsByCheckin, not from
    // checkins[i].class_questions) — simpler than stripping it.
    setCheckins(rows)
    const grouped = {}
    for (const c of rows) {
      grouped[c.id] = [...(c.class_questions ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }
    setQuestionsByCheckin(grouped)
  }

  async function loadFollowUps(rows) {
    const open = rows.find((c) => c.status === 'open')
    if (open && !(open.id in responseCounts)) {
      const { count } = await supabase.from('checkin_responses').select('id', { count: 'exact', head: true }).eq('checkin_id', open.id)
      setResponseCounts((prev) => ({ ...prev, [open.id]: count ?? 0 }))
    }
    const publishedIds = rows.flatMap((c) => (c.class_questions ?? []).filter((q) => q.status === 'published').map((q) => q.id))
    if (publishedIds.length) {
      const { data: votes } = await supabase.from('question_votes').select('question_id').in('question_id', publishedIds)
      const counts = {}
      for (const v of votes ?? []) counts[v.question_id] = (counts[v.question_id] ?? 0) + 1
      setVoteCounts((prev) => ({ ...prev, ...counts }))
    }
  }

  async function loadCheckins(lectureId) {
    const { data } = await supabase
      .from('checkins').select('*, class_questions(*)').eq('lecture_id', lectureId).order('position', { ascending: true })
    const rows = data ?? []
    applyCheckinsData(rows)
    loadFollowUps(rows)
  }

  // Initial resolution: one embedded query for lectures + their checkins +
  // questions instead of separate sequential round trips — pick the nearest
  // lecture client-side and seed everything from the already-fetched data.
  // Later refreshes (after open/close/publish/etc.) use loadCheckins
  // directly, since at that point we already know which lecture we're on.
  useEffect(() => {
    if (!classInfo) return
    let cancelled = false
    supabase
      .from('lectures')
      .select('*, checkins(*, class_questions(*))')
      .eq('class_id', classInfo.id)
      .then(({ data }) => {
        if (cancelled) return
        const nearest = nearestLecture(data ?? [])
        setLecture(nearest)
        if (!nearest) return
        const rows = [...(nearest.checkins ?? [])].sort((a, b) => a.position - b.position)
        applyCheckinsData(rows)
        loadFollowUps(rows)
      })
    return () => { cancelled = true }
  }, [classInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast channel — this is the one thing that actually pushes state to
  // the student and screen views (they're consumers only).
  useEffect(() => {
    if (!classInfo) return
    const channel = supabase.channel(`lounge:${classInfo.id}`)
    channel.subscribe((status) => setConnStatus(status === 'SUBSCRIBED' ? 'live' : 'reconnecting'))
    broadcastRef.current = channel
    return () => { supabase.removeChannel(channel); broadcastRef.current = null }
  }, [classInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- re-subscribing on every classInfo object identity change (not just id) would tear down/rebuild the channel needlessly

  const openCheckin = checkins.find((c) => c.status === 'open')

  // Live response counter via Postgres Changes on checkin_responses (added
  // to the supabase_realtime publication in the WP1 migration).
  useEffect(() => {
    if (!openCheckin) return
    const ch = supabase
      .channel(`checkin-responses-${openCheckin.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_responses', filter: `checkin_id=eq.${openCheckin.id}` }, (payload) => {
        const pid = payload.new?.profile_id
        if (!pid) return
        const set = respondedSetsRef.current[openCheckin.id] ?? new Set()
        set.add(pid)
        respondedSetsRef.current[openCheckin.id] = set
        setResponseCounts((prev) => ({ ...prev, [openCheckin.id]: set.size }))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [openCheckin?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- only the id should re-trigger the subscription, not every field on the checkin row

  // Live question feed for the open checkin — only an open checkin can
  // receive new submissions (RLS only allows class_questions inserts while
  // status='open'), so closed/results_ready checkins' questions never need
  // a live subscription, just whatever loadCheckins already fetched.
  useEffect(() => {
    if (!openCheckin) return
    const ch = supabase
      .channel(`remote-questions-${openCheckin.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'class_questions', filter: `checkin_id=eq.${openCheckin.id}` }, (payload) => {
        setQuestionsByCheckin((prev) => ({
          ...prev,
          [openCheckin.id]: [...(prev[openCheckin.id] ?? []), payload.new],
        }))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [openCheckin?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- only the id should re-trigger the subscription, not every field on the checkin row

  function broadcast(event, checkinId) {
    broadcastRef.current?.send({ type: 'broadcast', event, payload: { checkin_id: checkinId } })
  }

  async function handleOpen(checkin) {
    setActionError(null)
    const conflict = checkins.find((c) => c.id !== checkin.id && ['staged', 'open'].includes(c.status))
    if (conflict) { setActionError('Close the other live check-in first.'); return }
    const { error } = await supabase.from('checkins').update({ status: 'open', opened_at: new Date().toISOString() }).eq('id', checkin.id)
    if (error) { setActionError(error.message); return }
    broadcast('open', checkin.id)
    loadCheckins(lecture.id)
  }

  async function handleClose(checkin) {
    setActionError(null)
    const { error } = await supabase.from('checkins').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', checkin.id)
    if (error) { setActionError(error.message); return }
    broadcast('closed', checkin.id)
    loadCheckins(lecture.id)
  }

  async function handleShowResults(checkin) {
    setActionError(null)
    const { error } = await supabase.from('checkins').update({ status: 'results_ready' }).eq('id', checkin.id)
    if (error) { setActionError(error.message); return }
    broadcast('results_ready', checkin.id)
    loadCheckins(lecture.id)
  }

  async function handleRevealQuiz(checkin) {
    setActionError(null)
    const { error } = await supabase.from('checkins').update({ quiz_revealed_at: new Date().toISOString() }).eq('id', checkin.id)
    if (error) { setActionError(error.message); return }
    loadCheckins(lecture.id)
  }

  // Without this, a results_ready checkin restores as "the live one" on
  // every ClassRoom/ClassScreen reload forever (nothing else resets it) —
  // the lobby, and the avatar wall that only renders there, become
  // unreachable after the first check-in of a term. Persisted (not just
  // broadcast) so a page reload doesn't revert to showing stale results.
  async function handleDismiss(checkin) {
    setActionError(null)
    const { error } = await supabase.from('checkins').update({ dismissed_at: new Date().toISOString() }).eq('id', checkin.id)
    if (error) { setActionError(error.message); return }
    broadcast('dismissed', checkin.id)
    loadCheckins(lecture.id)
  }

  async function handleExtend(checkin) {
    await supabase.from('checkins').update({ auto_close_seconds: (checkin.auto_close_seconds ?? 0) + 60 }).eq('id', checkin.id)
    loadCheckins(lecture.id)
  }

  async function handlePublishQuestion(question) {
    const { error } = await supabase.from('class_questions').update({ status: 'published' }).eq('id', question.id)
    if (error) { setActionError(error.message); return }
    setQuestionsByCheckin((prev) => ({
      ...prev,
      [question.checkin_id]: (prev[question.checkin_id] ?? []).map((q) => (q.id === question.id ? { ...q, status: 'published' } : q)),
    }))
  }

  async function handleAnswerQuestion(question) {
    const { error } = await supabase.from('class_questions').update({ status: 'answered' }).eq('id', question.id)
    if (error) { setActionError(error.message); return }
    setQuestionsByCheckin((prev) => ({
      ...prev,
      [question.checkin_id]: (prev[question.checkin_id] ?? []).map((q) => (q.id === question.id ? { ...q, status: 'answered' } : q)),
    }))
  }

  // Visible countdown; fires the actual close itself, but the checkin_responses
  // RLS policies independently enforce the same deadline server-side so a
  // late submission is rejected even if this client never gets to fire it.
  useEffect(() => {
    if (!openCheckin || openCheckin.auto_close_seconds == null || !openCheckin.opened_at) {
      queueMicrotask(() => setCountdown(null))
      return
    }
    const deadline = new Date(openCheckin.opened_at).getTime() + openCheckin.auto_close_seconds * 1000
    function tick() {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 0 && !autoCloseFiredRef.current.has(openCheckin.id)) {
        autoCloseFiredRef.current.add(openCheckin.id)
        handleClose(openCheckin)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [openCheckin?.id, openCheckin?.auto_close_seconds, openCheckin?.opened_at]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let wakeLock = null
    async function acquire() { try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* unsupported */ } }
    acquire()
    function onVisible() { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { wakeLock?.release?.().catch(() => {}); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  if (!classInfo || lecture === undefined) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh' }}><Nav session={session} /></div>
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={S.header}>
        <div>
          <p style={S.eyebrow}>{classInfo.name}</p>
          <h1 style={S.h1}>{lecture ? (lecture.title || `Lecture ${lecture.number ?? ''}`) : 'No lecture planned'}</h1>
        </div>
        <span style={S.connBadge(connStatus)}>{connStatus === 'live' ? '● live' : '○ reconnecting'}</span>
      </div>

      <div style={S.wrap}>
        {actionError && <p style={S.error}>{actionError}</p>}

        {!lecture ? (
          <p style={S.hint}>No lecture found near today's date. Plan one from the console.</p>
        ) : checkins.length === 0 ? (
          <p style={S.hint}>No check-ins planned for this lecture yet.</p>
        ) : (
          checkins.map((c) => {
            const isOpen = c.status === 'open'
            const activities = (c.config?.activities ?? []).map((a) => ACTIVITY_LABELS[a] ?? a).join(' → ')
            const collectsQuestions = (c.config?.activities ?? []).includes('question_box') && c.status !== 'planned'
            const hasQuiz = (c.config?.activities ?? []).includes('quiz')
            const questions = questionsByCheckin[c.id] ?? []
            return (
              <div key={c.id} style={S.card}>
                <div style={S.cardHeader}>
                  <span style={S.pos}>#{c.position}</span>
                  <span style={S.activities}>{activities || '—'}</span>
                  <span style={S.statusBadge(c.status)}>{c.status.replace('_', ' ')}</span>
                </div>

                {isOpen && (
                  <div style={S.liveRow}>
                    <span style={S.counter}>{responseCounts[c.id] ?? 0} responded</span>
                    {countdown !== null && <span style={S.countdown}>{countdown}s left</span>}
                  </div>
                )}

                <div style={S.btnRow}>
                  {c.status === 'planned' && <button style={S.bigBtn} onClick={() => handleOpen(c)}>Open</button>}
                  {isOpen && (
                    <>
                      <button style={S.bigBtn} onClick={() => handleClose(c)}>Close</button>
                      {c.auto_close_seconds != null && <button style={S.ghostBtn} onClick={() => handleExtend(c)}>+60s</button>}
                    </>
                  )}
                  {c.status === 'closed' && <button style={S.bigBtn} onClick={() => handleShowResults(c)}>Show results</button>}
                  {c.status === 'results_ready' && (
                    <>
                      {hasQuiz && !c.quiz_revealed_at
                        ? <button style={S.bigBtn} onClick={() => handleRevealQuiz(c)}>Reveal quiz answers</button>
                        : <span style={S.doneLabel}>{hasQuiz ? 'Quiz answers revealed' : 'Results shown'}</span>}
                      {c.dismissed_at
                        ? <span style={S.doneLabel}>Back in lobby</span>
                        : <button style={S.ghostBtn} onClick={() => handleDismiss(c)}>Back to lobby</button>}
                    </>
                  )}
                </div>

                {collectsQuestions && (
                  <div style={S.questionsWrap}>
                    <p style={S.questionsLabel}>Questions {questions.length > 0 && `(${questions.length})`}</p>
                    {!questions.length ? (
                      <p style={S.noQuestions}>None yet.</p>
                    ) : (
                      [...questions]
                        .sort((a, b) => {
                          if (a.status === 'published' && b.status === 'published') return (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0)
                          return new Date(a.created_at) - new Date(b.created_at)
                        })
                        .map((q) => (
                          <div key={q.id} style={S.questionRow}>
                            <div style={S.questionTextRow}>
                              <span style={S.questionText}>{q.question_text}</span>
                              {q.status === 'published' && <span style={S.voteCount}>▲ {voteCounts[q.id] ?? 0}</span>}
                            </div>
                            <div style={S.questionActions}>
                              {q.status === 'submitted' && <button style={S.smallBtn} onClick={() => handlePublishQuestion(q)}>Publish</button>}
                              {q.status === 'published' && <button style={S.smallBtn} onClick={() => handleAnswerQuestion(q)}>Mark answered</button>}
                              {q.status === 'answered' && <span style={S.answeredLabel}>Answered</span>}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const S = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 8px', gap: 12 },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 4 },
  h1: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)' },
  connBadge: (status) => ({
    fontFamily: MONO, fontSize: 11, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap',
    background: status === 'live' ? '#e5f7ee' : '#fdf2e5', color: status === 'live' ? '#1a8a4a' : '#b8760f',
  }),
  wrap: { maxWidth: 480, margin: '0 auto', padding: '12px 16px 40px' },
  hint: { fontSize: 14, color: 'var(--tx3)', textAlign: 'center', padding: '40px 20px' },
  error: { fontSize: 13, color: '#c04a4a', background: '#fdecec', border: '1px solid #f3b8b8', borderRadius: 10, padding: '10px 14px', marginBottom: 12 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '16px 18px', marginBottom: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  pos: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  activities: { flex: 1, fontSize: 15, color: 'var(--tx)', fontWeight: 600 },
  statusBadge: (status) => ({
    fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 8px', borderRadius: 6,
    background: status === 'open' ? 'var(--pkb)' : status === 'results_ready' ? '#e5f7ee' : 'var(--bg)',
    color: status === 'open' ? 'var(--pkd)' : status === 'results_ready' ? '#1a8a4a' : 'var(--tx3)',
  }),
  liveRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontFamily: MONO, fontSize: 13 },
  counter: { color: 'var(--tx)' },
  countdown: { color: 'var(--pk)', fontWeight: 700 },
  btnRow: { display: 'flex', gap: 8 },
  bigBtn: {
    flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', background: 'var(--pk)',
    color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  ghostBtn: {
    padding: '14px 18px', borderRadius: 12, border: '1px solid var(--bds)', background: 'var(--bgc)',
    color: 'var(--tx2)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
  },
  doneLabel: { fontSize: 13, color: 'var(--tx3)', padding: '10px 0' },
  questionsWrap: { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bd)' },
  questionsLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 8 },
  noQuestions: { fontSize: 13, color: 'var(--tx3)' },
  questionRow: { background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  questionTextRow: { display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  questionText: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.4 },
  voteCount: { fontFamily: MONO, fontSize: 12, color: 'var(--pkd)', whiteSpace: 'nowrap' },
  questionActions: { display: 'flex' },
  smallBtn: {
    padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--pk)',
    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  answeredLabel: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)' },
}
