/**
 * OwlBarn â€” Sensory Safari Exhibit 2
 * RADlab Â· Regulatory & Affective Dynamics Lab Â· U of T
 *
 * Red-light / green-light tap-to-move across a dark barn while owls hoot.
 *   3-tap (window expiry at count 3)  â†’ 1 step forward
 *   8-tap (immediate on 8th tap)      â†’ 2 steps forward
 *   tap during HOOT                   â†’ SWOOPED (âˆ’2 steps, lockout next hoot)
 *   window expiry at count 1,2,4â€“7   â†’ WRONG_COUNT (no penalty, lockout next hoot)
 *
 * Timing: triangle-wave from RiskFlex canonical algorithm
 *   windownum bounces 10â†’1â†’10 (one step per trial)
 *   step = round((riskyWindow + 300 âˆ’ safeWindow) / 9)
 *   currentWindow = safeWindow + (windownum âˆ’ 1) Ã— step
 *
 * Calibration: stubbed (safeWindow=500ms, riskyWindow=1800ms)
 * Mindfulness:  stubbed (Continue button only)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useOwlAudio } from './useOwlAudio'

// â”€â”€â”€ WORLD LAYOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BARN_WIDTH = 1250
const OFFSET = 0.15   // mouse sits at 15% from left of viewport

const objects = [
  { id: 0,  name: 'Back wall',      x: 22,   type: 'start',     w: 0,   h: 0   },
  { id: 1,  name: 'Hay bunch',      x: 101,  type: 'hay_small', w: 48,  h: 26  },
  { id: 2,  name: 'Worn boot',      x: 211,  type: 'boot',      w: 43,  h: 35  },
  { id: 3,  name: 'Wooden bucket',  x: 321,  type: 'bucket',    w: 39,  h: 41  },
  { id: 4,  name: 'Coil of rope',   x: 431,  type: 'rope',      w: 48,  h: 28  },
  { id: 5,  name: 'Hay bale',       x: 541,  type: 'hay_large', w: 72,  h: 47  },
  { id: 6,  name: 'Clay pot',       x: 651,  type: 'pot',       w: 36,  h: 40  },
  { id: 7,  name: 'Rusted lantern', x: 761,  type: 'lantern',   w: 30,  h: 48  },
  { id: 8,  name: 'Wooden crate',   x: 871,  type: 'crate',     w: 60,  h: 53  },
  { id: 9,  name: 'Burlap sacking', x: 981,  type: 'burlap',    w: 66,  h: 35  },
  { id: 10, name: 'Barn door',      x: 1091, type: 'door',      w: 84,  h: 120 },
]

const owlPairs = [
  { x: 166, y: 46 }, { x: 295, y: 30 }, { x: 424, y: 54 },
  { x: 561, y: 36 }, { x: 709, y: 48 }, { x: 876, y: 34 },
  { x: 999, y: 50 }, { x: 1110, y: 42 },
]

const beams = [137, 280, 425, 568, 712, 856, 1000, 1115]

// â”€â”€â”€ PHASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PHASE = {
  IDLE:         'idle',
  SHRINK:       'shrink',
  CALIBRATION:  'calibration',
  HOOT:         'hoot',
  SILENCE:      'silence',
  MOVING:       'moving',
  WRONG_COUNT:  'wrong_count',
  SWOOPED:      'swooped',
  BARN_CROSSED: 'barn_crossed',
  MINDFULNESS:  'mindfulness',
  RESULTS:      'results',
}

// â”€â”€â”€ CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CFG = {
  // Calibration stubs â€” will be replaced by measured 3-tap / 8-tap speeds
  SAFE_WINDOW_STUB:  500,   // ms â€” default safeWindow (3-tap speed)
  RISKY_WINDOW_STUB: 1800,  // ms â€” default riskyWindow (8-tap speed)
  HOOT_MIN_MS:  3000,
  HOOT_MAX_MS:  5000,
  MOVE_ANIM_MS: 420,
  SWOOP_ANIM_MS: 880,
  WRONG_ANIM_MS: 680,
  SHRINK_MS:    2600,
}

// â”€â”€â”€ BARN OBJECTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ObjShape({ type, isCurrent }) {
  const glow = isCurrent
    ? 'drop-shadow(0 0 10px rgba(245,200,66,0.65)) drop-shadow(0 0 3px rgba(245,200,66,0.5))'
    : 'none'
  const s = { filter: glow, position: 'relative' }

  if (type === 'hay_small')
    return (
      <div style={{ ...s, width: 48, height: 26, background: 'linear-gradient(160deg,#7a5a1a,#5a3e0e)', borderRadius: '3px 3px 0 0' }}>
        {[5,14,23,32,40].map((x,i) => (
          <div key={i} style={{ position:'absolute', left:x, top:2+i%2*4, width:2, height:20, background:'rgba(200,160,60,0.45)', transform:'rotate(4deg)' }} />
        ))}
      </div>
    )

  if (type === 'boot')
    return (
      <div style={{ ...s, width: 43, height: 35 }}>
        <div style={{ position:'absolute', bottom:0, left:2, width:38, height:11, background:'#241a0c', borderRadius:'0 0 8px 5px' }} />
        <div style={{ position:'absolute', bottom:9, left:2, width:19, height:24, background:'#1e160a', borderRadius:'3px 3px 0 0' }} />
        <div style={{ position:'absolute', bottom:17, left:21, width:14, height:5, background:'#2a1e10', borderRadius:'0 3px 3px 0' }} />
      </div>
    )

  if (type === 'bucket')
    return (
      <div style={{ ...s, width: 39, height: 41 }}>
        <div style={{ position:'absolute', bottom:0, left:0, width:35, height:34, background:'linear-gradient(160deg,#3e2a14,#261a08)', borderRadius:'0 0 6px 6px', transform:'rotate(-5deg)' }} />
        <div style={{ position:'absolute', top:5, left:-1, width:38, height:5, background:'#1c1208', borderRadius:2 }} />
      </div>
    )

  if (type === 'rope')
    return (
      <div style={{ ...s, width: 48, height: 28 }}>
        <div style={{ width:44, height:24, borderRadius:'50%', border:'8px solid #4a3218', boxSizing:'border-box' }} />
        <div style={{ position:'absolute', top:9, left:37, width:12, height:4, background:'#3a2810', borderRadius:2, transform:'rotate(-20deg)' }} />
      </div>
    )

  if (type === 'hay_large')
    return (
      <div style={{ ...s, width: 72, height: 47, background: 'linear-gradient(160deg,#8a6820,#6a4e14)', borderRadius: 3 }}>
        {[5,14,23,32,41,52,62].map((x,i) => (
          <div key={i} style={{ position:'absolute', left:x, top:2+i%2*6, width:2, height:40, background:'rgba(200,160,60,0.38)' }} />
        ))}
      </div>
    )

  if (type === 'pot')
    return (
      <div style={{ ...s, width: 36, height: 40 }}>
        <div style={{ position:'absolute', bottom:0, left:2, width:32, height:37, background:'linear-gradient(160deg,#5a4030,#3a2820)', borderRadius:'36% 36% 16% 16%', transform:'rotate(-7deg)' }} />
        <div style={{ position:'absolute', top:7, left:1, width:32, height:2, background:'rgba(100,70,50,0.7)', transform:'rotate(-7deg)' }} />
      </div>
    )

  if (type === 'lantern')
    return (
      <div style={{ ...s, width: 30, height: 48 }}>
        <div style={{ position:'absolute', top:0, left:12, width:6, height:9, background:'#1a1408' }} />
        <div style={{ position:'absolute', top:7, left:6, width:18, height:5, background:'#1e1a10', borderRadius:'2px 2px 0 0' }} />
        <div style={{ position:'absolute', top:11, left:5, width:20, height:31, background:'#221a0e', border:'2px solid #1a1208', borderRadius:'1px 1px 3px 3px' }} />
        <div style={{ position:'absolute', top:14, left:8, width:14, height:22, background:'rgba(20,14,6,0.85)', borderRadius:2 }} />
        {[17,24,31].map((y,i) => (
          <div key={i} style={{ position:'absolute', top:y, left:5, width:20, height:1, background:'rgba(10,8,4,0.7)' }} />
        ))}
      </div>
    )

  if (type === 'crate')
    return (
      <div style={{ ...s, width: 60, height: 53 }}>
        <div style={{ position:'absolute', bottom:0, left:0, width:55, height:50, background:'linear-gradient(135deg,#3a2810,#261a08)', border:'1px solid #1c1208' }}>
          {[13,28,42].map((x,i) => (
            <div key={i} style={{ position:'absolute', left:x, top:0, width:2, height:'100%', background:'rgba(10,6,2,0.55)' }} />
          ))}
          {[14,28].map((y,i) => (
            <div key={i} style={{ position:'absolute', left:0, top:y, width:'100%', height:2, background:'rgba(10,6,2,0.55)' }} />
          ))}
        </div>
        <div style={{ position:'absolute', bottom:48, left:-4, width:46, height:7, background:'#2e2008', transform:'rotate(-8deg)', transformOrigin:'right center' }} />
      </div>
    )

  if (type === 'burlap')
    return (
      <div style={{ ...s, width: 66, height: 35, background:'linear-gradient(160deg,#4a3820,#342810)', borderRadius:'20px 20px 7px 7px' }}>
        {[11,22,34,46].map((x,i) => (
          <div key={i} style={{ position:'absolute', top:5, left:x, width:1, height:25, background:'rgba(80,58,28,0.45)' }} />
        ))}
        <div style={{ position:'absolute', top:4, left:'50%', transform:'translateX(-50%)', width:18, height:4, background:'#3a2a18', borderRadius:2 }} />
      </div>
    )

  if (type === 'door')
    return (
      <div style={{ ...s, width: 84, height: 120 }}>
        <div style={{ position:'absolute', bottom:0, left:0, width:78, height:120, background:'linear-gradient(to right,#1a1008,#0d0905 40%,#0a0704)', border:'2px solid #241a0a' }}>
          {[0,14,28,42,56,70,84,98,112].map((y,i) => (
            <div key={i} style={{ position:'absolute', left:0, top:y, width:'100%', height:1, background:'rgba(36,26,10,0.7)' }} />
          ))}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,transparent 20%,rgba(100,140,180,0.07) 60%,transparent)' }} />
          <div style={{ position:'absolute', top:'40%', right:13, width:5, height:5, borderRadius:'50%', background:'#3a3020' }} />
        </div>
      </div>
    )

  return null
}

// â”€â”€â”€ TAP AURA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TapAura({ level }) {
  if (level === 0) return null
  const green3 = level === 3
  const green8 = level === 8
  const isGreen = green3 || green8
  const sizes   = [0, 22, 30, 46, 22, 28, 33, 40, 58]
  const size    = sizes[Math.min(level, 8)]
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: '50%',
      transform: 'translate(-50%, 50%)',
      width: size, height: size, borderRadius: '50%',
      background: isGreen
        ? (green8 ? 'rgba(168,255,135,0.45)' : 'rgba(127,212,106,0.45)')
        : 'rgba(245,200,66,0.35)',
      boxShadow: isGreen
        ? (green8
            ? '0 0 22px 10px rgba(168,255,135,0.55),0 0 6px 2px rgba(168,255,135,0.8)'
            : '0 0 16px 6px rgba(127,212,106,0.5),0 0 4px 2px rgba(127,212,106,0.7)')
        : '0 0 10px 4px rgba(245,200,66,0.4)',
      transition: 'width 0.07s ease,height 0.07s ease',
      pointerEvents: 'none', zIndex: 5,
    }} />
  )
}

// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function OwlBarn({ onSessionComplete, userId = null, studyId = null }) {

  const audio = useOwlAudio()

  // â”€â”€ UI state â”€â”€
  const [phase,       setPhase]       = useState(PHASE.IDLE)
  const [step,        setStep]        = useState(0)
  const [auraLevel,   setAuraLevel]   = useState(0)
  const [swoopActive, setSwoopActive] = useState(false)
  const [shaking,     setShaking]     = useState(false)
  const [vw,          setVw]          = useState(390)
  const [results,     setResults]     = useState(null)

  const viewRef = useRef(null)

  // â”€â”€ Game refs â”€â”€
  const phaseRef         = useRef(PHASE.IDLE)
  const stepRef          = useRef(0)
  const tapCountRef      = useRef(0)
  const silenceOnsetRef  = useRef(null)
  const responseOnsetRef = useRef(null)
  const isLockedRef      = useRef(false)
  // Triangle-wave timing
  const safeWindowRef    = useRef(CFG.SAFE_WINDOW_STUB)   // 3-tap speed (ms)
  const riskyWindowRef   = useRef(CFG.RISKY_WINDOW_STUB)  // 8-tap speed (ms)
  const stepMsRef        = useRef(178)                    // duration step per trial
  const winnumRef        = useRef(10)                     // current position (1â€“10)
  const winnumDirRef     = useRef(-1)                     // âˆ’1 = decreasing, +1 = increasing
  // Session data
  const trialsRef        = useRef([])
  const gameStartRef     = useRef(null)
  const gameEndRef       = useRef(null)
  const timersRef        = useRef([])

  useEffect(() => { phaseRef.current = phase }, [phase])

  // â”€â”€ Viewport resize â”€â”€
  useEffect(() => {
    const update = () => viewRef.current && setVw(viewRef.current.offsetWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // â”€â”€ Timer helpers â”€â”€
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const after = useCallback((ms, fn) => {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  // â”€â”€ Timing helpers â”€â”€
  // currentWindow = safeWindow + (windownum âˆ’ 1) Ã— step
  const curWindowMs = () =>
    safeWindowRef.current + (winnumRef.current - 1) * stepMsRef.current

  // "Long" window: top half of triangle (windownum â‰¥ 6) â†’ 8-tap is optimal
  const curIsLong = () => winnumRef.current >= 6

  // â”€â”€ Trial recording helper â”€â”€
  function recordTrial(playerChoice, outcome, stepsGained) {
    const dur   = curWindowMs()
    const wtype = curIsLong() ? 'long' : 'short'
    trialsRef.current.push({
      windownum:       winnumRef.current,
      windowDurationMs: dur,
      windowType:      wtype,
      playerChoice,
      optimalChoice:   wtype === 'long' ? '8tap' : '3tap',
      outcome,
      stepsBefore:     stepRef.current,
      stepsAfter:      Math.min(10, stepRef.current + stepsGained),
      responseOnsetMs: responseOnsetRef.current,
    })
  }

  // â”€â”€â”€ GAME FLOW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Defined innermost-first: each function can safely forward-reference later
  // ones because all calls happen asynchronously (via timers), never inline.

  // 1. advanceToNextWindow â€” advance triangle wave and start next hoot
  const advanceToNextWindow = useCallback((lockNext) => {
    winnumRef.current += winnumDirRef.current
    if      (winnumRef.current <= 1)  { winnumRef.current = 1;  winnumDirRef.current =  1 }
    else if (winnumRef.current >= 10) { winnumRef.current = 10; winnumDirRef.current = -1 }
    isLockedRef.current = lockNext
    startHoot() // eslint-disable-line no-use-before-define
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. triggerWrongCount
  const triggerWrongCount = useCallback(() => {
    tapCountRef.current = 0
    setAuraLevel(0)
    phaseRef.current = PHASE.WRONG_COUNT
    setPhase(PHASE.WRONG_COUNT)
    after(CFG.WRONG_ANIM_MS, () => advanceToNextWindow(true))
  }, [after, advanceToNextWindow])

  // 3. doAdvanceStep
  const doAdvanceStep = useCallback((steps) => {
    const newStep = Math.min(10, stepRef.current + steps)
    stepRef.current = newStep
    setStep(newStep)
    tapCountRef.current = 0
    setAuraLevel(0)
    phaseRef.current = PHASE.MOVING
    setPhase(PHASE.MOVING)
    after(CFG.MOVE_ANIM_MS, () => {
      if (newStep >= 10) {
        gameEndRef.current = performance.now()
        audio.playBarnCrossed()
        phaseRef.current = PHASE.BARN_CROSSED
        setPhase(PHASE.BARN_CROSSED)
        after(1800, () => {
          phaseRef.current = PHASE.MINDFULNESS
          setPhase(PHASE.MINDFULNESS)
        })
      } else {
        advanceToNextWindow(false)
      }
    })
  }, [after, advanceToNextWindow, audio])

  // 4. onSilenceExpire
  const onSilenceExpire = useCallback(() => {
    if (phaseRef.current !== PHASE.SILENCE) return
    const count = tapCountRef.current
    if (count === 0) {
      recordTrial('no_input', 'no_input', 0)
      advanceToNextWindow(false)
    } else if (count === 3) {
      recordTrial('3tap', 'success', 1)
      doAdvanceStep(1)
    } else {
      recordTrial(`${count}tap`, 'wrong_count', 0)
      triggerWrongCount()
    }
  }, [advanceToNextWindow, doAdvanceStep, triggerWrongCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // 5. startSilence
  const startSilence = useCallback(() => {
    audio.stopHoot()   // fade hoot out â†’ creates the silence moment
    const dur = curWindowMs()
    phaseRef.current = PHASE.SILENCE
    setPhase(PHASE.SILENCE)
    tapCountRef.current = 0
    setAuraLevel(0)
    responseOnsetRef.current = null
    silenceOnsetRef.current  = performance.now()
    after(dur, () => onSilenceExpire())
  }, [after, onSilenceExpire, audio]) // eslint-disable-line react-hooks/exhaustive-deps

  // 6. startHoot
  const startHoot = useCallback(() => {
    phaseRef.current = PHASE.HOOT
    setPhase(PHASE.HOOT)
    const dur = CFG.HOOT_MIN_MS + Math.random() * (CFG.HOOT_MAX_MS - CFG.HOOT_MIN_MS)
    audio.startHoot()
    after(dur, () => {
      isLockedRef.current = false   // lockout clears when hoot ends
      startSilence()
    })
  }, [after, startSilence, audio])

  // 7. triggerSwoop â€” tap during hoot: âˆ’2 steps + lockout
  const triggerSwoop = useCallback(() => {
    clearTimers()
    audio.playSwoop()
    const oldStep = stepRef.current
    const newStep = Math.max(0, oldStep - 2)
    // Record before modifying stepRef
    trialsRef.current.push({
      windownum:        winnumRef.current,
      windowDurationMs: curWindowMs(),
      windowType:       curIsLong() ? 'long' : 'short',
      playerChoice:     'swoop_hoot',
      optimalChoice:    curIsLong() ? '8tap' : '3tap',
      outcome:          'swooped',
      stepsBefore:      oldStep,
      stepsAfter:       newStep,
      responseOnsetMs:  responseOnsetRef.current,
    })
    stepRef.current = newStep
    setStep(newStep)
    tapCountRef.current = 0
    setAuraLevel(0)
    phaseRef.current = PHASE.SWOOPED
    setPhase(PHASE.SWOOPED)
    setSwoopActive(true)
    setShaking(true)
    after(300, () => setShaking(false))
    after(CFG.SWOOP_ANIM_MS, () => {
      setSwoopActive(false)
      advanceToNextWindow(true)
    })
  }, [after, clearTimers, advanceToNextWindow, audio]) // eslint-disable-line react-hooks/exhaustive-deps

  // 8. handleTap â€” spacebar / screen tap
  // Uses phaseRef (not state) â€” no stale-closure risk for hoot detection
  const handleTap = useCallback(() => {
    const ph = phaseRef.current
    if (ph === PHASE.HOOT) {
      if (!isLockedRef.current) triggerSwoop()
      return
    }
    if (ph !== PHASE.SILENCE) return

    tapCountRef.current += 1
    const count = tapCountRef.current
    if (count === 1) {
      responseOnsetRef.current = Math.round(
        performance.now() - (silenceOnsetRef.current ?? performance.now())
      )
    }
    audio.playTap(count)
    setAuraLevel(count)

    if (count === 8) {
      clearTimers()
      recordTrial('8tap', 'success', 2)
      doAdvanceStep(2)
    }
    // counts 1â€“7: update aura; window timer resolves
  }, [triggerSwoop, clearTimers, doAdvanceStep, audio]) // eslint-disable-line react-hooks/exhaustive-deps

  // 9. startGame
  const startGame = useCallback(() => {
    trialsRef.current  = []
    stepRef.current    = 0;  setStep(0)
    tapCountRef.current = 0; setAuraLevel(0)
    isLockedRef.current = false
    safeWindowRef.current  = CFG.SAFE_WINDOW_STUB
    riskyWindowRef.current = CFG.RISKY_WINDOW_STUB
    // step = round((riskyWindow + 300 âˆ’ safeWindow) / 9) â€” headroom baked into formula
    stepMsRef.current = Math.round(
      (CFG.RISKY_WINDOW_STUB + 300 - CFG.SAFE_WINDOW_STUB) / 9
    )
    winnumRef.current    = 10   // start at longest window
    winnumDirRef.current = -1   // decrease first: 10â†’9â†’â€¦â†’1
    gameStartRef.current = performance.now()
    gameEndRef.current   = null
    setSwoopActive(false); setShaking(false)
    startHoot()
  }, [startHoot])

  // 10. enterShrink
  const enterShrink = useCallback(() => {
    phaseRef.current = PHASE.SHRINK
    setPhase(PHASE.SHRINK)
    after(CFG.SHRINK_MS, () => {
      phaseRef.current = PHASE.CALIBRATION
      setPhase(PHASE.CALIBRATION)
    })
  }, [after])

  // 11. onMindfulnessContinue
  const onMindfulnessContinue = useCallback(() => {
    const crossingTimeMs = (gameEndRef.current && gameStartRef.current)
      ? Math.round(gameEndRef.current - gameStartRef.current)
      : null
    const data = {
      gameName: 'owl_barn', userId, studyId, crossingTimeMs,
      safeWindowMs:  safeWindowRef.current,
      riskyWindowMs: riskyWindowRef.current,
      stepMs:        stepMsRef.current,
      swoopCount:    trialsRef.current.filter(t => t.outcome === 'swooped').length,
      trials:        trialsRef.current,
    }
    setResults(data)
    phaseRef.current = PHASE.RESULTS
    setPhase(PHASE.RESULTS)
    if (onSessionComplete) onSessionComplete(data)
  }, [onSessionComplete, userId, studyId])

  // 12. resetToIdle
  const resetToIdle = useCallback(() => {
    clearTimers()
    phaseRef.current = PHASE.IDLE; setPhase(PHASE.IDLE)
    stepRef.current  = 0;          setStep(0)
    setAuraLevel(0); setSwoopActive(false); setShaking(false); setResults(null)
  }, [clearTimers])

  // â”€â”€ Keyboard listener â”€â”€
  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Space') { e.preventDefault(); handleTap() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleTap])

  // â”€â”€â”€ DERIVED RENDER VALUES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const curObj  = objects[step] ?? objects[0]
  const mouseX  = step === 0 ? curObj.x + 20 : curObj.x + Math.round(curObj.w * 0.4)
  const camX    = Math.max(0, Math.min(BARN_WIDTH - vw, mouseX - vw * OFFSET))
  const isMoving = phase === PHASE.MOVING
  const isHoot   = phase === PHASE.HOOT

  const avatarTransform =
    phase === PHASE.SWOOPED     ? 'rotate(160deg) scale(0.85)'    :
    phase === PHASE.WRONG_COUNT ? 'scaleY(0.88) scaleX(1.06)'     :
    phase === PHASE.MOVING      ? 'scaleX(1.18) scaleY(0.84)'     :
    phase === PHASE.SILENCE && tapCountRef.current > 0
                                ? 'translateX(3px) scaleX(1.08)'  :
    phase === PHASE.SILENCE     ? 'translateY(-2px)'               : 'scaleY(0.82)'

  const inGame = [
    PHASE.HOOT, PHASE.SILENCE, PHASE.MOVING,
    PHASE.WRONG_COUNT, PHASE.SWOOPED, PHASE.BARN_CROSSED,
  ].includes(phase)

  // â”€â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div style={S.shell}>

      {/* â”€â”€ IDLE â”€â”€ */}
      {phase === PHASE.IDLE && (
        <div style={S.screen}>
          <div style={S.card}>
            <p style={S.eyebrow}>Sensory Safari Â· Exhibit 2</p>
            <h2 style={S.titleDark}>The Owl Barn</h2>
            <p style={S.bodyText}>
              You've shrunk to the size of a mouse. The barn is enormous.
              Owls circle the rafters overhead.
            </p>
            <p style={S.bodyText}>
              When the hooting stops, tap fast.{' '}
              <strong>3 taps</strong> = 1 step.{' '}
              <strong>8 taps</strong> = 2 steps.
              Tap during a hoot and you'll get swooped back.
            </p>
            <p style={S.meta}>Spacebar Â· tap anywhere Â· 10 steps to the barn door</p>
            <button style={S.btnPrimary} onClick={enterShrink}>
              Enter the barn
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ SHRINK â”€â”€ */}
      {phase === PHASE.SHRINK && (
        <div style={{ ...S.screen, background: '#060402', minHeight: '100vh', justifyContent: 'center' }}>
          <div style={S.shrinkCard}>
            <div style={S.shrinkEmoji}>ðŸ­</div>
            <p style={S.shrinkLine1}>You are now prey-sized.</p>
            <p style={S.shrinkLine2}>The owls are watching.</p>
            <p style={S.shrinkLine3}>Don't move when they hoot.</p>
          </div>
        </div>
      )}

      {/* â”€â”€ CALIBRATION (stub) â”€â”€ */}
      {phase === PHASE.CALIBRATION && (
        <div style={S.screen}>
          <div style={S.card}>
            <p style={S.eyebrow}>Calibration</p>
            <h2 style={S.titleDark}>Know your timing</h2>
            <div style={S.calBar}>
              <div style={S.calBarFill} />
            </div>
            <div style={S.calBarLabels}>
              <span>500 ms</span>
              <span>1800 ms</span>
            </div>
            <p style={S.bodyText}>
              <strong>Short silence?</strong> Tap exactly 3 times, then stop.
              The step happens when the silence ends.
            </p>
            <p style={S.bodyText}>
              <strong>Long silence?</strong> Tap exactly 8 times for 2 steps â€”
              triggers immediately on the 8th tap.
            </p>
            <p style={S.meta}>Any other count = wrong move</p>
            <button style={S.btnPrimary} onClick={startGame}>
              Begin crossing
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ BARN VIEWPORT (gameplay + BARN_CROSSED) â”€â”€ */}
      {inGame && (
        <div style={S.gameWrap}>

          {/* Progress bar */}
          <div style={S.progressOuter}>
            <div style={{ ...S.progressFill, width: `${(step / 10) * 100}%` }} />
            {objects.slice(1).map(obj => (
              <div key={obj.id} style={{
                position: 'absolute', top: -3,
                left: `${(obj.id / 10) * 100}%`,
                width: 2, height: 8, transform: 'translateX(-50%)',
                background: obj.id <= step ? '#f5c842' : 'rgba(212,184,150,0.2)',
              }} />
            ))}
          </div>

          {/* Phase indicator */}
          <div style={{
            ...S.phaseLabel,
            color: isHoot ? '#c97800' : phase === PHASE.SILENCE ? '#7fd46a' : '#d4b896',
          }}>
            {isHoot                          && 'ðŸ¦‰  HOOT â€” STAY STILL'}
            {phase === PHASE.SILENCE         && 'Â·  SILENCE â€” TAP NOW  Â·'}
            {phase === PHASE.MOVING          && 'â†’'}
            {phase === PHASE.WRONG_COUNT     && 'âœ—  WRONG COUNT'}
            {phase === PHASE.SWOOPED         && 'âš¡  SWOOPED'}
            {phase === PHASE.BARN_CROSSED    && 'âœ“  BARN CROSSED'}
          </div>

          {/* Viewport */}
          <div
            ref={viewRef}
            style={{
              ...S.viewport,
              animation: shaking ? 'shake 0.35s ease' : 'none',
            }}
            onPointerDown={handleTap}
          >
            {/* Rafter glow â€” active during HOOT, fades on silence */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 0%,rgba(122,40,0,0.38) 0%,transparent 72%)',
              opacity: isHoot ? 1 : 0,
              transition: 'opacity 0.55s ease',
              animation: isHoot ? 'rafterPulse 2.2s ease-in-out infinite' : 'none',
            }} />

            {/* BARN_CROSSED moonlight bloom */}
            {phase === PHASE.BARN_CROSSED && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at 88% 55%,rgba(100,180,255,0.28) 0%,transparent 55%)',
                animation: 'moonPulse 1.8s ease-in-out infinite',
              }} />
            )}

            {/* Inner world */}
            <div style={{
              position: 'absolute', width: BARN_WIDTH, height: 300,
              transform: `translateX(${-camX}px)`,
              transition: `transform ${isMoving ? '0.42s' : '0.55s'} cubic-bezier(0.4,0,0.2,1)`,
            }}>

              {/* Sky */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:140, background:'linear-gradient(to bottom,#080502 0%,#0d0905 60%,transparent 100%)' }} />

              {/* Wall planks */}
              {Array.from({ length: Math.ceil(BARN_WIDTH / 38) }).map((_, i) => (
                <div key={i} style={{ position:'absolute', top:0, left:i*38, width:1, height:240, background:'rgba(20,12,4,0.5)' }} />
              ))}

              {/* Rafters */}
              {[0,280,560,840,1120].map((x, i) => (
                <div key={i} style={{ position:'absolute', top:14, left:x, width:290, height:7, background:'#150e04', boxShadow:'0 2px 8px rgba(0,0,0,0.9)' }} />
              ))}

              {/* Beams */}
              {beams.map((x, i) => (
                <div key={i} style={{ position:'absolute', top:20, left:x-9, width:18, height:185, background:'linear-gradient(to right,#0e0804,#1c1208,#0e0804)', boxShadow:'2px 0 8px rgba(0,0,0,0.7)' }} />
              ))}

              {/* Moonlight shafts */}
              {[108,324,540,756,972].map((x, i) => (
                <div key={i} style={{ position:'absolute', top:0, left:x, width:16, height:260, background:'linear-gradient(to bottom,rgba(140,170,210,0.06),transparent)', transform:'rotate(2deg)' }} />
              ))}

              {/* Owl eyes â€” visible only during HOOT; fade out when silence begins */}
              {owlPairs.map((owl, i) => (
                <div key={i} style={{
                  position:'absolute', left:owl.x, top:owl.y, display:'flex', gap:8,
                  opacity: isHoot ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                }}>
                  {[0,1].map(j => (
                    <div key={j} style={{
                      width:8, height:8, borderRadius:'50%',
                      background: '#e09000',
                      boxShadow: '0 0 8px 4px #b07000,0 0 14px 6px rgba(180,110,0,0.4)',
                      animation: `blink ${3.2 + i * 0.45}s ease-in-out infinite`,
                      animationDelay: `${i * 0.55 + j * 0.07}s`,
                    }} />
                  ))}
                </div>
              ))}

              {/* Floor */}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:100, background:'linear-gradient(to top,#180c04 0%,#100804 40%,transparent 100%)' }} />
              {Array.from({ length: Math.ceil(BARN_WIDTH / 42) }).map((_, i) => (
                <div key={i} style={{ position:'absolute', bottom:0, left:i*42, width:1, height:75, background:'rgba(24,14,4,0.65)' }} />
              ))}

              {/* Paw trail */}
              {step > 0 && Array.from({ length: step }).map((_, i) => {
                const a = objects[i]; const b = objects[i + 1]
                return [0.35, 0.65].map((t, j) => (
                  <div key={`${i}-${j}`} style={{ position:'absolute', bottom:56, left:a.x + (b.x - a.x) * t, fontSize:8, opacity:0.18, color:'#d4b896' }}>ðŸ¾</div>
                ))
              })}

              {/* Hiding objects */}
              {objects.slice(1).map(obj => (
                <div key={obj.id} style={{
                  position: 'absolute',
                  bottom: obj.type === 'door' ? 34 : 44,
                  left: obj.x,
                }}>
                  <ObjShape type={obj.type} isCurrent={obj.id === step} />
                </div>
              ))}

              {/* Mouse avatar */}
              <div style={{
                position: 'absolute', bottom: 49, left: mouseX - 14,
                transition: `left ${isMoving ? '0.42s' : '0.55s'} cubic-bezier(0.4,0,0.2,1)`,
                zIndex: 10,
              }}>
                <div style={{ position: 'relative' }}>
                  <TapAura level={auraLevel} />
                  <div style={{
                    fontSize: 20, display: 'block',
                    transform: avatarTransform,
                    transition: 'transform 0.15s ease,filter 0.15s ease',
                    filter: phase === PHASE.WRONG_COUNT
                      ? 'drop-shadow(0 0 6px rgba(255,80,0,0.7)) grayscale(0.3)'
                      : 'drop-shadow(0 0 7px rgba(245,200,66,0.35))',
                  }}>
                    {phase === PHASE.SWOOPED ? 'ðŸ˜µ' : 'ðŸ­'}
                  </div>
                </div>
              </div>

              {/* Swooping owl */}
              {swoopActive && (
                <div style={{
                  position: 'absolute',
                  left: camX + vw * OFFSET - 30,
                  top: 0,
                  fontSize: 42, zIndex: 20,
                  animation: 'swoop 0.88s ease-in-out forwards',
                  filter: 'drop-shadow(0 0 14px rgba(200,100,0,0.9))',
                }}>
                  ðŸ¦‰
                </div>
              )}

              {/* Dust motes */}
              {[140,420,700,980,1140].map((x, i) => (
                <div key={i} style={{
                  position:'absolute', left:x, top:48+(i%4)*22,
                  width:2, height:2, borderRadius:'50%',
                  background:'rgba(255,215,140,0.35)',
                  animation:`mote ${2.8+i*0.3}s ease-in-out infinite`,
                  animationDelay:`${i*0.4}s`,
                }} />
              ))}

            </div>{/* /inner world */}

            {/* BARN_CROSSED overlay */}
            {phase === PHASE.BARN_CROSSED && (
              <div style={S.crossedOverlay}>
                <div style={{ fontSize: 36 }}>ðŸ­âœ¨</div>
                <p style={S.crossedText}>You crossed the barn!</p>
              </div>
            )}

          </div>{/* /viewport */}

          {/* Mobile tap button */}
          <button
            style={{ ...S.tapBtn, ...(phase === PHASE.SILENCE ? S.tapBtnSilence : {}) }}
            onPointerDown={(e) => { e.preventDefault(); handleTap() }}
          >
            {phase === PHASE.SILENCE ? 'TAP' : phase === PHASE.HOOT ? 'WAIT' : 'Â·'}
          </button>

          <div style={S.stepCounter}>{step} / 10 steps</div>

        </div>
      )}

      {/* â”€â”€ MINDFULNESS (stub) â”€â”€ */}
      {phase === PHASE.MINDFULNESS && (
        <div style={{ ...S.screen, background: '#060402', minHeight: '100vh', justifyContent: 'center' }}>
          <div style={S.mindCard}>
            <p style={S.eyebrowDark}>Before you go â€”</p>
            <p style={S.mindText}>
              The owls were loud. But the silence between hoots â€”<br />
              did you notice it had a shape? A rhythm?<br />
              Some silences longer, some shorter.<br />
              <br />
              What did you listen to â€” the sound, or the quiet?
            </p>
            <button style={S.btnDark} onClick={onMindfulnessContinue}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ RESULTS â”€â”€ */}
      {phase === PHASE.RESULTS && results && (
        <div style={S.screen}>
          <div style={S.card}>
            <p style={S.eyebrow}>Session complete</p>
            <h2 style={S.titleDark}>The Owl Barn</h2>
            <div style={S.timeDisplay}>
              <span style={S.bigNum}>
                {results.crossingTimeMs != null
                  ? (results.crossingTimeMs / 1000).toFixed(1)
                  : 'â€”'}
              </span>
              <span style={S.bigUnit}>seconds</span>
            </div>
            <div style={S.breakGrid}>
              <StatCell label="Swoops"    val={results.swoopCount} />
              <StatCell label="Trials"    val={results.trials.length} />
              <StatCell
                label="8-tap rate"
                val={(() => {
                  const attempted = results.trials.filter(
                    t => t.playerChoice !== 'no_input' && t.outcome !== 'swooped'
                  )
                  const got8 = attempted.filter(t => t.playerChoice === '8tap')
                  return attempted.length ? `${got8.length}/${attempted.length}` : 'â€”'
                })()}
              />
              <StatCell
                label="Windows skipped"
                val={results.trials.filter(t => t.playerChoice === 'no_input').length}
              />
            </div>
            <div style={S.actions}>
              <button style={S.btnSecondary} onClick={resetToIdle}>Try again</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink       { 0%,86%,100%{opacity:1} 93%{opacity:0.07} }
        @keyframes mote        { 0%,100%{transform:translateY(0);opacity:0.35} 50%{transform:translateY(-12px);opacity:0.1} }
        @keyframes rafterPulse { 0%,100%{opacity:0.78} 50%{opacity:1} }
        @keyframes moonPulse   { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes swoop       { 0%{transform:translateY(-50px) rotate(-28deg);opacity:1} 45%{transform:translateY(192px) rotate(14deg);opacity:1} 78%{transform:translateY(205px) rotate(4deg);opacity:0.9} 100%{transform:translateY(-65px) rotate(-32deg);opacity:0} }
        @keyframes shake       { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
      `}</style>
    </div>
  )
}

// â”€â”€â”€ SMALL COMPONENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const StatCell = ({ label, val }) => (
  <div style={S.statCell}>
    <p style={S.statLabel}>{label}</p>
    <p style={S.statVal}>{val}</p>
  </div>
)

// â”€â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MONO  = "'Space Mono','Courier New',monospace"
const SERIF = "'DM Serif Display',Georgia,serif"
const BG    = '#FCF0F5'
const BGC   = '#ffffff'
const PK    = '#f068a4'
const TX    = '#1c1c1e'
const TX2   = '#6b6c70'
const TX3   = '#a8a9ad'
const BD    = 'rgba(180,100,140,0.15)'
const BGP   = '#FBEAF3'

const S = {
  shell: {
    background: BG, minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'system-ui,-apple-system,sans-serif', padding: '20px',
  },
  screen: {
    width: '100%', maxWidth: 560,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  card: {
    background: BGC, border: `1px solid ${BD}`,
    borderRadius: 20, padding: '36px 32px', width: '100%',
  },
  eyebrow: {
    fontFamily: MONO, fontSize: 9, letterSpacing: 2,
    textTransform: 'uppercase', color: PK, marginBottom: 10,
  },
  eyebrowDark: {
    fontFamily: MONO, fontSize: 9, letterSpacing: 2,
    textTransform: 'uppercase', color: 'rgba(212,184,150,0.6)', marginBottom: 16,
  },
  titleDark: {
    fontFamily: SERIF, fontSize: 36, color: TX, letterSpacing: -0.5,
    lineHeight: 1.1, marginBottom: 20,
  },
  bodyText: { fontSize: 14, color: TX2, lineHeight: 1.65, marginBottom: 12 },
  meta: {
    fontFamily: MONO, fontSize: 12, color: TX3, letterSpacing: 1,
    textAlign: 'center', margin: '16px 0 22px',
  },
  btnPrimary: {
    width: '100%', padding: '13px 0', background: PK, border: 'none',
    borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'system-ui,sans-serif',
  },
  btnSecondary: {
    flex: 1, padding: '12px 0', background: BGP,
    border: `1px solid ${BD}`, borderRadius: 12, color: PK,
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'system-ui,sans-serif',
  },
  btnDark: {
    padding: '12px 32px', background: 'rgba(212,184,150,0.12)',
    border: '1px solid rgba(212,184,150,0.22)', borderRadius: 10,
    color: '#d4b896', fontSize: 13, cursor: 'pointer',
    fontFamily: MONO, letterSpacing: '0.1em',
  },
  calBar: {
    height: 8, background: 'rgba(212,184,150,0.12)',
    borderRadius: 4, marginBottom: 4, position: 'relative', overflow: 'hidden',
  },
  calBarFill: {
    position: 'absolute', inset: 0,
    background: `linear-gradient(to right,${PK},#f5c842)`,
    borderRadius: 4,
  },
  calBarLabels: {
    display: 'flex', justifyContent: 'space-between',
    fontFamily: MONO, fontSize: 9, color: TX3, letterSpacing: 1, marginBottom: 16,
  },
  shrinkCard: { textAlign: 'center', padding: '40px 24px' },
  shrinkEmoji: { fontSize: 56, marginBottom: 24 },
  shrinkLine1: { fontFamily: SERIF, fontSize: 28, color: '#d4b896', marginBottom: 10 },
  shrinkLine2: {
    fontFamily: MONO, fontSize: 12, color: '#c97800', letterSpacing: '0.14em',
    textTransform: 'uppercase', marginBottom: 8,
  },
  shrinkLine3: {
    fontFamily: MONO, fontSize: 12, color: 'rgba(212,184,150,0.5)',
    letterSpacing: '0.1em', textTransform: 'uppercase',
  },
  mindCard: { textAlign: 'center', maxWidth: 400, padding: '20px 16px' },
  mindText: {
    fontFamily: SERIF, fontSize: 18, color: 'rgba(212,184,150,0.8)',
    lineHeight: 1.8, marginBottom: 32,
  },
  gameWrap: {
    width: '100%', maxWidth: 720,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  },
  progressOuter: {
    width: '100%', height: 3, background: 'rgba(212,184,150,0.1)',
    borderRadius: 2, position: 'relative',
  },
  progressFill: {
    height: '100%', background: 'linear-gradient(to right,#7a2800,#f5c842)',
    borderRadius: 2, transition: 'width 0.42s ease',
    boxShadow: '0 0 7px rgba(245,200,66,0.45)',
  },
  phaseLabel: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em',
    textTransform: 'uppercase', height: 18, display: 'flex', alignItems: 'center',
  },
  viewport: {
    width: '100%', position: 'relative', overflow: 'hidden', height: 300,
    background: '#060402', borderRadius: 12, border: '1px solid rgba(20,12,4,0.8)',
    cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', flexShrink: 0,
  },
  tapBtn: {
    width: '100%', padding: '16px 0', background: '#0d0905',
    border: '1px solid rgba(212,184,150,0.1)', borderRadius: 10, fontSize: 12,
    color: 'rgba(212,184,150,0.3)', cursor: 'pointer', fontFamily: MONO,
    letterSpacing: '0.16em', transition: 'all 0.1s',
    userSelect: 'none', WebkitUserSelect: 'none',
  },
  tapBtnSilence: {
    background: 'rgba(127,212,106,0.08)',
    borderColor: 'rgba(127,212,106,0.3)',
    color: '#7fd46a', fontWeight: 600,
  },
  stepCounter: {
    fontFamily: MONO, fontSize: 9, color: 'rgba(212,184,150,0.3)',
    letterSpacing: '0.12em', textTransform: 'uppercase',
  },
  crossedOverlay: {
    position: 'absolute', inset: 0, zIndex: 15,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(6,4,2,0.55)', pointerEvents: 'none',
  },
  crossedText: { fontFamily: SERIF, fontSize: 28, color: '#f5c842', marginTop: 12 },
  timeDisplay: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 },
  bigNum: { fontFamily: MONO, fontSize: 48, fontWeight: 700, color: TX, lineHeight: 1 },
  bigUnit: { fontFamily: MONO, fontSize: 14, color: TX3 },
  breakGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 },
  statCell: { background: BGP, borderRadius: 10, padding: '12px 14px' },
  statLabel: {
    fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase',
    color: TX3, marginBottom: 4,
  },
  statVal: { fontFamily: MONO, fontSize: 22, fontWeight: 700, color: TX },
  actions: { display: 'flex', gap: 10 },
}
