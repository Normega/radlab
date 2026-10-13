// /poll/:code — the audience's phone during the talk's opening. Public, no
// login, nothing personal: a random device id (kept in localStorage so a
// person's answers pair up), one tap on the mood circle (talk_poll_mood_submit,
// 20261013_talk_poll_moods.sql) and, per breathing trial, a pace judgment and a
// 1-6 activation rating (talk_poll_submit).
//
// The phone does not follow the projector. It walks the person through
// mood circle → "your dot is on the screen" → welcome (what is about to
// happen) → trial 1 → wait → trial 2 → done, and the presenter says when to
// move on. The pause after the mood tap is there so the room looks up for the
// reveal instead of reading ahead. The welcome screen is there because
// people scan the QR before the demo starts: landing straight on "Did the
// pace change?" left them not knowing what they were rating.
// Progress is remembered per poll round, so a refresh does not restart it
// and a new round (talk_poll_new_round, before the real talk) does.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSubmitLock } from '../../lib/useSubmitLock'
import WheelSVG from '../../games/StillWater/WheelSVG'
import { EMOTIONS } from '../../games/StillWater/constants'

const PACES = [['faster', 'Faster'], ['slower', 'Slower'], ['same', 'Same']]
// WheelSVG only takes clicks when activeIds is an array (null = static preview).
const ALL_EMOTION_IDS = EMOTIONS.map(e => e.id)

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
  const [mood, setMood] = useState(false)            // mood circle answered this round ('change' = re-answering)
  const [moodSeen, setMoodSeen] = useState(true)     // past "your dot is on the screen"

  useEffect(() => {
    document.title = 'Live poll'
    supabase.rpc('talk_poll_info', { p_code: code }).then(({ data }) => {
      const row = data?.[0] ?? null
      setInfo(row)
      if (row) {
        try {
          const saved = JSON.parse(localStorage.getItem(`talkpoll:${code}:${row.round}`) || '[]')
          setDone(saved)
          setWaiting(saved.length === 1)
          setMood(localStorage.getItem(`talkpoll:${code}:${row.round}:mood`) === '1' || saved.length > 0)
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

  const moodDone = () => {
    setMood(true)
    setMoodSeen(false)
    try { localStorage.setItem(`talkpoll:${code}:${info.round}:mood`, '1') } catch { /* ignore */ }
  }

  let body
  let kicker = 'Breathing demo'
  if (info === undefined) body = <p style={P.sub}>Loading…</p>
  else if (info === null) body = <p style={P.sub}>This poll link isn’t active.</p>
  else if (!info.is_open) body = <p style={P.sub}>This poll is closed. Thanks for taking part.</p>
  else if (done.includes(1) && done.includes(2)) body = (
    <div style={P.center}>
      <h1 style={P.h1}>Thank you</h1>
      <p style={P.sub}>Both answers are in. Watch the screen.</p>
    </div>
  )
  else if (mood !== true) {
    kicker = 'Check-in'
    body = <MoodForm code={code} device={device} onDone={moodDone} />
  }
  else if (!moodSeen) {
    kicker = 'Check-in'
    body = (
      <div style={P.center}>
        <h1 style={P.h1}>You’re on the screen</h1>
        <p style={P.sub}>Look up: your dot is one of the pink ones. Tap Next when you’re asked to.</p>
        <button style={P.primary} onClick={() => setMoodSeen(true)}>Next: the breathing demo →</button>
        <button style={P.secondary} onClick={() => setMood('change')}>Change my answer</button>
      </div>
    )
  }
  else if (done.length === 0 && !ready) body = (
    <div style={P.form}>
      <h1 style={P.h1}>Next: a breathing demo</h1>
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
        <p style={P.kicker}>{kicker} · {info?.title ?? ''}</p>
        {body}
        <p style={P.foot}>Anonymous. No name, no login. Answers are shown only as a group.</p>
      </div>
    </div>
  )
}

// One tap on the mood circle, then Send. Same wheel as the Lecture Lounge mood
// check-in (MoodTap), but the tap only selects: a mis-tap can be fixed before
// sending. The neutral centre is an answer like any other.
function MoodForm({ code, device, onDone }) {
  const [sel, setSel] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [err, setErr] = useState(null)
  const { submit, busy } = useSubmitLock('mood')

  const send = () => submit(async () => {
    setErr(null)
    const { data, error } = await supabase.rpc('talk_poll_mood_submit', {
      p_code: code, p_device: device,
      p_emotion: sel.neutral ? null : sel.emotionId, p_zone: sel.neutral ? null : sel.zone,
    })
    if (error || data !== 'ok') {
      setErr(data === 'closed' ? 'The poll has closed.' : data === 'limit' ? 'That’s the most changes this poll takes.' : 'That didn’t go through. Try again.')
      throw error ?? new Error(data)
    }
    onDone()
  })

  return (
    <div style={P.form}>
      <h1 style={P.h1}>How are you feeling right now?</h1>
      <p style={P.sub}>Tap where you are on the circle. The centre is neutral.</p>
      <div style={P.wheel}>
        <WheelSVG
          activeIds={ALL_EMOTION_IDS}
          selection={sel}
          hovered={hovered}
          onHover={setHovered}
          onZoneClick={({ emotion, zone }) => setSel({ neutral: false, emotionId: emotion.id, zone })}
          onNeutral={() => setSel({ neutral: true, emotionId: null, zone: null })}
        />
      </div>
      {err && <p style={P.err}>{err}</p>}
      <button style={{ ...P.primary, opacity: sel && !busy ? 1 : 0.4 }} disabled={!sel || busy} onClick={send}>
        {busy ? 'Sending…' : 'Send'}
      </button>
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
  wheel: { display: 'flex', justifyContent: 'center', touchAction: 'manipulation' },
  secondary: { padding: '16px 24px', fontSize: 16, fontWeight: 600, borderRadius: 24, border: '2px solid var(--tx3)', background: '#fff', color: 'var(--tx2)', cursor: 'pointer' },
  primary: { marginTop: 16, padding: '16px 24px', fontSize: 16, fontWeight: 600, borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  err: { color: '#A32D2D', fontSize: 14, margin: 0 },
  steps: { margin: '8px 0', paddingLeft: 24, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 12 },
  step: { fontSize: 16, lineHeight: 1.5, color: 'var(--tx)' },
  foot: { fontSize: 12, color: 'var(--tx3)', margin: '24px 0 0', lineHeight: 1.5 },
}
