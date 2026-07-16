// v1 — ISARP keynote OPENING exercise (whole-room, no device, no data).
// A full-screen breathing circle runs one fixed BCAT trial: 2 baseline breaths
// then 2 accelerated breaths (change embedded at breath 3). Afterward the
// presenter clicks through three polling prompts and a reveal. Nothing is
// stored or transmitted. Distinct from the instrumented BreathBelt strap demo.
//
// Reuses useBreathCycle (same motion signature as the closing demo) but renders
// a plain circle for back-of-room legibility.
//
// Presenter controls: Begin · Advance · Reset. Keyboard: Space/Enter/→/PageDown
// advance, R resets — works with standard presentation clickers.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBreathCycle } from '../EbbAndFlow/useBreathCycle'

// ── Timing (baseline confirmed with Norm 2026-07-06: 12 bpm for a cold room) ─
const BASE_MS  = 5000   // 12 breaths/min — calmer than Study 4/5's 15 bpm, easier to follow cold
const ACCEL_MS = 3500   // 30% faster — moderate, clearly perceptible, not near-threshold
const BASELINE_BREATHS = 2   // breaths 1–2
const ACCEL_BREATHS    = 2   // breaths 3–4 (change onset at breath 3)

const CIRCLE_MIN = 0.42  // scale at full exhale (contracted)
const CIRCLE_MAX = 1.0   // scale at full inhale (expanded)

const POLLS = [
  { key: 'change',     q: 'Did the pace change?',           opts: ['Faster', 'Slower', 'Same'] },
  { key: 'confidence', q: 'How confident were you?',        opts: ['Confident', 'Not confident'] },
  { key: 'arousal',    q: 'What happened to your arousal?', opts: ['More activated', 'Same', 'Calmer'] },
]

// Acts: START → RUNNING → HOLD → POLL(0..2) → REVEAL
export default function PacerOpenerDemo() {
  const [act,     setAct]     = useState('START')
  const [pollIdx, setPollIdx] = useState(0)

  const { getPhase, getBT, startBreath, reset } = useBreathCycle()
  const circleRef = useRef(null)
  const rafRef    = useRef(null)
  const runSeqRef = useRef(0)      // bumps to cancel an in-flight trial on reset
  const pollIdxRef = useRef(0)
  useEffect(() => { pollIdxRef.current = pollIdx }, [pollIdx])

  // ── Circle animation — direct DOM writes each frame, never setState
  //    (RADlab timing convention: no state inside animation loops). ──────────
  const startAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const loop = () => {
      const el = circleRef.current
      if (el) {
        const bt = getBT(getPhase())               // 0 exhale-peak … 1 inhale-peak
        const s  = CIRCLE_MIN + (CIRCLE_MAX - CIRCLE_MIN) * bt
        el.style.transform = `scale(${s.toFixed(4)})`
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [getPhase, getBT])

  const stopAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    const el = circleRef.current
    if (el) el.style.transform = `scale(${CIRCLE_MIN})`   // rest contracted
  }, [])

  // ── Fixed trial: 2 baseline breaths, then 2 accelerated ───────────────────
  const runTrial = useCallback(async () => {
    const mySeq = ++runSeqRef.current
    setAct('RUNNING')
    reset()
    startAnim()
    for (let i = 0; i < BASELINE_BREATHS; i++) {
      if (mySeq !== runSeqRef.current) return
      await startBreath(BASE_MS)
    }
    for (let i = 0; i < ACCEL_BREATHS; i++) {
      if (mySeq !== runSeqRef.current) return
      await startBreath(ACCEL_MS)
    }
    if (mySeq !== runSeqRef.current) return
    stopAnim()
    setAct('HOLD')
  }, [reset, startBreath, startAnim, stopAnim])

  // ── Presenter advance: HOLD → POLL 0 → 1 → 2 → REVEAL ─────────────────────
  const advance = useCallback(() => {
    setAct(a => {
      if (a === 'HOLD') { setPollIdx(0); return 'POLL' }
      if (a === 'POLL') {
        if (pollIdxRef.current + 1 < POLLS.length) { setPollIdx(p => p + 1); return 'POLL' }
        return 'REVEAL'
      }
      return a
    })
  }, [])

  const doReset = useCallback(() => {
    runSeqRef.current++            // cancels any in-flight trial loop
    stopAnim()
    setPollIdx(0)
    setAct('START')
  }, [stopAnim])

  // ── Keyboard / clicker ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'r' || e.key === 'R') { doReset(); return }
      if ([' ', 'Enter', 'ArrowRight', 'PageDown'].includes(e.key)) {
        e.preventDefault()
        if (act === 'START') runTrial()
        else if (act === 'HOLD' || act === 'POLL') advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, runTrial, advance, doReset])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const poll = POLLS[pollIdx]

  return (
    <div style={S.stage}>
      <div style={S.circleWrap}>
        <div
          ref={circleRef}
          style={{ ...S.circle, transform: `scale(${CIRCLE_MIN})`, opacity: act === 'RUNNING' ? 1 : 0.22 }}
        />
      </div>

      <div style={S.overlay}>
        {act === 'START' && (
          <>
            <h1 style={S.title}>Breathe with the circle</h1>
            <p style={S.sub}>When you're ready, we'll take four breaths together.</p>
            <Btn onClick={runTrial}>Begin</Btn>
          </>
        )}

        {act === 'RUNNING' && <p style={S.runCue}>Breathe with the circle</p>}

        {act === 'HOLD' && (
          <>
            <p style={S.sub}>Trial complete.</p>
            <Btn onClick={advance}>Show questions →</Btn>
          </>
        )}

        {act === 'POLL' && poll && (
          <>
            <p style={S.pollCount}>{pollIdx + 1} of {POLLS.length}</p>
            <h2 style={S.pollQ}>{poll.q}</h2>
            <div style={S.optRow}>
              {poll.opts.map(o => <span key={o} style={S.opt}>{o}</span>)}
            </div>
            <p style={S.showHands}>Show of hands</p>
            <Btn onClick={advance}>
              {pollIdx + 1 < POLLS.length ? 'Next question →' : 'Reveal →'}
            </Btn>
          </>
        )}

        {act === 'REVEAL' && (
          <>
            <h2 style={S.pollQ}>The pace accelerated.</h2>
            <p style={S.sub}>
              Two steady breaths, then the pace sped up from breath three
              ({BASE_MS / 1000}s → {ACCEL_MS / 1000}s per breath).
            </p>
            <p style={S.revealHint}>Compare with the room's hands: Faster / Slower / Same.</p>
            <Btn ghost onClick={doReset}>Reset</Btn>
          </>
        )}
      </div>

      {act !== 'START' && act !== 'REVEAL' && (
        <button onClick={doReset} style={S.resetCorner} aria-label="Reset">Reset</button>
      )}
    </div>
  )
}

function Btn({ children, onClick, ghost }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...S.btn,
        background: ghost ? 'transparent' : 'var(--pk)',
        color:      ghost ? 'var(--pk)'   : '#fff',
        border:     ghost ? '1.5px solid var(--pk)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

const S = {
  stage: {
    position: 'fixed', inset: 0, background: 'var(--bg, #FCF0F5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  circleWrap: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
  },
  circle: {
    width: '58vh', height: '58vh', maxWidth: '58vw', maxHeight: '58vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 42%, #ff9ec9 0%, var(--pk, #e84393) 72%)',
    boxShadow: '0 0 80px rgba(232,67,147,0.35)',
    transition: 'opacity 0.6s ease',
    willChange: 'transform',
  },
  overlay: {
    position: 'relative', zIndex: 2, textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
    padding: '0 24px', maxWidth: 720,
  },
  title:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 400, color: 'var(--tx)', margin: 0 },
  pollQ:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(26px, 4.5vw, 48px)', fontWeight: 400, color: 'var(--tx)', margin: 0 },
  sub:      { fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  runCue:   { fontSize: 'clamp(18px, 2.4vw, 26px)', color: 'var(--tx2)', margin: 0, background: 'rgba(255,255,255,0.55)', padding: '8px 20px', borderRadius: 999 },
  pollCount:{ fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', color: 'var(--tx3)', textTransform: 'uppercase', margin: 0 },
  optRow:   { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  opt:      { fontSize: 'clamp(18px, 2.6vw, 30px)', fontWeight: 600, color: 'var(--pk)', background: '#fff', border: '1.5px solid var(--pkb, #f6c6dd)', borderRadius: 14, padding: '12px 26px' },
  showHands:{ fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx3)', margin: 0, letterSpacing: '0.06em' },
  revealHint:{ fontSize: 'clamp(14px, 1.8vw, 18px)', color: 'var(--tx3)', margin: 0 },
  btn: {
    marginTop: 6, borderRadius: 14, padding: '14px 40px',
    fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 600, cursor: 'pointer',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  resetCorner: {
    position: 'absolute', bottom: 16, right: 18, zIndex: 3,
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)',
    opacity: 0.5,
  },
}
