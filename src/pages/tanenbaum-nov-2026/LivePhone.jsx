// /live/:code — the audience's phone during "Aging attentively" (Tanenbaum
// Symposium, Nov 10 2026). Public, no login, nothing personal: the same random
// device id as /poll/:code (localStorage), a mood tap on arrival
// (talk_poll_mood_submit) and a two-minute Toggle practice whose taps go to
// talk_poll_toggle_submit (20261108_talk_poll_toggles.sql).
//
// The phone does not follow the projector. It walks the person through
// mood circle → "you're on the screen" → what Toggle is → Begin (when the
// presenter says so) → two minutes of STORY / SENSE taps → their own timeline.
// Begin counts as SENSE: everyone starts with the breath.
//
// Taps are queued and sent in order with retries, so a wifi blip delays a tap
// rather than losing it, and the practice never waits on the network. Progress
// is remembered per poll round, so a refresh doesn't restart it and a new round
// (before the real talk) does.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { MoodForm, deviceId, P } from '../socpers-oct-2026/PollPhone'
import { PRACTICE_S, STORY, SENSE, segmentsOf, personStats } from './toggle'

const fmtClock = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s) % 60)).padStart(2, '0')}`

// Sends taps one at a time, retrying each up to 4 times with a growing pause.
function useTapQueue(code, device) {
  const queue = useRef([])
  const busy = useRef(false)
  const pump = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    while (queue.current.length) {
      const tap = queue.current[0]
      let sent = false
      for (let attempt = 0; attempt < 4 && !sent; attempt++) {
        try {
          const { data, error } = await supabase.rpc('talk_poll_toggle_submit', {
            p_code: code, p_device: device, p_t_ms: tap.t_ms, p_mode: tap.mode,
          })
          // 'closed', 'limit' and 'invalid' won't improve with a retry.
          if (!error && data) sent = true
        } catch { /* retry */ }
        if (!sent) await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
      }
      queue.current.shift()
    }
    busy.current = false
  }, [code, device])
  return useCallback((mode, t_ms) => { queue.current.push({ mode, t_ms }); pump() }, [pump])
}

export default function LivePhone() {
  const { code } = useParams()
  const [device] = useState(deviceId)
  const [info, setInfo] = useState(undefined)      // undefined = loading, null = unknown poll
  const [mood, setMood] = useState(false)          // true once sent this round; 'change' re-answers
  const [moodSeen, setMoodSeen] = useState(true)   // past "you're on the screen"
  const [stage, setStage] = useState('intro')      // intro → run → done
  const [taps, setTaps] = useState([])             // this person's taps, for their own timeline
  const key = info ? `talklive:${code}:${info.round}` : null

  useEffect(() => {
    document.title = 'Live · Aging attentively'
    supabase.rpc('talk_poll_info', { p_code: code }).then(({ data }) => {
      const row = data?.[0] ?? null
      setInfo(row)
      if (!row) return
      try {
        const k = `talklive:${code}:${row.round}`
        setMood(localStorage.getItem(`${k}:mood`) === '1')
        const saved = JSON.parse(localStorage.getItem(`${k}:toggle`) || 'null')
        if (saved?.taps?.length) { setTaps(saved.taps); setStage('done') }
      } catch { /* fresh start */ }
    })
  }, [code])

  const moodDone = () => {
    setMood(true); setMoodSeen(false)
    try { localStorage.setItem(`${key}:mood`, '1') } catch { /* ignore */ }
  }
  const finished = (all) => {
    setTaps(all); setStage('done')
    try { localStorage.setItem(`${key}:toggle`, JSON.stringify({ taps: all })) } catch { /* ignore */ }
  }

  if (stage === 'run') return <Practice code={code} device={device} onDone={finished} />

  let body
  let kicker = 'Live'
  if (info === undefined) body = <p style={P.sub}>Loading…</p>
  else if (info === null) body = <p style={P.sub}>This link isn’t active.</p>
  else if (!info.is_open) body = <p style={P.sub}>This poll is closed. Thanks for taking part.</p>
  else if (stage === 'done') { kicker = 'Your two minutes'; body = <Timeline taps={taps} /> }
  else if (mood !== true) { kicker = 'Check-in'; body = <MoodForm code={code} device={device} onDone={moodDone} /> }
  else if (!moodSeen) {
    kicker = 'Check-in'
    body = (
      <div style={P.center}>
        <h1 style={P.h1}>You’re on the screen</h1>
        <p style={P.sub}>Look up: your dot is one of the pink ones. Keep this page open; we’ll use it again later.</p>
        <button style={P.primary} onClick={() => setMoodSeen(true)}>Next →</button>
        <button style={P.secondary} onClick={() => setMood('change')}>Change my answer</button>
      </div>
    )
  }
  else {
    kicker = 'A noticing practice'
    body = (
      <div style={P.form}>
        <h1 style={P.h1}>Toggle</h1>
        <p style={P.sub}>For two minutes, rest your attention on the breath. Minds wander; that’s expected. Your only job is to notice.</p>
        <div style={L.modes}>
          <div style={{ ...L.mode, borderColor: `${STORY}66` }}><b style={{ ...L.modeName, color: STORY }}>Story</b><span>Tap when you notice you’re thinking: planning, remembering, judging, explaining.</span></div>
          <div style={{ ...L.mode, borderColor: `${SENSE}66` }}><b style={{ ...L.modeName, color: '#c04a82' }}>Sense</b><span>Tap when you’re back with the breath: air, rise and fall, what is here.</span></div>
        </div>
        <p style={P.sub}>You start in Sense. Wait for the cue, then press Begin.</p>
        <button style={P.primary} onClick={() => setStage('run')}>Begin</button>
      </div>
    )
  }

  return (
    <div style={P.page}>
      <div style={P.card}>
        <p style={P.kicker}>{kicker} · {info?.title ?? ''}</p>
        {body}
        <p style={P.foot}>Anonymous. No name, no login. Answers are shown only as a group.</p>
      </div>
    </div>
  )
}

// Two minutes of STORY / SENSE. The screen never waits on the network.
export function Practice({ code, device, onDone, anchor = 'the breath' }) {
  const send = useTapQueue(code, device)
  const t0 = useRef(0)
  const taps = useRef([])
  const [mode, setMode] = useState('sense')
  const [left, setLeft] = useState(PRACTICE_S)
  const [segs, setSegs] = useState([])
  const over = useRef(false)
  // Held in refs so a parent re-render can never restart the clock.
  const sendRef = useRef(send)
  const doneRef = useRef(onDone)
  useEffect(() => { sendRef.current = send; doneRef.current = onDone }, [send, onDone])

  const record = useCallback((m) => {
    const t_ms = Math.round(performance.now() - t0.current)
    taps.current.push({ mode: m, t_ms })
    sendRef.current(m, t_ms)
  }, [])

  const finish = useCallback(() => {
    if (over.current) return
    over.current = true
    const t_ms = Math.min(PRACTICE_S * 1000, Math.round(performance.now() - t0.current))
    taps.current.push({ mode: 'end', t_ms })
    sendRef.current('end', t_ms)
    doneRef.current(taps.current)
  }, [])

  useEffect(() => {
    t0.current = performance.now()
    taps.current = [{ mode: 'begin', t_ms: 0 }]
    sendRef.current('begin', 0)
    const id = setInterval(() => {
      const el = performance.now() - t0.current
      setLeft(PRACTICE_S - el / 1000)
      setSegs(segmentsOf(taps.current, el).segs)
      if (el >= PRACTICE_S * 1000) { clearInterval(id); finish() }
    }, 250)
    return () => clearInterval(id)
  }, [finish])

  const tap = (m) => { if (m !== mode) { setMode(m); record(m) } }

  return (
    <div style={L.run}>
      <div style={L.top}>
        <span>{fmtClock(left)}</span>
        <span>tap when you notice</span>
        <button style={L.finish} onClick={finish}>finish</button>
      </div>
      <button style={{ ...L.half, background: mode === 'story' ? STORY : '#e8f1fb', color: mode === 'story' ? '#fff' : STORY }} onClick={() => tap('story')}>
        <span style={L.word}>Story</span><span style={L.hint}>I notice I’m thinking</span>
      </button>
      <Strip segs={segs} />
      <button style={{ ...L.half, background: mode === 'sense' ? SENSE : '#fde8f2', color: mode === 'sense' ? '#fff' : '#c04a82' }} onClick={() => tap('sense')}>
        <span style={L.word}>Sense</span><span style={L.hint}>I’m back with {anchor}</span>
      </button>
    </div>
  )
}

function Strip({ segs, height = 14, radius = 0 }) {
  const total = PRACTICE_S * 1000
  return (
    <div style={{ display: 'flex', height, background: '#f3eef1', borderRadius: radius, overflow: 'hidden' }}>
      {segs.map((g, k) => (
        <i key={k} style={{ display: 'block', width: `${((g.to - g.from) / total) * 100}%`, background: g.mode === 'sense' ? SENSE : STORY }} />
      ))}
    </div>
  )
}

export function Timeline({ taps, anchor = 'the breath' }) {
  const end = taps.find(t => t.mode === 'end')?.t_ms ?? PRACTICE_S * 1000
  const { segs } = segmentsOf(taps, end)
  const s = personStats(segs)
  const pct = s.share == null ? '—' : `${Math.round(s.share * 100)}%`
  const longest = segs.filter(g => g.mode === 'sense').reduce((m, g) => Math.max(m, g.to - g.from), 0)
  return (
    <div style={P.form}>
      <h1 style={P.h1}>{s.returns > 0 ? `You came back ${s.returns === 1 ? 'once' : `${s.returns} times`}` : s.noticed > 0 ? 'You noticed' : 'Here’s your two minutes'}</h1>
      <Strip segs={segs} height={34} radius={8} />
      <div style={L.axis}><span>0:00</span><span>{fmtClock(PRACTICE_S)}</span></div>
      <div style={L.stats}>
        <div style={L.stat}><b style={L.statBig}>{pct}</b><span>of the time with {anchor}</span></div>
        <div style={L.stat}><b style={L.statBig}>{s.noticed}</b><span>{s.noticed === 1 ? 'drift you noticed' : 'drifts you noticed'}</span></div>
        <div style={L.stat}><b style={L.statBig}>{s.returns}</b><span>{s.returns === 1 ? `return to ${anchor}` : `returns to ${anchor}`}</span></div>
        <div style={L.stat}><b style={L.statBig}>{Math.round(longest / 1000)} s</b><span>longest stay with {anchor}</span></div>
      </div>
      <p style={P.sub}>Drifting isn’t a mistake; it’s what minds do. Each time you noticed and came back is the skill. Look up: the room’s two minutes are on the screen.</p>
    </div>
  )
}

const L = {
  modes: { display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' },
  mode: { borderRadius: 12, padding: '12px 16px', background: '#fff', border: '2px solid', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 16, color: 'var(--tx2)', lineHeight: 1.4 },
  modeName: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 24 },
  run: { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: '"DM Sans",system-ui,sans-serif' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx3)' },
  finish: { border: '1px solid var(--tx3)', background: '#fff', borderRadius: 24, padding: '8px 16px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer' },
  half: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'background .25s ease', touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' },
  word: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 56, lineHeight: 1 },
  hint: { fontSize: 16, marginTop: 8, opacity: 0.85 },
  axis: { display: 'flex', justifyContent: 'space-between', fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  stats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0' },
  stat: { background: '#fff', border: '1px solid #ecd6e1', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--tx2)' },
  statBig: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 32, color: 'var(--tx)' },
}
