// The room runs two BCAT trials and answers each one on their phones
// (/poll/<code>). Same 4-breath structure as the task and the ISCR opener:
//   Trial 1  gradual: the change amortized across breaths 2, 3 and 4
//   Trial 2  abrupt:  the whole change between breaths 2 and 3
// Both last 13.6 s and end at the same pace, so they differ only in how the
// change arrived. Trial 1 comes first, while the room is naive to it.
//
// After each trial the screen shows how many phones have answered (live), so
// the presenter can wait for the room instead of guessing. Clicker-friendly:
// → / Space / PageDown / Enter drive START → trial 1 → answers → trial 2 →
// answers → done, then release the keys to the deck. R resets.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBreathCycle } from '../../games/EbbAndFlow/useBreathCycle'
import { usePollResults } from './talkPoll'

const BASE_MS   = 4000          // 15/min, the Study 4/5 baseline
// 30% faster breathing rate (15 → 19.5/min), i.e. breaths 23% shorter (change −.23).
// Norm's call 2026-10-12, after a live test: −.30 (4.0 → 2.8 s) was too overt.
// Study 5 mean 75%-correct thresholds were −.38 gradual and −.32 abrupt, so both
// trials now sit below the average threshold: expect fewer noticers on trial 2 too.
const TARGET_MS = Math.round(BASE_MS / 1.3)   // 3077
const STEP_MS = (TARGET_MS - BASE_MS) / 3
const TRIAL_A = [BASE_MS, BASE_MS + STEP_MS, BASE_MS + 2 * STEP_MS, TARGET_MS]   // 4.0 3.69 3.38 3.08
const TRIAL_B = [BASE_MS, BASE_MS, TARGET_MS, TARGET_MS]                         // 4.0 4.0 3.08 3.08

const CIRCLE_MIN = 0.42
const CIRCLE_MAX = 1.0
const FORWARD = [' ', 'Enter', 'ArrowRight', 'PageDown']

// START → RUN_A → ANS_A → RUN_B → ANS_B → DONE
export default function RoomTrials({ code }) {
  const [act, setAct] = useState('START')
  const { getPhase, getBT, startBreath, reset } = useBreathCycle()
  const circleRef = useRef(null)
  const rafRef = useRef(null)
  const seq = useRef(0)
  const rows = usePollResults(code, act === 'ANS_A' || act === 'ANS_B')
  const answered = t => rows.filter(r => r.trial === t).length

  useEffect(() => {
    if (act !== 'DONE') document.body.dataset.exerciseActive = '1'
    else delete document.body.dataset.exerciseActive
    return () => { delete document.body.dataset.exerciseActive }
  }, [act])

  // Direct DOM writes each frame, never setState (RADlab animation convention).
  const startAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const loop = () => {
      const el = circleRef.current
      if (el) el.style.transform = `scale(${(CIRCLE_MIN + (CIRCLE_MAX - CIRCLE_MIN) * getBT(getPhase())).toFixed(4)})`
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
    setAct(running); reset(); startAnim()
    for (const ms of durs) {
      if (my !== seq.current) return
      await startBreath(ms)
    }
    if (my !== seq.current) return
    stopAnim(); setAct(after)
  }, [reset, startAnim, startBreath, stopAnim])

  const forward = useCallback(() => {
    if (act === 'START')      runTrial(TRIAL_A, 'RUN_A', 'ANS_A')
    else if (act === 'ANS_A') runTrial(TRIAL_B, 'RUN_B', 'ANS_B')
    else if (act === 'ANS_B') setAct('DONE')
  }, [act, runTrial])
  const doReset = useCallback(() => { seq.current++; stopAnim(); setAct('START') }, [stopAnim])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'r' || e.key === 'R') { doReset(); return }
      if (act === 'DONE' || !FORWARD.includes(e.key)) return
      e.preventDefault(); forward()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, forward, doReset])

  const running = act === 'RUN_A' || act === 'RUN_B'

  return (
    <div style={X.stage} onClick={e => e.stopPropagation()}>
      <div style={X.circleWrap}>
        <div ref={circleRef} style={{ ...X.circle, transform: `scale(${CIRCLE_MIN})`, opacity: running ? 1 : 0.16 }} />
      </div>
      <div style={X.overlay}>
        {act === 'START' && (
          <>
            <h2 style={X.title}>Breathe with the circle</h2>
            <p style={X.sub}>In as it grows, out as it shrinks. When it stops, answer on your phone.</p>
            <button style={X.btn} onClick={forward}>Begin</button>
          </>
        )}
        {running && <p style={X.cue}>{act === 'RUN_B' ? 'once more · ' : ''}in as it grows · out as it shrinks</p>}
        {(act === 'ANS_A' || act === 'ANS_B') && (
          <>
            <p style={X.mono}>on your phone</p>
            <h2 style={X.title}>Trial {act === 'ANS_A' ? 1 : 2}: did the pace change? How activated do you feel?</h2>
            <div style={X.count}>
              <span style={X.countN}>{answered(act === 'ANS_A' ? 1 : 2)}</span>
              <span style={X.countL}>answered</span>
            </div>
            <p style={X.url}>radlab.zone/poll/{code}</p>
            <button style={X.btn} onClick={forward}>{act === 'ANS_A' ? 'Trial 2 →' : 'Done →'}</button>
          </>
        )}
        {act === 'DONE' && (
          <>
            <h2 style={X.title}>Thank you.</h2>
            <p style={X.sub}>Keep your phone handy. Your answers are about to become a figure.</p>
          </>
        )}
      </div>
      <button onClick={doReset} style={X.corner} aria-label="Reset exercise">reset (R)</button>
    </div>
  )
}

// Pace (breaths/min) over time for the two trials on one shared time axis:
// the creep and the jump land on the same final rate at the same moment.
export function PaceTraces({ width = 640 }) {
  const W = width, rowH = 92, padL = 86, padR = 70, top = 14, gap = 22
  const H = top + rowH * 2 + gap + 34
  const sum = a => a.reduce((s, v) => s + v, 0)
  const tMax = Math.max(sum(TRIAL_A), sum(TRIAL_B)) / 1000
  const lo = 60000 / BASE_MS, hi = 60000 / TARGET_MS
  const xOf = t => padL + (t / tMax) * (W - padL - padR)
  const row = (durs, y0, label, sub, color) => {
    const yOf = b => y0 + rowH - 14 - ((b - lo) / (hi - lo)) * (rowH - 34)
    let t = 0, d = ''
    durs.forEach((ms, i) => {
      const b = 60000 / ms
      d += `${i ? 'L' : 'M'}${xOf(t / 1000).toFixed(1)},${yOf(b).toFixed(1)} L${xOf((t + ms) / 1000).toFixed(1)},${yOf(b).toFixed(1)} `
      t += ms
    })
    return (
      <g>
        <text x={8} y={y0 + rowH / 2 - 4} fontSize="15" fontWeight="600" fill="#1c1c1e" fontFamily="'DM Sans',sans-serif">{label}</text>
        <text x={8} y={y0 + rowH / 2 + 14} fontSize="12" fill="#8a8b8f" fontFamily="'DM Sans',sans-serif">{sub}</text>
        <line x1={padL} x2={W - padR} y1={yOf(hi)} y2={yOf(hi)} stroke="#e7d3dd" strokeDasharray="4 4" />
        <line x1={padL} x2={W - padR} y1={yOf(lo)} y2={yOf(lo)} stroke="#e7d3dd" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" />
        <text x={W - padR + 8} y={yOf(hi) + 4} fontSize="12" fill="#6b6c70" fontFamily="'Space Mono',monospace">{hi.toFixed(1)}/min</text>
        <text x={W - padR + 8} y={yOf(lo) + 4} fontSize="12" fill="#6b6c70" fontFamily="'Space Mono',monospace">{lo.toFixed(0)}/min</text>
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', background: '#fff', borderRadius: 12, border: '1px solid rgba(180,100,140,0.18)' }}>
      {row(TRIAL_A, top, 'Trial 1', 'gradual', '#0072B2')}
      {row(TRIAL_B, top + rowH + gap, 'Trial 2', 'abrupt', '#D99A00')}
      <line x1={padL} x2={W - padR} y1={H - 26} y2={H - 26} stroke="#c9cacd" />
      {[0, 4, 8, 12].map(s => (
        <g key={s}>
          <line x1={xOf(s)} x2={xOf(s)} y1={H - 26} y2={H - 21} stroke="#c9cacd" />
          <text x={xOf(s)} y={H - 8} fontSize="11" fill="#8a8b8f" textAnchor="middle" fontFamily="'Space Mono',monospace">{s}s</text>
        </g>
      ))}
    </svg>
  )
}

const X = {
  stage: { position: 'relative', width: '100%', minHeight: '76vh', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' },
  circleWrap: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  circle: {
    width: '60vh', height: '60vh', maxWidth: '60vw', maxHeight: '60vw', borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 42%, #ff9ec9 0%, var(--pk, #e84393) 72%)',
    boxShadow: '0 0 80px rgba(232,67,147,0.35)', transition: 'opacity 0.6s ease', willChange: 'transform',
  },
  overlay: { position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '0 24px', maxWidth: 900, width: '100%' },
  title: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(28px, 4.4vw, 48px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  sub:   { fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  cue:   { fontSize: 'clamp(18px, 2.4vw, 26px)', color: 'var(--tx2)', margin: 0, background: 'rgba(255,255,255,0.55)', padding: '8px 20px', borderRadius: 999 },
  mono:  { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', color: 'var(--tx3)', textTransform: 'uppercase', margin: 0 },
  count: { display: 'flex', alignItems: 'baseline', gap: 12, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '12px 28px' },
  countN:{ fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(44px, 7vw, 76px)', color: 'var(--pk)', lineHeight: 1 },
  countL:{ fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--tx2)' },
  url:   { fontFamily: '"Space Mono",monospace', fontSize: 15, color: 'var(--tx3)', margin: 0 },
  btn:   { marginTop: 6, borderRadius: 14, padding: '14px 40px', fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', background: 'var(--pk)', color: '#fff', border: 'none' },
  corner:{ position: 'absolute', bottom: 0, right: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.5 },
}
