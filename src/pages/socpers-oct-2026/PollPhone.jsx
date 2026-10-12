// /poll/:code — the audience's phone during the room breathing demo. Public,
// no login, nothing personal: a random device id (kept in localStorage so a
// person's two trials pair up) and, per trial, a pace judgment and a 1-6
// activation rating, written through talk_poll_submit().
//
// The phone does not follow the projector. It walks the person through
// welcome (what is about to happen) → trial 1 → wait → trial 2 → done, and
// the presenter says when to answer. The welcome screen is there because
// people scan the QR before the demo starts: landing straight on "Did the
// pace change?" left them not knowing what they were rating.
// Progress is remembered per poll round, so a refresh does not restart it
// and a new round (talk_poll_new_round, before the real talk) does.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSubmitLock } from '../../lib/useSubmitLock'

const PACES = [['faster', 'Faster'], ['slower', 'Slower'], ['same', 'Same']]

function deviceId() {
  const key = 'talkpoll:device'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = (crypto.randomUUID?.() ??
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        }))
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return crypto.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000'
  }
}

export default function PollPhone() {
  const { code } = useParams()
  const [device] = useState(deviceId)
  const [info, setInfo] = useState(undefined)        // undefined = loading, null = unknown poll
  const [done, setDone] = useState([])               // trials answered this round
  const [waiting, setWaiting] = useState(false)      // between trial 1 and trial 2
  const [ready, setReady] = useState(false)          // past the welcome screen

  useEffect(() => {
    document.title = 'Breathing demo'
    supabase.rpc('talk_poll_info', { p_code: code }).then(({ data }) => {
      const row = data?.[0] ?? null
      setInfo(row)
      if (row) {
        try {
          const saved = JSON.parse(localStorage.getItem(`talkpoll:${code}:${row.round}`) || '[]')
          setDone(saved)
          setWaiting(saved.length === 1)
        } catch { /* fresh start */ }
      }
    })
  }, [code])

  const markDone = (trial) => {
    const next = [...new Set([...done, trial])]
    setDone(next)
    try { localStorage.setItem(`talkpoll:${code}:${info.round}`, JSON.stringify(next)) } catch { /* ignore */ }
    if (trial === 1) setWaiting(true)
  }

  let body
  if (info === undefined) body = <p style={P.sub}>Loading…</p>
  else if (info === null) body = <p style={P.sub}>This poll link isn’t active.</p>
  else if (!info.is_open) body = <p style={P.sub}>This poll is closed. Thanks for taking part.</p>
  else if (done.includes(1) && done.includes(2)) body = (
    <div style={P.center}>
      <h1 style={P.h1}>Thank you</h1>
      <p style={P.sub}>Both answers are in. Watch the screen.</p>
    </div>
  )
  else if (done.length === 0 && !ready) body = (
    <div style={P.form}>
      <h1 style={P.h1}>Welcome</h1>
      <p style={P.sub}>In a moment the screen at the front will show a pulsing circle.</p>
      <ol style={P.steps}>
        <li style={P.step}><b>Breathe with the circle</b> for about 15 seconds: in as it grows, out as it shrinks.</li>
        <li style={P.step}><b>When it stops, answer two quick questions here:</b> did the circle’s pace change, and how activated do you feel right now?</li>
        <li style={P.step}><b>Then we do it once more,</b> with the same two questions.</li>
      </ol>
      <p style={P.sub}>Keep this page open. Tap below once the circle has stopped.</p>
      <button style={P.primary} onClick={() => setReady(true)}>The circle has stopped →</button>
    </div>
  )
  else if (waiting) body = (
    <div style={P.center}>
      <h1 style={P.h1}>Got it</h1>
      <p style={P.sub}>Now breathe with the circle for the second trial. Answer when it stops.</p>
      <button style={P.primary} onClick={() => setWaiting(false)}>The second trial is over →</button>
    </div>
  )
  else {
    const trial = done.includes(1) ? 2 : 1
    body = <TrialForm key={trial} trial={trial} code={code} device={device} onDone={() => markDone(trial)} />
  }

  return (
    <div style={P.page}>
      <div style={P.card}>
        <p style={P.kicker}>Breathing demo · {info?.title ?? ''}</p>
        {body}
        <p style={P.foot}>Anonymous. No name, no login. Answers are shown only as a group.</p>
      </div>
    </div>
  )
}

function TrialForm({ trial, code, device, onDone }) {
  const [pace, setPace] = useState(null)
  const [arousal, setArousal] = useState(null)
  const [err, setErr] = useState(null)
  const { submit, busy } = useSubmitLock(`trial-${trial}`)

  const send = () => submit(async () => {
    setErr(null)
    const { data, error } = await supabase.rpc('talk_poll_submit', {
      p_code: code, p_device: device, p_trial: trial, p_pace: pace, p_arousal: arousal,
    })
    if (error || data !== 'ok') {
      setErr(data === 'closed' ? 'The poll has closed.' : 'That didn’t go through. Try again.')
      throw error ?? new Error(data)
    }
    onDone()
  })

  return (
    <div style={P.form}>
      <h1 style={P.h1}>Trial {trial}</h1>

      <p style={P.q}>Did the pace of the circle change?</p>
      <div style={P.row}>
        {PACES.map(([v, label]) => (
          <button key={v} onClick={() => setPace(v)} style={{ ...P.opt, ...(pace === v ? P.optOn : {}) }}>{label}</button>
        ))}
      </div>

      <p style={P.q}>How activated do you feel right now?</p>
      <div style={P.scale}>
        {[1, 2, 3, 4, 5, 6].map(v => (
          <button key={v} onClick={() => setArousal(v)} style={{ ...P.num, ...(arousal === v ? P.optOn : {}) }}>{v}</button>
        ))}
      </div>
      <div style={P.ends}><span>very calm</span><span>very activated</span></div>

      {err && <p style={P.err}>{err}</p>}
      <button style={{ ...P.primary, opacity: pace && arousal && !busy ? 1 : 0.4 }} disabled={!pace || !arousal || busy} onClick={send}>
        {busy ? 'Sending…' : 'Send'}
      </button>
    </div>
  )
}

const P = {
  page: { minHeight: '100vh', background: 'var(--bg, #FCF0F5)', display: 'flex', justifyContent: 'center', padding: '24px 16px', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)' },
  card: { width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pkd)', margin: 0 },
  center: { display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'stretch', textAlign: 'center', padding: '32px 0' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 36, margin: 0 },
  sub: { fontSize: 16, color: 'var(--tx2)', lineHeight: 1.5, margin: 0 },
  q: { fontSize: 20, fontWeight: 600, margin: '16px 0 0', lineHeight: 1.3 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  scale: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 },
  opt: { padding: '16px 8px', fontSize: 16, fontWeight: 600, borderRadius: 12, border: '2px solid var(--tx3)', background: '#fff', color: 'var(--tx)', cursor: 'pointer' },
  num: { padding: '16px 0', fontSize: 20, fontWeight: 600, borderRadius: 12, border: '2px solid var(--tx3)', background: '#fff', color: 'var(--tx)', cursor: 'pointer' },
  optOn: { borderColor: 'var(--pk)', background: 'var(--pk)', color: '#fff' },
  ends: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--tx3)' },
  primary: { marginTop: 16, padding: '16px 24px', fontSize: 16, fontWeight: 600, borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  err: { color: '#A32D2D', fontSize: 14, margin: 0 },
  steps: { margin: '8px 0', paddingLeft: 24, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 12 },
  step: { fontSize: 16, lineHeight: 1.5, color: 'var(--tx)' },
  foot: { fontSize: 12, color: 'var(--tx3)', margin: '24px 0 0', lineHeight: 1.5 },
}
