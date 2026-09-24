// Room exercises for the BPMH guest lecture (no device, no data).
//
//   ToggleRoom  — cued alternation between the two modes of self-reference
//                 (Farb 2007): STORY blocks (narrative self-focus prompts) and
//                 SENSE blocks (experiential focus on one sensory anchor).
//                 A soft tone marks each switch; show-of-hands polls after.
//   ForageRoom  — check in, 60 s of rotating sensory prompts, check back, poll.
//   BreakTimer  — a countdown for the mid-lecture break.
//   QrPanel     — a projector QR code to a public page (phones, no login).
//
// Same contract as the Adobe exercises: clicks never reach the deck's
// click-to-advance, data-exercise-active on <body> while running so Space/→
// are ignored, Enter drives the exercise.
import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'react-qr-code'

function useExerciseLock(active) {
  useEffect(() => {
    if (active) document.body.dataset.exerciseActive = '1'
    else delete document.body.dataset.exerciseActive
    return () => { delete document.body.dataset.exerciseActive }
  }, [active])
}

let _ctx = null
function tone(freq = 440, decay = 1.2) {
  try {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (_ctx.state === 'suspended') _ctx.resume()
    const osc = _ctx.createOscillator(), gain = _ctx.createGain()
    osc.connect(gain); gain.connect(_ctx.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    const t = _ctx.currentTime
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.16, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay)
    osc.start(t); osc.stop(t + decay + 0.05)
  } catch { /* no audio: the screen still cues */ }
}

function Btn({ children, onClick, ghost }) {
  return (
    <button onClick={onClick} style={{
      ...X.btn,
      background: ghost ? 'transparent' : 'var(--pk)',
      color:      ghost ? 'var(--pk)'   : '#fff',
      border:     ghost ? '1.5px solid var(--pk)' : 'none',
    }}>{children}</button>
  )
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

// ── ToggleRoom ──────────────────────────────────────────────────────────────

const STORY = '#4A90D9'
const SENSE = '#f068a4'

// Story prompts follow the trait-adjective logic of narrative self-focus:
// evaluate yourself, place yourself in time. Sense prompts pick one anchor.
const BLOCKS = [
  { m: 'sense', cue: 'Feel the breath', sub: 'Air at the nostrils, the rise of the belly. Just this breath.' },
  { m: 'story', cue: 'What kind of student are you?', sub: 'Organised? Anxious? Curious? Let the answer build.' },
  { m: 'sense', cue: 'Listen to the room', sub: 'Hum, rustle, footsteps. Sound before it has a name.' },
  { m: 'story', cue: 'What will you do after class?', sub: 'Plan it. Where, with whom, what comes next.' },
  { m: 'sense', cue: 'Feel your weight in the seat', sub: 'Pressure, contact, temperature. Let the chair hold you.' },
  { m: 'story', cue: 'How is this lecture going for you?', sub: 'Judge it. Is it worth your time? What does that say about you?' },
]
const BLOCK_OPTS = [20, 30, 45]
const POLLS = [
  { q: 'Which was easier to hold?', opts: ['Story', 'Sense', 'About the same'] },
  { q: 'During the Sense blocks, how often did a story creep in?', opts: ['Barely', 'A few times', 'Most of the time'] },
  { q: 'Which one felt more like “you”?', opts: ['Story', 'Sense', 'Neither'] },
]

export function ToggleRoom() {
  const [act, setAct] = useState('START')   // START → RUNNING → POLL(i) → DONE
  const [blockS, setBlockS] = useState(30)
  const [bi, setBi] = useState(0)
  const [left, setLeft] = useState(0)
  const [pi, setPi] = useState(0)
  const timer = useRef(null)
  const end = useRef(0)
  const biRef = useRef(0)
  useExerciseLock(act === 'RUNNING')

  const stopTimer = () => { clearInterval(timer.current); timer.current = null }
  useEffect(() => stopTimer, [])

  const run = useCallback(() => {
    const startBlock = (i) => {
      biRef.current = i; setBi(i)
      tone(BLOCKS[i].m === 'sense' ? 523 : 392)
      end.current = performance.now() + blockS * 1000
      setLeft(blockS)
    }
    stopTimer(); setAct('RUNNING'); startBlock(0)
    timer.current = setInterval(() => {
      const rem = (end.current - performance.now()) / 1000
      if (rem > 0) { setLeft(rem); return }
      const next = biRef.current + 1
      if (next < BLOCKS.length) { startBlock(next); return }
      stopTimer(); tone(330, 1.8); setAct('POLL'); setPi(0)
    }, 200)
  }, [blockS])

  const doReset = useCallback(() => { stopTimer(); setAct('START'); setBi(0); setPi(0) }, [])
  const nextPoll = useCallback(() => {
    if (pi < POLLS.length - 1) setPi(p => p + 1)
    else setAct('DONE')
  }, [pi])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (act === 'START') run()
      else if (act === 'POLL') nextPoll()
      else if (act === 'DONE') doReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, run, nextPoll, doReset])

  const b = BLOCKS[bi]
  const tint = act === 'RUNNING' ? (b.m === 'sense' ? SENSE : STORY) : null

  return (
    <div style={{ ...X.stage, background: tint ? `${tint}14` : 'transparent', borderRadius: 24, transition: 'background 1.2s ease' }} onClick={e => e.stopPropagation()}>
      <div style={X.overlay}>
        {act === 'START' && (
          <>
            <h2 style={X.title}>Toggle</h2>
            <p style={X.sub}>
              Six short blocks. <b style={{ color: SENSE }}>Sense</b> blocks: rest attention on one sensation.
              {' '}<b style={{ color: STORY }}>Story</b> blocks: think about yourself. A tone marks each switch.
              Eyes open or closed, your choice.
            </p>
            <div style={X.optRow}>
              {BLOCK_OPTS.map(s => (
                <button key={s} onClick={() => setBlockS(s)} style={{ ...X.chip, ...(blockS === s ? X.chipOn : {}) }}>{s}s blocks</button>
              ))}
            </div>
            <p style={X.hint}>total {fmt(BLOCKS.length * blockS)}</p>
            <Btn onClick={run}>Begin</Btn>
          </>
        )}
        {act === 'RUNNING' && (
          <>
            <p style={{ ...X.mono, color: tint }}>{b.m === 'sense' ? 'Sense' : 'Story'} · {bi + 1} / {BLOCKS.length}</p>
            <h2 style={{ ...X.title, fontSize: 'clamp(34px, 6vw, 68px)', color: tint }}>{b.cue}</h2>
            <p style={X.sub}>{b.sub}</p>
            <div style={X.track}>
              <div style={{ ...X.fill, background: tint, width: `${Math.max(0, 100 - (left / blockS) * 100)}%` }} />
            </div>
            <div style={X.dots}>
              {BLOCKS.map((x, k) => (
                <span key={k} style={{ ...X.dot, background: k <= bi ? (x.m === 'sense' ? SENSE : STORY) : '#e4dde1' }} />
              ))}
            </div>
            <Btn ghost onClick={doReset}>Stop</Btn>
          </>
        )}
        {act === 'POLL' && (
          <>
            <p style={X.mono}>show of hands · {pi + 1} / {POLLS.length}</p>
            <h2 style={X.title}>{POLLS[pi].q}</h2>
            <div style={X.optRow}>{POLLS[pi].opts.map(o => <span key={o} style={X.opt}>{o}</span>)}</div>
            <Btn onClick={nextPoll}>{pi < POLLS.length - 1 ? 'Next question →' : 'Done'}</Btn>
          </>
        )}
        {act === 'DONE' && (
          <>
            <h2 style={X.title}>No right answer.</h2>
            <p style={X.sub}>
              Most rooms find Story effortless and Sense slippery. Story runs by default; Sense has to be chosen,
              again and again. The moment you noticed a story creeping in was the practice working.
            </p>
            <Btn ghost onClick={doReset}>Again</Btn>
          </>
        )}
      </div>
      <p style={X.corner}>Enter = begin / next · Space = next slide</p>
    </div>
  )
}

// ── ForageRoom ──────────────────────────────────────────────────────────────
// Check in → 60 s forage with rotating sensory prompts → check back → poll.

const FORAGE_MS = 60000
const FORAGE_PROMPTS = [
  'Find three different sounds in the room.',
  'Where does your body touch the seat? Feel the pressure.',
  'Find the brightest point of light you can see.',
  'What temperature is the air on your hands?',
  'One more sound, the quietest one you can find.',
]

export function ForageRoom() {
  const [act, setAct] = useState('START')   // START → CHECKIN → FORAGE → CHECKBACK → POLL
  const [left, setLeft] = useState(FORAGE_MS)
  const timer = useRef(null)
  const end = useRef(0)
  useExerciseLock(act === 'FORAGE')

  const stopTimer = () => { clearInterval(timer.current); timer.current = null }
  useEffect(() => stopTimer, [])

  const forage = useCallback(() => {
    stopTimer(); setAct('FORAGE'); tone(523)
    end.current = performance.now() + FORAGE_MS
    setLeft(FORAGE_MS)
    timer.current = setInterval(() => {
      const rem = end.current - performance.now()
      if (rem > 0) { setLeft(rem); return }
      stopTimer(); tone(392, 1.6); setAct('CHECKBACK')
    }, 200)
  }, [])
  const doReset = useCallback(() => { stopTimer(); setAct('START') }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (act === 'START') setAct('CHECKIN')
      else if (act === 'CHECKIN') forage()
      else if (act === 'CHECKBACK') setAct('POLL')
      else if (act === 'POLL') doReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, forage, doReset])

  const pi = Math.min(FORAGE_PROMPTS.length - 1, Math.floor((FORAGE_MS - left) / (FORAGE_MS / FORAGE_PROMPTS.length)))

  return (
    <div style={{ ...X.stage, background: act === 'FORAGE' ? `${SENSE}10` : 'transparent', borderRadius: 24, transition: 'background 1.2s ease' }} onClick={e => e.stopPropagation()}>
      <div style={X.overlay}>
        {act === 'START' && (
          <>
            <h2 style={X.title}>Forage together</h2>
            <p style={X.sub}>One minute, no phones. Check in, forage, check back.</p>
            <Btn onClick={() => setAct('CHECKIN')}>Begin</Btn>
          </>
        )}
        {act === 'CHECKIN' && (
          <>
            <p style={X.mono}>1 · check in</p>
            <h2 style={X.title}>One word for how you are, right now.</h2>
            <p style={X.sub}>Keep it to yourself. Honest, not ideal.</p>
            <Btn onClick={forage}>Start foraging</Btn>
          </>
        )}
        {act === 'FORAGE' && (
          <>
            <p style={{ ...X.mono, color: SENSE }}>2 · forage · {fmt(Math.ceil(left / 1000))}</p>
            <h2 style={{ ...X.title, fontSize: 'clamp(30px, 5vw, 56px)', color: SENSE }}>{FORAGE_PROMPTS[pi]}</h2>
            <p style={X.sub}>Not to relax. To notice.</p>
            <div style={X.track}>
              <div style={{ ...X.fill, background: SENSE, width: `${100 - (left / FORAGE_MS) * 100}%` }} />
            </div>
            <Btn ghost onClick={doReset}>Stop</Btn>
          </>
        )}
        {act === 'CHECKBACK' && (
          <>
            <p style={X.mono}>3 · check back</p>
            <h2 style={X.title}>One word again. Did it change?</h2>
            <Btn onClick={() => setAct('POLL')}>Show of hands →</Btn>
          </>
        )}
        {act === 'POLL' && (
          <>
            <p style={X.mono}>show of hands</p>
            <h2 style={X.title}>Did your word change?</h2>
            <div style={X.optRow}>{['Yes', 'A little', 'No'].map(o => <span key={o} style={X.opt}>{o}</span>)}</div>
            <p style={X.sub}>Either answer is information. The second look is where change gets registered.</p>
            <Btn ghost onClick={doReset}>Again</Btn>
          </>
        )}
      </div>
      <p style={X.corner}>Enter = next step · Space = next slide</p>
    </div>
  )
}

// ── BreakTimer ──────────────────────────────────────────────────────────────

export function BreakTimer({ minutes = 10 }) {
  const [left, setLeft] = useState(minutes * 60)
  const [running, setRunning] = useState(false)
  const end = useRef(0)
  const timer = useRef(null)

  const start = useCallback(() => {
    end.current = Date.now() + left * 1000
    setRunning(true)
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      const rem = (end.current - Date.now()) / 1000
      if (rem <= 0) { clearInterval(timer.current); setLeft(0); setRunning(false); tone(523, 1.6) }
      else setLeft(rem)
    }, 250)
  }, [left])
  const reset = useCallback(() => { clearInterval(timer.current); setRunning(false); setLeft(minutes * 60) }, [minutes])
  useEffect(() => () => clearInterval(timer.current), [])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (running) reset(); else start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, start, reset])

  return (
    <div style={{ ...X.overlay, margin: '0 auto' }} onClick={e => e.stopPropagation()}>
      <div style={X.bigClock}>{fmt(Math.ceil(left))}</div>
      {!running && <Btn onClick={start}>{left < minutes * 60 && left > 0 ? 'Resume' : 'Start the break'}</Btn>}
      {running && <Btn ghost onClick={reset}>Reset</Btn>}
      <p style={X.hint}>Enter = start / reset</p>
    </div>
  )
}

// ── QrPanel ─────────────────────────────────────────────────────────────────

// Points at the current origin, so the same deck works on dev and production.
export function QrPanel({ path, label, tone: accent = '#f068a4', size = 200 }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://radlab.zone'
  const host = typeof window !== 'undefined' ? window.location.host : 'radlab.zone'
  return (
    <div style={X.qr} onClick={e => e.stopPropagation()}>
      <div style={{ background: '#fff', padding: 12, borderRadius: 14, border: `2px solid ${accent}55` }}>
        <QRCode value={origin + path} size={size} fgColor="#2a2a2e" />
      </div>
      {label && <div style={{ ...X.qrLabel, color: accent }}>{label}</div>}
      <div style={X.qrUrl}>{host}{path}</div>
    </div>
  )
}

const X = {
  stage: { position: 'relative', width: '100%', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' },
  overlay: { position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '0 24px', maxWidth: 820, width: '100%' },
  title: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(28px, 4.6vw, 50px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.1 },
  sub:   { fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  hint:  { fontSize: 'clamp(13px, 1.6vw, 16px)', color: 'var(--tx3)', margin: 0, fontFamily: '"Space Mono",monospace' },
  mono:  { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', color: 'var(--tx3)', textTransform: 'uppercase', margin: 0 },
  optRow:{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' },
  opt:   { fontSize: 'clamp(18px, 2.4vw, 28px)', fontWeight: 600, color: 'var(--pk)', background: '#fff', border: '1.5px solid var(--pkb, #f6c6dd)', borderRadius: 14, padding: '12px 24px' },
  chip:  { border: '1.5px solid var(--bd)', background: '#fff', borderRadius: 999, padding: '8px 18px', fontSize: 15, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  chipOn:{ background: 'var(--pk)', border: '1.5px solid var(--pk)', color: '#fff' },
  track: { width: 'min(520px, 90%)', height: 8, background: '#fff', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--bd)' },
  fill:  { height: '100%', transition: 'width .2s linear' },
  dots:  { display: 'flex', gap: 8 },
  dot:   { width: 12, height: 12, borderRadius: '50%', transition: 'background .4s' },
  btn:   { marginTop: 6, borderRadius: 14, padding: '14px 40px', fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  corner:{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.7, margin: 0 },
  bigClock: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(80px, 16vw, 200px)', color: 'var(--tx)', lineHeight: 1 },
  qr:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'default' },
  qrLabel:{ fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.4vw, 28px)' },
  qrUrl:  { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
}
