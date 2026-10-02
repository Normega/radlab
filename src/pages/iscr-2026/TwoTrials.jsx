// ISCR 2026 opener — two BCAT trials run on the whole room (no device, no data).
//
// Both follow the BCAT trial structure: 4 breaths.
//   Trial A  gradual: the change is amortized evenly across breaths 2, 3 and 4
//   Trial B  abrupt:  the whole change lands between breaths 2 and 3
//
// Both therefore last the same time (2 × BASE_MS + 2 × TARGET_MS = 13.6 s) and end
// at exactly the same pace (BASE_MS → TARGET_MS), so the reveal's two pace
// traces line up end to end and differ only in how the change arrived. Trial A comes first
// so the room is naive to it; most people should miss the creep and catch the
// jump. Answers come in by Zoom chat, as the codes shown on screen. That splits the room into hits and misses on the same bodily change —
// the paper's design, done live — and the third poll asks which trial felt more
// activating.
//
// Clicker-friendly: → / Space / PageDown / Enter drive the exercise from START
// to REVEAL (a presentation clicker sends these, not Enter alone). While it owns
// those keys it sets data-exercise-active on <body>, which the deck honours;
// at REVEAL it lets go, so the next click moves to the next slide. R resets.
// Clicks inside never reach the deck's click-to-advance.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBreathCycle } from '../../games/EbbAndFlow/useBreathCycle'

// ── Timing ──────────────────────────────────────────────────────────────────
// Baseline is the Study 4/5 rate (15/min). Target is 30% shorter breaths, the
// same size as the ISARP opener's change. Study 5 mean 75%-correct thresholds
// for speeding up were −.32 (abrupt) and −.38 (gradual) on this same 4-breath
// structure, so −.30 delivered gradually should sit below most people's
// threshold, and the abrupt version near it for a room that has just been asked.
const BASE_MS   = 4000
const TARGET_MS = 2800
const STEP_MS = (TARGET_MS - BASE_MS) / 3

const TRIAL_A = [BASE_MS, BASE_MS + STEP_MS, BASE_MS + 2 * STEP_MS, TARGET_MS]   // 4.0 3.6 3.2 2.8
const TRIAL_B = [BASE_MS, BASE_MS, TARGET_MS, TARGET_MS]                         // 4.0 4.0 2.8 2.8

const CIRCLE_MIN = 0.42
const CIRCLE_MAX = 1.0
const FORWARD = [' ', 'Enter', 'ArrowRight', 'PageDown']

// START → RUN_A → ASK_A → RUN_B → ASK_B → ASK_FELT → REVEAL
export default function TwoTrials() {
  const [act, setAct] = useState('START')
  const { getPhase, getBT, startBreath, reset } = useBreathCycle()
  const circleRef = useRef(null)
  const rafRef = useRef(null)
  const seq = useRef(0)

  // The exercise owns the forward keys until the reveal.
  useEffect(() => {
    if (act !== 'REVEAL') document.body.dataset.exerciseActive = '1'
    else delete document.body.dataset.exerciseActive
    return () => { delete document.body.dataset.exerciseActive }
  }, [act])

  // Direct DOM writes each frame, never setState (RADlab animation convention).
  const startAnim = useCallback(() => {
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

  const stopAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (circleRef.current) circleRef.current.style.transform = `scale(${CIRCLE_MIN})`
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const runTrial = useCallback(async (durs, running, after) => {
    const my = ++seq.current
    setAct(running)
    reset()
    startAnim()
    for (const ms of durs) {
      if (my !== seq.current) return
      await startBreath(ms)
    }
    if (my !== seq.current) return
    stopAnim()
    setAct(after)
  }, [reset, startAnim, startBreath, stopAnim])

  const forward = useCallback(() => {
    if (act === 'START')         runTrial(TRIAL_A, 'RUN_A', 'ASK_A')
    else if (act === 'ASK_A')    runTrial(TRIAL_B, 'RUN_B', 'ASK_B')
    else if (act === 'ASK_B')    setAct('ASK_FELT')
    else if (act === 'ASK_FELT') setAct('REVEAL')
    // RUN_* ignore presses — a stray click must not cut a trial short.
  }, [act, runTrial])

  const doReset = useCallback(() => { seq.current++; stopAnim(); setAct('START') }, [stopAnim])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'r' || e.key === 'R') { doReset(); return }
      if (act === 'REVEAL' || !FORWARD.includes(e.key)) return
      e.preventDefault()
      forward()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, forward, doReset])

  const running = act === 'RUN_A' || act === 'RUN_B'

  return (
    <div style={X.stage} onClick={e => e.stopPropagation()}>
      <div style={X.circleWrap}>
        <div ref={circleRef} style={{ ...X.circle, transform: `scale(${CIRCLE_MIN})`, opacity: running ? 1 : (act === 'REVEAL' ? 0 : 0.18) }} />
      </div>

      <div style={X.overlay}>
        {act === 'START' && (
          <>
            <h2 style={X.title}>Breathe with the circle</h2>
            <p style={X.sub}>In as it grows, out as it shrinks.</p>
            <Btn onClick={forward}>Begin</Btn>
          </>
        )}

        {running && (
          <p style={X.cue}>{act === 'RUN_B' ? 'once more · ' : ''}in as it grows · out as it shrinks</p>
        )}

        {act === 'ASK_A' && (
          <Ask n="1" q="Did the pace change?" opts={[['Faster', 'F'], ['Slower', 'S'], ['Same', '=']]} onNext={forward} next="Once more →" />
        )}
        {act === 'ASK_B' && (
          <Ask n="2" q="And this time?" opts={[['Faster', 'F'], ['Slower', 'S'], ['Same', '=']]} onNext={forward} next="Next →" />
        )}
        {act === 'ASK_FELT' && (
          <Ask n="3" q="Which one stirred you up more?" opts={[['The first', '1'], ['The second', '2'], ['No difference', '0']]} onNext={forward} next="Reveal →" />
        )}

        {act === 'REVEAL' && (
          <>
            <h2 style={X.title}>Both sped up by the same amount.</h2>
            <PaceTraces />
            <p style={X.sub}>
              {BASE_MS / 1000} s → {TARGET_MS / 1000} s per breath, both times. The first crept up; the second jumped.
            </p>
            <p style={X.punch}>Same change in your breathing. Did it feel the same?</p>
          </>
        )}
      </div>

      <button onClick={doReset} style={X.corner} aria-label="Reset exercise">reset (R)</button>
    </div>
  )
}

function Ask({ n, q, opts, onNext, next }) {
  return (
    <>
      <p style={X.mono}>{n} of 3 · type your answer in the chat</p>
      <h2 style={X.title}>{q}</h2>
      <div style={X.optRow}>{opts.map(([label, code]) => (
        <span key={code} style={X.opt}><span style={X.code}>{code}</span>{label}</span>
      ))}</div>
      <Btn onClick={onNext}>{next}</Btn>
    </>
  )
}

function Btn({ children, onClick }) {
  return <button onClick={onClick} style={X.btn}>{children}</button>
}

// Pace (breaths/min) over time for the two trials, on one shared time axis, so
// the creep and the jump visibly land on the same final rate. Also used on the
// method slide as "what you just did".
export function PaceTraces({ width = 620 }) {
  const W = width, rowH = 92, padL = 86, padR = 70, top = 14, gap = 22
  const H = top + rowH * 2 + gap + 34
  const tMax = Math.max(sum(TRIAL_A), sum(TRIAL_B)) / 1000
  const bpmLo = 60000 / BASE_MS, bpmHi = 60000 / TARGET_MS
  const xOf = t => padL + (t / tMax) * (W - padL - padR)

  const row = (durs, y0, label, sub, color) => {
    const yOf = bpm => y0 + rowH - 14 - ((bpm - bpmLo) / (bpmHi - bpmLo)) * (rowH - 34)
    let t = 0, d = ''
    durs.forEach((ms, i) => {
      const bpm = 60000 / ms, x1 = xOf(t / 1000), x2 = xOf((t + ms) / 1000)
      d += `${i === 0 ? 'M' : 'L'}${x1.toFixed(1)},${yOf(bpm).toFixed(1)} L${x2.toFixed(1)},${yOf(bpm).toFixed(1)} `
      t += ms
    })
    return (
      <g>
        <text x={8} y={y0 + rowH / 2 - 4} fontSize="15" fontWeight="600" fill="#1c1c1e" fontFamily="'DM Sans',sans-serif">{label}</text>
        <text x={8} y={y0 + rowH / 2 + 14} fontSize="12" fill="#8a8b8f" fontFamily="'DM Sans',sans-serif">{sub}</text>
        <line x1={padL} x2={W - padR} y1={yOf(bpmHi)} y2={yOf(bpmHi)} stroke="#e7d3dd" strokeDasharray="4 4" />
        <line x1={padL} x2={W - padR} y1={yOf(bpmLo)} y2={yOf(bpmLo)} stroke="#e7d3dd" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" />
        <text x={W - padR + 8} y={yOf(bpmHi) + 4} fontSize="12" fill="#6b6c70" fontFamily="monospace">{bpmHi.toFixed(1)}/min</text>
        <text x={W - padR + 8} y={yOf(bpmLo) + 4} fontSize="12" fill="#6b6c70" fontFamily="monospace">{bpmLo.toFixed(0)}/min</text>
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', background: '#fff', borderRadius: 12, border: '1px solid rgba(180,100,140,0.18)' }}>
      {row(TRIAL_A, top, 'Trial 1', 'gradual', '#0072B2')}
      {row(TRIAL_B, top + rowH + gap, 'Trial 2', 'abrupt', '#D99A00')}
      <line x1={padL} x2={W - padR} y1={H - 26} y2={H - 26} stroke="#c9cacd" />
      {[0, 5, 10, 15, 20].filter(s => s <= tMax).map(s => (
        <g key={s}>
          <line x1={xOf(s)} x2={xOf(s)} y1={H - 26} y2={H - 21} stroke="#c9cacd" />
          <text x={xOf(s)} y={H - 8} fontSize="11" fill="#8a8b8f" textAnchor="middle" fontFamily="monospace">{s}s</text>
        </g>
      ))}
    </svg>
  )
}

function sum(a) { return a.reduce((s, v) => s + v, 0) }

const X = {
  stage: { position: 'relative', width: '100%', minHeight: '76vh', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' },
  circleWrap: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  circle: {
    width: '58vh', height: '58vh', maxWidth: '58vw', maxHeight: '58vw', borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 42%, #ff9ec9 0%, var(--pk, #e84393) 72%)',
    boxShadow: '0 0 80px rgba(232,67,147,0.35)', transition: 'opacity 0.6s ease', willChange: 'transform',
  },
  overlay: { position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '0 24px', maxWidth: 940, width: '100%' },
  title: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(28px, 4.6vw, 50px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.1 },
  sub:   { fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  punch: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.8vw, 32px)', color: 'var(--pkd)', margin: 0, fontStyle: 'italic' },
  cue:   { fontSize: 'clamp(18px, 2.4vw, 26px)', color: 'var(--tx2)', margin: 0, background: 'rgba(255,255,255,0.55)', padding: '8px 20px', borderRadius: 999 },
  mono:  { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', color: 'var(--tx3)', textTransform: 'uppercase', margin: 0 },
  optRow:{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  opt:   { fontSize: 'clamp(18px, 2.6vw, 30px)', fontWeight: 600, color: 'var(--pk)', background: '#fff', border: '1.5px solid var(--pkb, #f6c6dd)', borderRadius: 14, padding: '12px 26px' },
  code:  { display: 'inline-grid', placeItems: 'center', minWidth: 38, height: 38, marginRight: 12, borderRadius: 10, background: 'var(--pk)', color: '#fff', fontFamily: '"Space Mono",monospace', fontSize: '0.85em' },
  btn:   { marginTop: 6, borderRadius: 14, padding: '14px 40px', fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', background: 'var(--pk)', color: '#fff', border: 'none' },
  corner:{ position: 'absolute', bottom: 0, right: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.5 },
}
