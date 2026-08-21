import { useState, useEffect, useRef, useCallback } from 'react'
import GameIntro from '../shared/GameIntro'
import PrimaryCTA from '../../components/ui/PrimaryCTA'
import ContactAvatar from '../FirstContact/components/ContactAvatar'
import BreathShapeChart, { MiniShape } from './BreathShapeChart'
import { parseBreaths, meanBreath, maxDuration } from './breathShapes'

// ── FreeBreath ──────────────────────────────────────────────────────────────
// Come, See prototype — free breathing, no pacer. The player drives the face:
// hold one control to breathe in, another to breathe out, hold nothing to be
// still. Every hold and release is logged as a phase segment; Finish turns the
// log into per-breath shapes (see breathShapes.js / BreathShapeChart.jsx).
//
// Screens: INTRO → BREATHING → RESULTS. No auth, writes nothing — /dev route.
//
// The face is First Contact's ContactAvatar, unmodified. It expects a paced
// 0–1 cycle phase and maps it through a sine to "breath fullness"; here the
// fullness is the primary signal, so getPhase inverts that sine. The avatar's
// own scale amplitude is a subtle 15%, tuned for paced sync — an outer wrapper
// adds more growth so key-driven breathing reads unmistakably.

const AMBER = '#BA7517'   // inhale — matches First Contact's prompt colors
const BLUE  = '#185FA5'   // exhale
const MONO  = '"Space Mono", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const TAU_IN      = 1.6   // s — fullness time constant while inhaling
const TAU_OUT     = 2.2   // s — while exhaling (empties a touch slower)
const OUTER_SCALE = 0.22  // extra growth on top of the avatar's built-in 15%

const STATE_LABEL = { in: 'breathing in', out: 'breathing out', pause: 'still' }
const STATE_COLOR = { in: AMBER, out: BLUE, pause: 'var(--gy)' }

export default function FreeBreath() {
  const [screen, setScreen]         = useState('INTRO')
  const [control, setControlState]  = useState('pause')
  const [breathCount, setBreathCount] = useState(0)
  const [breaths, setBreaths]       = useState([])

  const fullnessRef = useRef(0)        // 0 empty … 1 full
  const controlRef  = useRef('pause')
  const heldRef     = useRef([])       // pressed-and-still-held, in press order
  const segsRef     = useRef([])       // closed segments {phase, t0, t1}
  const openSegRef  = useRef(null)     // {phase, t0}
  const startedRef  = useRef(false)    // recording begins at the first inhale

  const avatarControlRef = useRef(null)
  const outerRef         = useRef(null)

  // ── Control changes → segment log ─────────────────────────────────────
  const applyControl = useCallback((next) => {
    if (next === controlRef.current) return
    const t = performance.now()
    controlRef.current = next
    setControlState(next)

    if (!startedRef.current) {
      // Nothing recorded until the first inhale — an exhale or pause with
      // empty lungs is animation, not data.
      if (next !== 'in') return
      startedRef.current = true
      openSegRef.current = { phase: 'in', t0: t }
    } else {
      segsRef.current.push({ ...openSegRef.current, t1: t })
      openSegRef.current = { phase: next, t0: t }
    }

    const all = [...segsRef.current, { ...openSegRef.current, t1: t }]
    setBreathCount(parseBreaths(all).length)
  }, [])

  const press = useCallback((kind) => {
    heldRef.current = [...heldRef.current.filter(k => k !== kind), kind]
    applyControl(kind)
  }, [applyControl])

  const release = useCallback((kind) => {
    heldRef.current = heldRef.current.filter(k => k !== kind)
    const held = heldRef.current
    applyControl(held.length ? held[held.length - 1] : 'pause')
  }, [applyControl])

  const releaseAll = useCallback(() => {
    heldRef.current = []
    applyControl('pause')
  }, [applyControl])

  // ── Keyboard: I / ↑ inhale, O / ↓ exhale ──────────────────────────────
  useEffect(() => {
    if (screen !== 'BREATHING') return
    const keyOf = (code) =>
      (code === 'KeyI' || code === 'ArrowUp')   ? 'in'  :
      (code === 'KeyO' || code === 'ArrowDown') ? 'out' : null
    function down(e) {
      const k = keyOf(e.code)
      if (!k) return
      e.preventDefault()
      if (!e.repeat) press(k)
    }
    function up(e) {
      const k = keyOf(e.code)
      if (!k) return
      e.preventDefault()
      release(k)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', releaseAll)
    }
  }, [screen, press, release, releaseAll])

  // ── Fullness integration + outer scale ────────────────────────────────
  useEffect(() => {
    if (screen !== 'BREATHING') return
    avatarControlRef.current?.resumeAnimation()
    let last = performance.now()
    let raf = null
    function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const c = controlRef.current
      let f = fullnessRef.current
      if (c === 'in')  f += (1 - f) * (dt / TAU_IN)
      if (c === 'out') f += (0 - f) * (dt / TAU_OUT)
      fullnessRef.current = f
      if (outerRef.current) {
        outerRef.current.style.transform = `scale(${(1 + OUTER_SCALE * f).toFixed(4)})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [screen])

  // ContactAvatar computes fullness = (sin(phase·2π − π/2) + 1) / 2; invert
  // so the avatar's fullness equals ours exactly.
  const getPhase = useCallback(() => {
    const f = Math.min(0.9999, Math.max(0.0001, fullnessRef.current))
    return (Math.asin(2 * f - 1) + Math.PI / 2) / (2 * Math.PI)
  }, [])

  // ── Screen transitions ────────────────────────────────────────────────
  function begin() {
    segsRef.current    = []
    openSegRef.current = null
    startedRef.current = false
    heldRef.current    = []
    controlRef.current = 'pause'
    fullnessRef.current = 0
    setControlState('pause')
    setBreathCount(0)
    setBreaths([])
    setScreen('BREATHING')
  }

  function finishSession() {
    const t = performance.now()
    const all = openSegRef.current
      ? [...segsRef.current, { ...openSegRef.current, t1: t }]
      : segsRef.current
    const parsed = parseBreaths(all)
    if (parsed.length === 0) return
    heldRef.current = []
    setBreaths(parsed)
    setScreen('RESULTS')
  }

  // ── Render ────────────────────────────────────────────────────────────
  const mean = meanBreath(breaths)
  const maxDur = maxDuration(breaths)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={S.wrap}>

        {screen === 'INTRO' && (
          <GameIntro
            eyebrow="RADlab · Come, See — prototype"
            title="Free breathing."
            lead="No pacer this time. The face breathes only while you tell it to — you set the length of every in, every out, and every pause."
            steps={[
              { title: 'Breathe in',  body: 'Hold I (or the amber button) for as long as your inhale lasts. The face fills.' },
              { title: 'Breathe out', body: 'Hold O (or the blue button) for as long as your exhale lasts. The face empties.' },
              { title: 'Rest',        body: 'Hold nothing between breaths. The pauses are part of the shape too.' },
            ]}
            note="Breathe as long as you like. One full breath — in and out — is enough to draw its shape."
            cta="Begin →"
            onStart={begin}
          />
        )}

        {screen === 'BREATHING' && (
          <>
            <div ref={outerRef} style={S.outerScale}>
              <ContactAvatar
                getPhase={getPhase}
                isFirstContact={false}
                controlRef={avatarControlRef}
                size={220}
              />
            </div>

            <div style={{ ...S.stateLine, color: STATE_COLOR[control] }}>
              {STATE_LABEL[control]}
            </div>

            <div style={S.holdRow}>
              <HoldButton kind="in"  label="Inhale" hint="hold I" color={AMBER} active={control === 'in'}  onPress={press} onRelease={release} />
              <HoldButton kind="out" label="Exhale" hint="hold O" color={BLUE}  active={control === 'out'} onPress={press} onRelease={release} />
            </div>

            <p style={S.countLine}>
              {breathCount === 0
                ? 'One full breath — in and out — draws the first shape.'
                : `${breathCount} ${breathCount === 1 ? 'breath' : 'breaths'} recorded.`}
            </p>

            <button
              style={{ ...S.finishBtn, ...(breathCount === 0 ? S.finishDisabled : null) }}
              disabled={breathCount === 0}
              onClick={finishSession}
            >
              Finish
            </button>
          </>
        )}

        {screen === 'RESULTS' && (
          <div style={S.results}>
            <p style={S.eyebrow}>RADlab · Come, See — prototype</p>
            <h1 style={S.h1}>The shape of your breathing.</h1>
            <p style={S.lead}>
              {breaths.length} {breaths.length === 1 ? 'breath' : 'breaths'}. Each outline is one
              breath, drawn from its four durations — inhale up, hold right, exhale down, rest
              left. The filled shape is the session average.
            </p>

            <BreathShapeChart breaths={breaths} />

            <p style={S.meanLine}>
              in {mean.inh.toFixed(1)} s · hold {mean.hold.toFixed(1)} s ·{' '}
              out {mean.exh.toFixed(1)} s · rest {mean.rest.toFixed(1)} s
            </p>

            {breaths.length > 1 && (
              <div style={S.miniRow}>
                {breaths.map((b, i) => (
                  <MiniShape key={i} breath={b} maxDur={maxDur} n={i + 1} />
                ))}
              </div>
            )}

            <PrimaryCTA onClick={begin} style={S.againBtn}>Breathe again</PrimaryCTA>
          </div>
        )}

      </div>
    </div>
  )
}

// ── HoldButton — press-and-hold, mouse/touch/pen via pointer capture ────────
function HoldButton({ kind, label, hint, color, active, onPress, onRelease }) {
  return (
    <button
      style={{
        ...S.hold,
        borderColor: color,
        color: active ? '#fff' : color,
        background: active ? color : `${color}14`,
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        onPress(kind)
      }}
      onPointerUp={() => onRelease(kind)}
      onPointerCancel={() => onRelease(kind)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span style={S.holdLabel}>{label}</span>
      <span style={S.holdHint}>{hint}</span>
    </button>
  )
}

const S = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 24px', minHeight: '100vh', justifyContent: 'center', gap: 18,
  },

  outerScale: { willChange: 'transform' },

  stateLine: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.12em',
    textTransform: 'uppercase', height: 16, userSelect: 'none',
  },

  holdRow: {
    display: 'flex', gap: 16, width: '100%', maxWidth: 400, marginTop: 6,
  },
  hold: {
    flex: 1, minHeight: 76, borderRadius: 16, borderWidth: 2, borderStyle: 'solid',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 3, cursor: 'pointer', touchAction: 'none',
    userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.12s ease, color 0.12s ease',
  },
  holdLabel: { fontFamily: SERIF, fontSize: 20, pointerEvents: 'none' },
  holdHint:  { fontFamily: MONO, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', opacity: 0.75, pointerEvents: 'none' },

  countLine: {
    fontFamily: SANS, fontSize: 12, color: 'var(--tx2)', margin: 0,
    textAlign: 'center', minHeight: 16,
  },

  finishBtn: {
    padding: '11px 36px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
  },
  finishDisabled: {
    background: 'var(--bgc)', color: 'var(--gy)', boxShadow: 'none', cursor: 'default',
  },

  results: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    maxWidth: 420, textAlign: 'center', padding: '0 16px',
  },
  eyebrow: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--gy)', margin: '0 0 12px',
  },
  h1: {
    fontFamily: SERIF, fontSize: 28, fontWeight: 400,
    color: 'var(--tx)', margin: '0 0 8px', lineHeight: 1.2,
  },
  lead: {
    fontFamily: SANS, fontSize: 14, lineHeight: 1.6,
    color: 'var(--tx2)', margin: '0 0 12px',
  },
  meanLine: {
    fontFamily: MONO, fontSize: 12, color: 'var(--tx)', margin: '4px 0 12px',
  },
  miniRow: {
    display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
    gap: 10, margin: '0 0 20px',
  },
  againBtn: { minWidth: 220, fontSize: 14, padding: '13px 16px' },
}
