import { useEffect, useRef, useState } from 'react'
import useBreathVoice from '../useBreathVoice'
import { createAwayTracker } from './awayTracker'
import { BREATH_DEFAULTS, breathAt } from './breathTiming'
import { holdSummary } from './breathHold'
import { useScrollToTopOn } from '../../../lib/scrollToTop'

// The breathing arm of PracticeTaskStep: Sandy's paced slow breathing, about
// 4 minutes at 6 breaths a minute (4 s in, 6 s out), following a circle that
// grows and shrinks. Wording and timing are her prototype's
// (relaxation_step_prototype.html, Study 4 Design folder); the circle moves in
// the natural breath shape unless the step's config sets shape 'symmetric'
// (breathTiming.js).
//
// Time counts only while the page is visible, so a participant who switches away
// comes back to the practice where they left it, and the time away is recorded.
//
// Voice cue. Sandy's flow allows sound and wants the practice to work without
// it. No recording exists yet. A step can name a `voice_base` folder of clips in
// the format useBreathVoice reads (manifest.json + one mp3 per key, rendered by
// scripts/tts/). The keys are `settle`, `cue_in` and `cue_out`, and each clip
// plays only if its recorded text matches the caption on screen, so the
// existing Breath Sensation clips ("Breathe in" / "and out") stay silent here.
// Without clips the practice is visual only; the prototype's placeholder note
// is shown in demos, never to participants.
//
// Adherence check (config `hold_to_inhale`, off unless a step sets it). The
// participant holds a button under the circle, or the space bar, while
// breathing in, and lets go while breathing out. Presses are timed on the
// pacer's visible clock, so they line up with the phase on screen, and are
// scored by breathHold.js. Leaving the page or the window lets go of the press.
// Nothing tells the participant whether they are in time.

const CUES = {
  settle: 'Get comfortable',
  in:     'In through your nose',
  out:    'Out through your mouth',
}

export default function PacedBreathing({ config, demoMode = false, onDone }) {
  const cfg = { ...BREATH_DEFAULTS, ...config }
  // the prototype's wording; under a minute only ever happens in a short preview
  const length = cfg.breathing_seconds < 60
    ? `${cfg.breathing_seconds} seconds`
    : `${Math.round(cfg.breathing_seconds / 60 * 10) / 10} minutes`

  const [stage, setStage]   = useState('intro')   // intro → practice → finished
  const [cue, setCue]       = useState(CUES.settle)
  const [voiceOff, setVoiceOff] = useState(false)
  const [held, setHeld]     = useState(false)
  const pacerRef  = useRef(null)
  const progRef   = useRef(null)
  const resultRef = useRef(null)
  const togglesRef = useRef(0)
  const clk  = useRef({ visible: 0, last: 0 })                  // the pacer's visible clock
  const hold = useRef({ down: null, list: [], input: new Set() })
  const holdOn = cfg.hold_to_inhale === true
  useScrollToTopOn(stage)

  const voice = useBreathVoice(cfg.voice_base ?? null)
  const voiceRef = useRef(voice)
  useEffect(() => { voiceRef.current = voice })

  // visible time now, between the pacer's 50 ms ticks
  const visibleNow = () => clk.current.visible + Math.min(250, performance.now() - clk.current.last)

  function press(input) {
    const h = hold.current
    if (h.down !== null || document.hidden) return
    h.down = visibleNow()
    h.input.add(input)
    setHeld(true)
  }

  function letGo(at = visibleNow()) {
    const h = hold.current
    if (h.down === null) return
    if (h.list.length < 1000) h.list.push({ down: Math.round(h.down), up: Math.round(at) })
    h.down = null
    setHeld(false)
  }

  function start() {
    voice.unlock()   // inside the tap: the only way a phone will start audio
    setStage('practice')
  }

  useEffect(() => {
    if (stage !== 'practice') return
    const away = createAwayTracker()
    const t0 = performance.now()
    const c = clk.current
    c.visible = 0; c.last = t0
    let voiceOffMs = 0, phase = '', cycles = 0, finished = false

    const say = (key, text) => voiceRef.current.play(key, text)
    say('settle', CUES.settle)

    const timer = setInterval(() => {
      // capped, so a frozen tab or a sleeping laptop can't jump the practice ahead
      const now = performance.now(), dt = Math.min(250, now - c.last)
      c.last = now
      if (document.hidden) return
      c.visible += dt
      if (voiceRef.current.offRef.current) voiceOffMs += dt

      const b = breathAt(c.visible, cfg)
      if (pacerRef.current) pacerRef.current.style.transform = `scale(${b.scale.toFixed(3)})`
      if (progRef.current)  progRef.current.style.width = `${(b.progress * 100).toFixed(2)}%`
      if (b.phase !== phase) {
        phase = b.phase
        if (b.phase === 'in') { cycles++; setCue(CUES.in); say('cue_in', CUES.in) }
        if (b.phase === 'out') { setCue(CUES.out); say('cue_out', CUES.out) }
      }

      if (b.done && !finished) {
        finished = true
        clearInterval(timer)
        const { hidden_ms, left_page_count } = away.stop()
        letGo(c.visible)
        resultRef.current = {
          planned_seconds: cfg.breathing_seconds,
          inhale_ms:       cfg.inhale_ms,
          exhale_ms:       cfg.exhale_ms,
          settle_ms:       cfg.settle_ms,
          shape:           cfg.shape,
          cycles,
          duration_ms:     Math.round(performance.now() - t0),
          visible_ms:      Math.round(c.visible),
          hidden_ms,
          left_page_count,
          voice_available: !!voiceRef.current.available,
          voice_off_ms:    Math.round(voiceOffMs),
          voice_toggles:   togglesRef.current,
          hold: holdOn ? {
            input:  [...hold.current.input].sort(),
            ...holdSummary(hold.current.list, cfg, c.visible),
            events: hold.current.list,
          } : null,
        }
        setStage('finished')
      }
    }, 50)

    return () => { clearInterval(timer); away.stop() }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // The space bar, and letting go when the page or the window loses focus
  useEffect(() => {
    if (stage !== 'practice' || !holdOn) return
    const isSpace = e => e.code === 'Space' || e.key === ' '
    const down = e => { if (!isSpace(e)) return; e.preventDefault(); if (!e.repeat) press('key') }
    const up   = e => { if (!isSpace(e)) return; e.preventDefault(); letGo() }
    const away = () => letGo()
    const vis  = () => { if (document.hidden) letGo() }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', away)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', away)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleVoice() {
    voice.toggle()
    togglesRef.current++
    setVoiceOff(v => !v)
  }

  if (stage === 'intro') {
    return (
      <div className="pt-card">
        <h2>Next: a breathing practice</h2>
        <p>It takes about {length}. You will breathe slowly along with a circle that grows and shrinks. Please sit comfortably. Please stay on this page during the task, and do not switch tabs. Press Start to begin the task.</p>
        {holdOn && <p>While you breathe in, press and hold the button under the circle, or the space bar if you are using a keyboard. Let go as you breathe out.</p>}
        <div className="pt-actions"><button type="button" className="pt-btn" onClick={start}>Start</button></div>
      </div>
    )
  }

  if (stage === 'finished') {
    return (
      <div className="pt-card">
        <p>The breathing practice is finished.</p>
        <div className="pt-actions">
          <button type="button" className="pt-btn" onClick={() => onDone(resultRef.current)}>Continue</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-card">
      <div className="pt-stage">
        <div className="pt-pacer" ref={pacerRef} />
        <div className="pt-cue" aria-live="polite">{cue}</div>
        <div className="pt-progress"><div ref={progRef} /></div>
      </div>
      {holdOn && (
        <div className="pt-hold-wrap">
          <button
            type="button"
            tabIndex={-1}
            className={`pt-hold${held ? ' on' : ''}`}
            aria-pressed={held}
            onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); press(e.pointerType || 'pointer') }}
            onPointerUp={() => letGo()}
            onPointerCancel={() => letGo()}
            onLostPointerCapture={() => letGo()}
            onContextMenu={e => e.preventDefault()}
          >
            {held ? 'Breathing in' : 'Hold while you breathe in'}
          </button>
          <span className="pt-muted pt-hold-key">or hold the space bar</span>
        </div>
      )}
      <div className="pt-bar">
        <span className="pt-muted">In through your nose as the circle grows, out through your mouth as it shrinks.</span>
        <span className="pt-grow" />
        {voice.available
          ? <button type="button" className="pt-btn-quiet" onClick={toggleVoice}>Sound: {voiceOff ? 'off' : 'on'}</button>
          : demoMode && <span className="pt-muted">[Placeholder: a recorded voice cue will go here]</span>}
      </div>
    </div>
  )
}
