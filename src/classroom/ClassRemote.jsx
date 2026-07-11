import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const ACTIVITY_LABELS = { mood: 'Mood', pacing: 'Pacing', prompt: 'Prompt', question_box: 'Question box' }

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
  const { slug } = useParams()
  const [classInfo, setClassInfo] = useState(undefined)
  const [lecture, setLecture] = useState(undefined)
  const [checkins, setCheckins] = useState([])
  const [responseCounts, setResponseCounts] = useState({})
  const [connStatus, setConnStatus] = useState('connecting')
  const [actionError, setActionError] = useState(null)
  const [countdown, setCountdown] = useState(null)

  const broadcastRef = useRef(null)
  const respondedSetsRef = useRef({})
  const autoCloseFiredRef = useRef(new Set())

  async function loadCheckins(lectureId) {
    const { data } = await supabase.from('checkins').select('*').eq('lecture_id', lectureId).order('position', { ascending: true })
    const rows = data ?? []
    setCheckins(rows)
    const open = rows.find((c) => c.status === 'open')
    if (open && !(open.id in responseCounts)) {
      const { count } = await supabase.from('checkin_responses').select('id', { count: 'exact', head: true }).eq('checkin_id', open.id)
      setResponseCounts((prev) => ({ ...prev, [open.id]: count ?? 0 }))
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: cls } = await supabase.from('classes').select('id, name, slug').eq('slug', slug).maybeSingle()
      if (cancelled) return
      setClassInfo(cls ?? null)
      if (!cls) { setLecture(null); return }
      const { data: lecs } = await supabase.from('lectures').select('*').eq('class_id', cls.id)
      if (cancelled) return
      setLecture(nearestLecture(lecs ?? []))
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    // Deferred so loadCheckins' setState calls don't run synchronously
    // within the effect body.
    if (lecture?.id) queueMicrotask(() => loadCheckins(lecture.id))
  }, [lecture?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleExtend(checkin) {
    await supabase.from('checkins').update({ auto_close_seconds: (checkin.auto_close_seconds ?? 0) + 60 }).eq('id', checkin.id)
    loadCheckins(lecture.id)
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

  if (classInfo === undefined || lecture === undefined) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh' }}><Nav session={session} /></div>
  }
  if (!classInfo) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={session} />
        <div style={S.wrap}><p style={S.title}>Class not found</p></div>
      </div>
    )
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
                  {c.status === 'results_ready' && <span style={S.doneLabel}>Results shown</span>}
                </div>
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
  title: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', padding: 20 },
  error: { fontSize: 13, color: '#c04a4a', background: '#fdecec', border: '1px solid #f3b8b8', borderRadius: 10, padding: '10px 14px', marginBottom: 12 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '16px 18px', marginBottom: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  pos: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  activities: { flex: 1, fontSize: 15, color: 'var(--tx)', fontWeight: 500 },
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
}
