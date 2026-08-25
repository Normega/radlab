// Two whole-room exercises embedded in the Adobe deck (no device, no data).
//
//   BreathCheck — four paced breaths. Two at baseline, then two at a pace
//                 drawn at random (faster / slower / same) so neither the room
//                 nor the presenter knows the answer until the reveal.
//                 Adapted from PacerOpenerDemo (fixed accelerate → random).
//   DriftRoom   — a room adaptation of /games/drift. The screen holds a hidden
//                 interval (tone · breathing circle · tone); the room then
//                 reproduces it together by raising hands, and the presenter
//                 stops the clock at the median hand.
//
// Both write nothing. Clicks inside them never reach the deck's click-to-
// advance, and while one is mid-flight it sets data-exercise-active on <body>
// so the deck ignores Space/→. Enter drives the exercise itself.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBreathCycle } from '../../games/EbbAndFlow/useBreathCycle'

// ── shared bits ─────────────────────────────────────────────────────────────

const CIRCLE_MIN = 0.42
const CIRCLE_MAX = 1.0

// Direct DOM writes each frame, never setState (RADlab animation convention).
function useCircleAnim(getPhase, getBT) {
  const circleRef = useRef(null)
  const rafRef    = useRef(null)
  const start = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const loop = () => {
      const el = circleRef.current
      if (el) {
        const s = CIRCLE_MIN + (CIRCLE_MAX - CIRCLE_MIN) * getBT(getPhase())
        el.style.transform = `scale(${s.toFixed(4)})`
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [getPhase, getBT])
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (circleRef.current) circleRef.current.style.transform = `scale(${CIRCLE_MIN})`
  }, [])
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])
  return { circleRef, start, stop }
}

function useExerciseLock(active) {
  useEffect(() => {
    if (active) document.body.dataset.exerciseActive = '1'
    else delete document.body.dataset.exerciseActive
    return () => { delete document.body.dataset.exerciseActive }
  }, [active])
}

let _ctx = null
function tone(freq = 440, decay = 0.9) {
  try {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (_ctx.state === 'suspended') _ctx.resume()
    const osc = _ctx.createOscillator(), gain = _ctx.createGain()
    osc.connect(gain); gain.connect(_ctx.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    const t = _ctx.currentTime
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.18, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay)
    osc.start(t); osc.stop(t + decay + 0.05)
  } catch { /* no audio — the circle still works */ }
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

function Circle({ circleRef, lit }) {
  return (
    <div style={X.circleWrap}>
      <div ref={circleRef} style={{ ...X.circle, transform: `scale(${CIRCLE_MIN})`, opacity: lit ? 1 : 0.18 }} />
    </div>
  )
}

// ── BreathCheck ─────────────────────────────────────────────────────────────

const BASE_MS = 5000                 // 12 bpm — easy to follow cold
const CONDITIONS = {
  faster: { ms: 3500, label: 'Faster' },
  slower: { ms: 6500, label: 'Slower' },
  same:   { ms: 5000, label: 'Same'   },
}
const POLL = ['Faster', 'Slower', 'Same']

export function BreathCheck() {
  const [act, setAct] = useState('START')      // START → RUNNING → POLL → REVEAL
  const [cond, setCond] = useState(null)
  const { getPhase, getBT, startBreath, reset } = useBreathCycle()
  const { circleRef, start, stop } = useCircleAnim(getPhase, getBT)
  const seq = useRef(0)
  useExerciseLock(act === 'RUNNING')

  const run = useCallback(async () => {
    const my = ++seq.current
    const keys = Object.keys(CONDITIONS)
    const c = keys[Math.floor(Math.random() * keys.length)]
    setCond(c); setAct('RUNNING'); reset(); start()
    for (let i = 0; i < 2; i++) { if (my !== seq.current) return; await startBreath(BASE_MS) }
    for (let i = 0; i < 2; i++) { if (my !== seq.current) return; await startBreath(CONDITIONS[c].ms) }
    if (my !== seq.current) return
    stop(); setAct('POLL')
  }, [reset, start, startBreath, stop])

  const doReset = useCallback(() => { seq.current++; stop(); setCond(null); setAct('START') }, [stop])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (act === 'START') run()
      else if (act === 'POLL') setAct('REVEAL')
      else if (act === 'REVEAL') doReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, run, doReset])

  return (
    <div style={X.stage} onClick={e => e.stopPropagation()}>
      <Circle circleRef={circleRef} lit={act === 'RUNNING'} />
      <div style={X.overlay}>
        {act === 'START' && (
          <>
            <h2 style={X.title}>Breathe with the circle</h2>
            <p style={X.sub}>Four breaths together. Afterwards: did the pace speed up, slow down, or stay the same?</p>
            <Btn onClick={run}>Begin</Btn>
          </>
        )}
        {act === 'RUNNING' && <p style={X.cue}>in as it grows · out as it shrinks</p>}
        {act === 'POLL' && (
          <>
            <h2 style={X.title}>Did the pace change?</h2>
            <div style={X.optRow}>{POLL.map(o => <span key={o} style={X.opt}>{o}</span>)}</div>
            <p style={X.mono}>show of hands</p>
            <Btn onClick={() => setAct('REVEAL')}>Reveal →</Btn>
          </>
        )}
        {act === 'REVEAL' && cond && (
          <>
            <h2 style={X.title}>{CONDITIONS[cond].label}.</h2>
            <p style={X.sub}>
              Two breaths at {BASE_MS / 1000}s, then two at {CONDITIONS[cond].ms / 1000}s
              {cond === 'same' ? ' — no change at all.' : '.'}
            </p>
            <p style={X.hint}>The condition was drawn at random — nobody in the room knew, including me.</p>
            <Btn ghost onClick={doReset}>Again</Btn>
          </>
        )}
      </div>
      <p style={X.corner}>Enter = begin / reveal · Space = next slide</p>
    </div>
  )
}

// ── DriftRoom ───────────────────────────────────────────────────────────────

const DRIFT_TARGETS = [6000, 8000, 10000, 12000]
const DRIFT_BREATH  = 4000   // fixed, so the circle carries no timing cue

export function DriftRoom() {
  // START → WATCH (tone, circle, tone) → READY → REPRO (clock running) → RESULT
  const [act, setAct] = useState('START')
  const [target, setTarget] = useState(null)
  const [reproMs, setReproMs] = useState(null)
  const { getPhase, getBT, startBreath, reset } = useBreathCycle()
  const { circleRef, start, stop } = useCircleAnim(getPhase, getBT)
  const seq = useRef(0)
  const t0  = useRef(0)
  useExerciseLock(act === 'WATCH' || act === 'REPRO')

  const watch = useCallback(async () => {
    const my = ++seq.current
    const ms = DRIFT_TARGETS[Math.floor(Math.random() * DRIFT_TARGETS.length)]
    setTarget(ms); setReproMs(null); setAct('WATCH')
    reset(); start(); tone(523, 0.8)
    const end = performance.now() + ms
    while (performance.now() < end) {
      if (my !== seq.current) return
      await startBreath(Math.min(DRIFT_BREATH, Math.max(50, end - performance.now())))
    }
    if (my !== seq.current) return
    tone(392, 1.1); stop(); setAct('READY')
  }, [reset, start, startBreath, stop])

  const startRepro = useCallback(() => { t0.current = performance.now(); tone(523, 0.8); setAct('REPRO') }, [])
  const stopRepro  = useCallback(() => { setReproMs(performance.now() - t0.current); tone(392, 1.1); setAct('RESULT') }, [])
  const doReset    = useCallback(() => { seq.current++; stop(); setTarget(null); setReproMs(null); setAct('START') }, [stop])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (act === 'START') watch()
      else if (act === 'READY') startRepro()
      else if (act === 'REPRO') stopRepro()
      else if (act === 'RESULT') doReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, watch, startRepro, stopRepro, doReset])

  const ratio = reproMs && target ? reproMs / target : null
  let verdict = ''
  if (ratio) {
    const off = Math.abs(ratio - 1)
    verdict = off < 0.1 ? 'Right on.' : off < 0.25 ? 'Close.' : ratio > 1 ? 'Time stretched.' : 'Time compressed.'
  }

  return (
    <div style={X.stage} onClick={e => e.stopPropagation()}>
      <Circle circleRef={circleRef} lit={act === 'WATCH'} />
      <div style={X.overlay}>
        {act === 'START' && (
          <>
            <h2 style={X.title}>Drift — how long was that?</h2>
            <p style={X.sub}>
              A tone, a breathing circle, a second tone. Feel the length of it — don&rsquo;t count.
              Then we reproduce it together: raise your hand when the same time has passed.
            </p>
            <Btn onClick={watch}>Play the interval</Btn>
          </>
        )}
        {act === 'WATCH' && <p style={X.cue}>listen and feel</p>}
        {act === 'READY' && (
          <>
            <h2 style={X.title}>Now the room.</h2>
            <p style={X.sub}>Hands down. On the tone, the clock starts. Raise your hand when it feels like the same time has passed.</p>
            <Btn onClick={startRepro}>Start the clock</Btn>
          </>
        )}
        {act === 'REPRO' && (
          <>
            <h2 style={X.title}>…</h2>
            <p style={X.sub}>Stop when about half the hands are up.</p>
            <Btn onClick={stopRepro}>Stop</Btn>
          </>
        )}
        {act === 'RESULT' && (
          <>
            <p style={X.mono}>result</p>
            <h2 style={X.title}>{verdict}</h2>
            <div style={X.bars}>
              <Bar label="Actual" ms={target} color="#b89aa8" />
              <Bar label="The room" ms={reproMs} color="#f068a4" />
            </div>
            <p style={X.sub}>ratio <b style={{ color: 'var(--tx)' }}>{ratio.toFixed(2)}×</b>
              {ratio > 1.1 ? ' — time felt longer than it was: a slower, lower state.' :
               ratio < 0.9 ? ' — time felt shorter than it was: activated, compressed.' :
               ' — the room is well calibrated right now.'}
            </p>
            <Btn ghost onClick={doReset}>Again</Btn>
          </>
        )}
      </div>
      <p style={X.corner}>Enter = advance the exercise · Space = next slide · full game at radlab.zone/games/drift</p>
    </div>
  )
}

function Bar({ label, ms, color }) {
  const pct = Math.min(100, ms / 16000 * 100)
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ ...X.mono, color }}>{label}</span>
        <span style={{ ...X.mono, color }}>{(ms / 1000).toFixed(1)}s</span>
      </div>
      <div style={{ height: 12, background: '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bd)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 6, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

const X = {
  stage: { position: 'relative', width: '100%', minHeight: '72vh', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' },
  circleWrap: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  circle: {
    width: '52vh', height: '52vh', maxWidth: '52vw', maxHeight: '52vw', borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 42%, #ff9ec9 0%, var(--pk, #e84393) 72%)',
    boxShadow: '0 0 80px rgba(232,67,147,0.35)', transition: 'opacity 0.6s ease', willChange: 'transform',
  },
  overlay: { position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '0 24px', maxWidth: 720, width: '100%' },
  title: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(28px, 4.6vw, 50px)', fontWeight: 400, color: 'var(--tx)', margin: 0 },
  sub:   { fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  hint:  { fontSize: 'clamp(13px, 1.6vw, 17px)', color: 'var(--tx3)', margin: 0, fontStyle: 'italic' },
  cue:   { fontSize: 'clamp(18px, 2.4vw, 26px)', color: 'var(--tx2)', margin: 0, background: 'rgba(255,255,255,0.55)', padding: '8px 20px', borderRadius: 999 },
  mono:  { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', color: 'var(--tx3)', textTransform: 'uppercase', margin: 0 },
  optRow:{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  opt:   { fontSize: 'clamp(18px, 2.6vw, 30px)', fontWeight: 600, color: 'var(--pk)', background: '#fff', border: '1.5px solid var(--pkb, #f6c6dd)', borderRadius: 14, padding: '12px 26px' },
  bars:  { display: 'flex', flexDirection: 'column', gap: 14, width: 'min(460px, 90%)' },
  btn:   { marginTop: 6, borderRadius: 14, padding: '14px 40px', fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  corner:{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.7, margin: 0 },
}
