import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from '../../components/Nav'
import GameIntro from '../shared/GameIntro'
import { KiteIcon } from '../shared/GameIcon'
import PrimaryCTA from '../../components/ui/PrimaryCTA'
import SyncAura from '../../components/SyncAura'
import ContactAvatar from '../FirstContact/components/ContactAvatar'
import BreathShapeChart, { MiniShape, EmptyStamp } from './BreathShapeChart'
import { parseBreaths, meanBreath, maxDuration, MIN_HOLD_MS } from './breathShapes'
import { createBreathAudio } from './breathAudio'

// ── Kite ────────────────────────────────────────────────────────────────────
// Come, See — free breathing, no pacer; named for the four-vertex breath
// shape, a kite flown on the player's own wind. The player breathes and the
// face breathes with them: hold one control to breathe in, another to breathe
// out, hold nothing and it rests (a faint idle sway — resting, not frozen).
// Every hold and release is logged as a phase segment; each completed breath
// stamps its four-duration shape into a row of eight waiting slots. At the
// eighth breath a gold aura blooms around the face — the session's quiet
// gift — and the session finishes itself: after a short rest automatically,
// or the moment a ninth hold is released. The ninth breath is never graphed
// (finishSession slices to TARGET_BREATHS); the button is only an early exit.
// Breath-noise audio follows airflow (breathAudio.js).
//
// Screens: INTRO → BREATHING → RESULTS. On the catalog at /games/kite
// (auth'd like the rest); still writes nothing — session persistence is the
// next tier and goes to main with its schema when it comes.
//
// The face is First Contact's ContactAvatar, unmodified. It expects a paced
// 0–1 cycle phase and maps it through a sine to "breath fullness"; here the
// fullness is the primary signal, so getPhase inverts that sine. The avatar's
// own scale amplitude is a subtle 15%, tuned for paced sync — an outer wrapper
// adds more growth so key-driven breathing reads unmistakably.

const AMBER = '#BA7517'   // inhale — matches First Contact's prompt colors
const BLUE  = '#185FA5'   // exhale
const GOLD  = '#ffb300'   // the eighth-breath aura (AURA_COLORS gold)
const MONO  = '"Space Mono", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const TAU_IN      = 1.6   // s — fullness time constant while inhaling
const TAU_OUT     = 2.2   // s — while exhaling (empties a touch slower)
const OUTER_SCALE = 0.22  // extra growth on top of the avatar's built-in 15%
const SWAY_AMP    = 0.005 // idle sway: peak scale deviation while resting
const SWAY_PERIOD = 4.5   // s

const STATE_LABEL = { in: 'breathing in', out: 'breathing out', pause: 'still' }
const STATE_COLOR = { in: AMBER, out: BLUE, pause: 'var(--gy)' }

const TARGET_BREATHS = 8
// Eighth breath → aura blooms (4 × 800 ms), a beat to take it in, then the
// session ends itself.
const AUTO_FINISH_MS = 4500
const HINT_MS = 3500
const HINT_COPY = {
  in:  'Remember, hold down the button for the whole inhalation.',
  out: 'Remember, hold down the button for the whole exhalation.',
}
// First-breath guidance, shown only until each act has happened for real
// (a sub-MIN_HOLD_MS tap does not advance it), and hidden while the player is
// doing the thing it asks for.
const GUIDE_COPY = {
  in:  'Hold, and breathe in.',
  out: 'And now — breathe out.',
}

const COARSE_INPUT = typeof window !== 'undefined' &&
  !!window.matchMedia?.('(pointer: coarse)')?.matches

export default function Kite({ session }) {
  const [screen, setScreen]           = useState('INTRO')
  const [control, setControlState]    = useState('pause')
  const [liveBreaths, setLiveBreaths] = useState([])
  const [breaths, setBreaths]         = useState([])
  const [hint, setHint]               = useState(null)   // 'in' | 'out' | null
  const [guide, setGuide]             = useState('in')   // 'in' | 'out' | null
  const [giftStep, setGiftStep]       = useState(0)      // 0 off … 4 full aura

  const fullnessRef = useRef(0)        // 0 empty … 1 full
  const controlRef  = useRef('pause')
  const heldRef     = useRef([])       // pressed-and-still-held, in press order
  const segsRef     = useRef([])       // closed segments {phase, t0, t1}
  const openSegRef  = useRef(null)     // {phase, t0}
  const startedRef  = useRef(false)    // recording begins at the first inhale
  const guideRef    = useRef('in')

  const avatarControlRef = useRef(null)
  const outerRef         = useRef(null)
  const pressAtRef       = useRef({})    // kind → performance.now() at press
  const hintTimerRef     = useRef(null)
  const audioRef         = useRef(null)
  const finishRef        = useRef(null)  // latest finishSession, for timers
  const breathCountRef   = useRef(0)     // mirrors liveBreaths.length for handlers
  const ninthHoldRef     = useRef(false) // a hold begun after the eighth breath

  // ── Control changes → segment log ─────────────────────────────────────
  const applyControl = useCallback((next) => {
    if (next === controlRef.current) return
    const t = performance.now()
    controlRef.current = next
    setControlState(next)

    let closed = null
    if (!startedRef.current) {
      // Nothing recorded until the first inhale — an exhale or pause with
      // empty lungs is animation, not data.
      if (next !== 'in') return
      startedRef.current = true
      openSegRef.current = { phase: 'in', t0: t }
    } else {
      closed = { ...openSegRef.current, t1: t }
      segsRef.current.push(closed)
      openSegRef.current = { phase: next, t0: t }
    }

    // Guidance advances only on real holds, so a tap can't skip a step.
    if (guideRef.current !== 'done' && closed && closed.t1 - closed.t0 >= MIN_HOLD_MS) {
      if (closed.phase === 'in' && guideRef.current === 'in') {
        guideRef.current = 'out'
        setGuide('out')
      } else if (closed.phase === 'out' && guideRef.current === 'out') {
        guideRef.current = 'done'
        setGuide(null)
      }
    }

    const all = [...segsRef.current, { ...openSegRef.current, t1: t }]
    const parsed = parseBreaths(all)
    breathCountRef.current = parsed.length
    setLiveBreaths(parsed)
  }, [])

  const press = useCallback((kind) => {
    if (breathCountRef.current >= TARGET_BREATHS) ninthHoldRef.current = true
    pressAtRef.current[kind] = performance.now()
    heldRef.current = [...heldRef.current.filter(k => k !== kind), kind]
    applyControl(kind)
  }, [applyControl])

  // A release under MIN_HOLD_MS is the same tap the parser discards — coach
  // it; a full hold clears any standing reminder (they've got it).
  const release = useCallback((kind) => {
    heldRef.current = heldRef.current.filter(k => k !== kind)
    const held = heldRef.current
    applyControl(held.length ? held[held.length - 1] : 'pause')

    // A breath begun after the eighth ends the session at its first let-go;
    // the ninth breath is never recorded (finishSession caps the graph).
    if (ninthHoldRef.current) {
      finishRef.current?.()
      return
    }

    const heldFor = performance.now() - (pressAtRef.current[kind] ?? 0)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    if (heldFor < MIN_HOLD_MS) {
      setHint(kind)
      hintTimerRef.current = setTimeout(() => setHint(null), HINT_MS)
    } else {
      setHint(null)
    }
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

  // ── Fullness integration, idle sway, outer scale, audio ───────────────
  useEffect(() => {
    if (screen !== 'BREATHING') return
    avatarControlRef.current?.resumeAnimation()
    let last = performance.now()
    let swayW = 0            // 0 breathing … 1 resting, eased so sway fades in
    let raf = null
    function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const c = controlRef.current
      const f0 = fullnessRef.current
      let f = f0
      if (c === 'in')  f += (1 - f) * (dt / TAU_IN)
      if (c === 'out') f += (0 - f) * (dt / TAU_OUT)
      fullnessRef.current = f

      audioRef.current?.update(c, dt > 0 ? Math.abs(f - f0) / dt : 0)

      swayW += ((c === 'pause' ? 1 : 0) - swayW) * Math.min(1, dt / 0.6)
      const ph   = (now / 1000) * (2 * Math.PI / SWAY_PERIOD)
      const sway = swayW * SWAY_AMP * Math.sin(ph)
      const dy   = swayW * 1.2 * Math.sin(ph + Math.PI / 3)
      if (outerRef.current) {
        outerRef.current.style.transform =
          `translateY(${dy.toFixed(2)}px) scale(${(1 + OUTER_SCALE * f + sway).toFixed(4)})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [screen])

  // ── Eighth breath → the aura blooms, then the session finishes itself ─
  // Keyed on the reached-target *boolean*, not the breath list — liveBreaths
  // is a fresh array on every control change, which would tear down the bloom
  // interval and the auto-finish timer mid-flight.
  const reachedTarget = screen === 'BREATHING' && liveBreaths.length >= TARGET_BREATHS
  useEffect(() => {
    if (!reachedTarget) return
    const iv = setInterval(() => setGiftStep(s => (s >= 4 ? s : s + 1)), 800)
    // If a ninth hold is in progress when the timer lands, defer to its
    // release, which ends the session itself.
    const done = setTimeout(() => {
      if (heldRef.current.length === 0) finishRef.current?.()
    }, AUTO_FINISH_MS)
    return () => { clearInterval(iv); clearTimeout(done) }
  }, [reachedTarget])

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
    guideRef.current   = 'in'
    breathCountRef.current = 0
    ninthHoldRef.current   = false
    setControlState('pause')
    setLiveBreaths([])
    setBreaths([])
    setGuide('in')
    setGiftStep(0)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHint(null)
    if (!audioRef.current) audioRef.current = createBreathAudio()
    audioRef.current.start()
    setScreen('BREATHING')
  }

  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    audioRef.current?.dispose()
  }, [])

  function finishSession() {
    const t = performance.now()
    const all = openSegRef.current
      ? [...segsRef.current, { ...openSegRef.current, t1: t }]
      : segsRef.current
    const parsed = parseBreaths(all).slice(0, TARGET_BREATHS)
    if (parsed.length === 0) return
    heldRef.current = []
    audioRef.current?.stop()
    setBreaths(parsed)
    setScreen('RESULTS')
  }
  finishRef.current = finishSession

  // ── Render ────────────────────────────────────────────────────────────
  const mean   = meanBreath(breaths)
  const maxDur = maxDuration(breaths)

  const breathCount = Math.min(liveBreaths.length, TARGET_BREATHS)
  const liveMax     = maxDuration(liveBreaths)

  // One line under the face: coaching first, then first-breath guidance —
  // hidden while the player is already doing what it asks.
  const lineKind = hint ?? (guide && guide !== control ? guide : null)
  const lineText = hint ? HINT_COPY[hint] : lineKind ? GUIDE_COPY[lineKind] : ' '

  const auraParams = giftStep > 0 ? { inset: giftStep, opacity: 0.1 * giftStep } : null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>

        {screen === 'INTRO' && (
          <GameIntro
            title="Kite."
            lead="No pacer this time. Breathe, and it breathes with you — you set the length of every in, every out, and every pause."
            visual={
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 20px' }}>
                <KiteIcon size={64} />
              </div>
            }
            steps={[
              { title: 'Breathe in',  body: COARSE_INPUT
                  ? 'Hold the amber button for as long as your inhale lasts. The face fills.'
                  : 'Hold I (or the amber button) for as long as your inhale lasts. The face fills.' },
              { title: 'Breathe out', body: COARSE_INPUT
                  ? 'Hold the blue button for as long as your exhale lasts. The face empties.'
                  : 'Hold O (or the blue button) for as long as your exhale lasts. The face empties.' },
              { title: 'Rest',        body: 'Hold nothing between breaths. The pauses are part of the shape too.' },
            ]}
            note="Take eight breaths, at your own pace. Every one is drawn as a shape at the end. Sound on, if you can."
            cta="Begin →"
            onStart={begin}
          />
        )}

        {screen === 'BREATHING' && (
          <>
            <div ref={outerRef} style={S.outerScale}>
              <SyncAura params={auraParams} color={GOLD} size={220}>
                <ContactAvatar
                  getPhase={getPhase}
                  isFirstContact={false}
                  controlRef={avatarControlRef}
                  size={220}
                />
              </SyncAura>
            </div>

            <div style={{ ...S.stateLine, color: STATE_COLOR[control] }}>
              {STATE_LABEL[control]}
            </div>

            <p style={{ ...S.hintLine, color: lineKind ? STATE_COLOR[lineKind] : 'transparent', opacity: lineKind ? 1 : 0 }}>
              {lineText}
            </p>

            <div style={S.holdRow}>
              <HoldButton kind="in"  label="Inhale" hint={COARSE_INPUT ? null : 'hold I'} color={AMBER} active={control === 'in'}  onPress={press} onRelease={release} />
              <HoldButton kind="out" label="Exhale" hint={COARSE_INPUT ? null : 'hold O'} color={BLUE}  active={control === 'out'} onPress={press} onRelease={release} />
            </div>

            {/* Eight waiting slots; each completed breath stamps its shape in. */}
            <div style={S.stampRow}>
              {Array.from({ length: TARGET_BREATHS }, (_, i) => liveBreaths[i]
                ? <MiniShape key={i} breath={liveBreaths[i]} maxDur={liveMax} size={40} />
                : <EmptyStamp key={i} size={40} />)}
            </div>

            <span style={S.countNum}>{breathCount} of {TARGET_BREATHS}</span>

            <button
              style={{ ...S.finishBtn, ...(breathCount === 0 ? S.finishDisabled : null) }}
              disabled={breathCount === 0}
              onClick={finishSession}
            >
              Finish early
            </button>
          </>
        )}

        {screen === 'RESULTS' && (
          <div style={S.results}>
            <p style={S.eyebrow}>RADlab · Come, See</p>
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
      {hint && <span style={S.holdHint}>{hint}</span>}
    </button>
  )
}

const S = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 24px', minHeight: 'calc(100vh - 60px)', justifyContent: 'center', gap: 18,
  },

  outerScale: { willChange: 'transform' },

  stateLine: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.12em',
    textTransform: 'uppercase', height: 16, userSelect: 'none',
  },

  hintLine: {
    fontFamily: SANS, fontSize: 13, textAlign: 'center', margin: 0,
    minHeight: 18, maxWidth: 360, transition: 'opacity 0.25s ease',
    userSelect: 'none',
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

  stampRow: {
    display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
    gap: 6, marginTop: 4, maxWidth: 400,
  },
  countNum: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.10em',
    color: 'var(--gy)', userSelect: 'none',
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
