import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'
import ResultsView from './ResultsView'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const ACTIVITY_LABELS = { mood: 'Mood', pacing: 'Pacing', prompt: 'Prompt', question_box: 'Question box', quiz: 'Quiz' }
const BROADCAST_EVENTS = ['staged', 'open', 'closed', 'results_ready']

// Projector display. Opened once before class, zero interaction after —
// pure consumer of the class broadcast channel, same pattern ClassRoom
// uses, restoring state from the DB on load/reload so it never needs a
// broadcast to recover after being opened cold.
export default function ClassScreen() {
  // Resolved by ClassAdminRoute already — see ClassRemote for the same pattern.
  const classInfo = useOutletContext()
  const [liveCheckin, setLiveCheckin] = useState(undefined)
  const [responseCount, setResponseCount] = useState(0)
  const respondedSetRef = useRef(new Set())

  useEffect(() => {
    if (!classInfo) return
    let cancelled = false
    supabase
      .from('checkins')
      .select('id, status, config, lecture_id, lectures!inner(class_id)')
      .eq('lectures.class_id', classInfo.id)
      .neq('status', 'planned')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return
        const row = data?.[0]
        setLiveCheckin(row ? { id: row.id, status: row.status, config: row.config } : null)
      })
    return () => { cancelled = true }
  }, [classInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- only the id should re-trigger this, not every field on classInfo

  useEffect(() => {
    if (!classInfo) return
    const channel = supabase.channel(`lounge:${classInfo.id}`)
    for (const status of BROADCAST_EVENTS) {
      channel.on('broadcast', { event: status }, ({ payload }) => {
        if (!payload?.checkin_id) return
        respondedSetRef.current = new Set()
        setResponseCount(0)
        setLiveCheckin((prev) => ({
          id: payload.checkin_id,
          status,
          config: payload.checkin_id === prev?.id ? prev?.config : undefined,
        }))
      })
    }
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [classInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!liveCheckin || liveCheckin.config !== undefined) return
    let cancelled = false
    supabase.from('checkins').select('config').eq('id', liveCheckin.id).single().then(({ data }) => {
      if (cancelled || !data) return
      setLiveCheckin((prev) => (prev?.id === liveCheckin.id ? { ...prev, config: data.config } : prev))
    })
    return () => { cancelled = true }
  }, [liveCheckin])

  // Live response count while a checkin is open.
  useEffect(() => {
    if (liveCheckin?.status !== 'open') return
    let cancelled = false
    supabase.from('checkin_responses').select('id', { count: 'exact', head: true }).eq('checkin_id', liveCheckin.id).then(({ count }) => {
      if (!cancelled) setResponseCount(count ?? 0)
    })
    const ch = supabase
      .channel(`screen-responses-${liveCheckin.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_responses', filter: `checkin_id=eq.${liveCheckin.id}` }, (payload) => {
        const pid = payload.new?.profile_id
        if (!pid) return
        respondedSetRef.current.add(pid)
        setResponseCount(respondedSetRef.current.size)
      })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [liveCheckin?.id, liveCheckin?.status])

  useEffect(() => {
    let wakeLock = null
    async function acquire() { try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* unsupported */ } }
    acquire()
    function onVisible() { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { wakeLock?.release?.().catch(() => {}); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  if (!classInfo) return <div style={S.stage} />

  const joinUrl = `${window.location.origin}/class/${classInfo.slug}`

  if (liveCheckin?.status === 'results_ready') {
    return (
      <div style={S.stage}>
        <p style={S.eyebrow}>{classInfo.name}</p>
        <div style={S.resultsScale}><ResultsView checkinId={liveCheckin.id} /></div>
      </div>
    )
  }

  if (liveCheckin?.status === 'open') {
    const activities = (liveCheckin.config?.activities ?? []).map((a) => ACTIVITY_LABELS[a] ?? a).join(' → ')
    return (
      <div style={S.stage}>
        <p style={S.eyebrow}>{classInfo.name}</p>
        <h1 style={S.openTitle}>{activities || 'Check-in open'}</h1>
        <p style={S.counter}>{responseCount} responded</p>
        <div style={S.qrRow}>
          <QRCode value={joinUrl} size={140} fgColor="#1c1c1e" bgColor="#FCF0F5" />
          <p style={S.qrHint}>{joinUrl.replace(/^https?:\/\//, '')}</p>
        </div>
      </div>
    )
  }

  // idle: no checkin, staged, or closed — same calm waiting display
  return (
    <div style={S.stage}>
      <div style={S.idlePulse} />
      <p style={S.eyebrow}>Lecture Lounge</p>
      <h1 style={S.idleTitle}>{classInfo.name}</h1>
      <div style={S.qrRow}>
        <QRCode value={joinUrl} size={180} fgColor="#1c1c1e" bgColor="#FCF0F5" />
        <p style={S.qrHint}>{joinUrl.replace(/^https?:\/\//, '')}</p>
      </div>
    </div>
  )
}

const S = {
  stage: {
    minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', position: 'relative',
  },
  eyebrow: { fontFamily: MONO, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 16 },
  idleTitle: { fontFamily: SERIF, fontSize: 56, color: 'var(--tx)', marginBottom: 32, maxWidth: 900 },
  openTitle: { fontFamily: SERIF, fontSize: 48, color: 'var(--tx)', marginBottom: 12, maxWidth: 900 },
  counter: { fontFamily: MONO, fontSize: 28, color: 'var(--pkd)', marginBottom: 32 },
  qrRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: '#fff', padding: 24, borderRadius: 20 },
  qrHint: { fontFamily: MONO, fontSize: 14, color: 'var(--tx2)' },
  resultsScale: { transform: 'scale(1.6)', transformOrigin: 'top center', marginTop: 40 },
  idlePulse: {
    position: 'absolute', top: 60, width: 14, height: 14, borderRadius: '50%',
    background: 'var(--pk)', opacity: 0.5, animation: 'lecture-lounge-pulse 2.4s ease-in-out infinite',
  },
}

// Idle pulse keyframes — injected once, same convention as other games'
// document-level SVG-safe animation approach (avoid @keyframes on SVG/Safari).
if (typeof document !== 'undefined' && !document.getElementById('lecture-lounge-pulse-kf')) {
  const style = document.createElement('style')
  style.id = 'lecture-lounge-pulse-kf'
  style.textContent = `@keyframes lecture-lounge-pulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 0.15; } }`
  document.head.appendChild(style)
}
