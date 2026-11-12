// ── BCAT threshold: showing a trial in the browser ─────────────────────────
//
// The live `present` function session.js calls (simulate.js is the other one). One instance per run; it owns
// the window's key, focus and visibility listeners while the step is mounted (attach / detach).
//
//   1. Keys-up gate (touch and breath arms): while W or S is down the circle does not start; the cue line
//      asks to let go (keysGate.js).
//   2. The circle: trialLoop.presentCircle, drawn by writing transform straight to the element on every
//      frame (no React state in the loop). The key log opens on the first frame (fixation onset, the trial
//      clock's 0) and closes on the last; every key-down and key-up in between is logged in all three arms,
//      with event.timeStamp - t0 (performance.now's clock) as its time (keyLog.js).
//   3. The question: shown in the same frame the circle ends (direct style write), so the response time is
//      measured from that frame. The arrow keys answer; auto-repeats are ignored.
// The cue line (.bt-cue), in priority order: the keys-up gate's "let go" while it waits (before fixation onset);
// then, from fixation onset, the compliance line if this trial was asked for one (compliance.js), removed in the
// first frame the circle moves (written to the element directly, as the question is, so it is gone in that frame;
// that time is the record's reminder_off_ms); in practice the test build's pacer cue from then on (practice
// only, as the test build: it is the one text shown while the circle pulses). Main and repeat trials show
// nothing but the circle while it pulses, in every arm. The gate comes first, so a line asked for is always
// shown for the whole fixation.
// Focus: window blur and page hide are kept per trial on the trial clock from fixation onset to the answer;
// a blur or hide during the circle makes the trial interrupted (sequence.js). On blur the tracker lets go of
// every key and the key log closes its open presses (keyLog.js: log.blur), so no phantom hold survives.
// Full screen (fullscreen.js, when o.fullscreen is passed): a full-screen exit or entry is logged among the same
// focus events ('fullscreen_exit', 'fullscreen_enter'), and an exit during the circle interrupts the trial as a
// blur does (sequence.js). Keys are not let go on an exit: the window keeps the focus, so no key-up is lost.
// present() also returns whether the trial began in full screen (fullscreenAtOnset) and the interruption's reasons.

import { createKeyTracker, createKeyLog, parseKeyLog, scoreHolds } from './keyLog.js'
import { halfPulses } from './pacerClock.js'
import { presentCircle } from './trialLoop.js'
import { mustWaitForRelease } from './keysGate.js'
import { interruptionReasons } from './sequence.js'

/** Median frame interval over n frames, in ms. */
export function measureFramePeriod(n = 60) {
  return new Promise(resolve => {
    const ts = []
    const step = t => {
      ts.push(t)
      if (ts.length <= n) { requestAnimationFrame(step); return }
      const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b)
      resolve(d[Math.floor(d.length / 2)])
    }
    requestAnimationFrame(step)
  })
}

/** Resolves after the next paint (two frames), so a React view change is on screen before a circle starts. */
export const nextPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

const TASK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '])

/**
 * @param {object} o
 * @param {object} o.cfg
 * @param {'vision'|'touch'|'breath'} o.arm
 * @param {() => { circle: HTMLElement, question: HTMLElement, cue?: HTMLElement }} o.els
 * @param {(cue: { kind: string } | null) => void} o.setCue   'release' | 'compliance' | 'practice' | null
 * @param {() => boolean} o.isCancelled
 * @param {() => number} o.framePeriodMs
 * @param {number} o.runStart   performance.now() at the run's start
 * @param {(ui: object) => void} [o.onUi]   preview only: what is on screen (the automated browser tests read it)
 * @param {(cb: (ts: number) => void) => any} [o.raf]   requestAnimationFrame (tests pass a fake frame clock)
 * @param {() => number} [o.now]   performance.now
 * @param {{ visibilityState: string }} [o.doc]   document
 * @param {EventTarget} [o.win]   window (attach / detach)
 * @param {ReturnType<import('./fullscreen.js').createFullscreen>} [o.fullscreen]   the run's full-screen controller
 */
export function createLivePresenter(o) {
  const { cfg, arm, els, setCue, isCancelled, runStart, onUi = () => {} } = o
  const rafImpl = o.raf || (cb => requestAnimationFrame(cb))
  const now = o.now || (() => performance.now())
  const doc = () => o.doc || globalThis.document
  const win = () => o.win || globalThis.window
  const showCue = c => {
    setCue(c)
    const el = els().cue
    if (el) el.style.visibility = c ? 'visible' : 'hidden'
  }
  const tracker = createKeyTracker()
  const answerOf = Object.fromEntries(Object.entries(cfg.keys.answers).map(([resp, key]) => [key, resp]))
  let log = null, t0 = null, focus = null, onAnswer = null, onRelease = null, onTrialScreen = false, unsubscribe = null
  const onFullscreen = type => { if (focus) focus.push({ type, t: rel(now()) }) }

  const rel = ts => (t0 === null ? null : ts - t0)
  const handlers = {
    keydown(ev) {
      if (onTrialScreen && TASK_KEYS.has(ev.key)) ev.preventDefault()
      tracker.keydown(ev)
      if (log) log.keydown({ key: ev.key, code: ev.code, t: rel(ev.timeStamp), repeat: ev.repeat, tHandler: rel(now()) })
      if (onAnswer && !ev.repeat && answerOf[ev.key]) onAnswer(ev)
    },
    keyup(ev) {
      tracker.keyup(ev)
      if (log) log.keyup({ key: ev.key, code: ev.code, t: rel(ev.timeStamp), tHandler: rel(now()) })
      if (onRelease) onRelease()
    },
    blur(ev) {
      if (log) log.blur({ t: rel(ev.timeStamp), tHandler: rel(now()), tracker })
      else tracker.releaseAll()
      if (focus) focus.push({ type: 'blur', t: rel(now()) })
      if (onRelease) onRelease()
    },
    focus() { if (focus) focus.push({ type: 'focus', t: rel(now()) }) },
    visibilitychange() {
      const hidden = doc().visibilityState === 'hidden'
      if (hidden) {
        if (log) log.blur({ t: rel(now()), tHandler: rel(now()), tracker })
        else tracker.releaseAll()
        if (onRelease) onRelease()
      }
      if (focus) focus.push({ type: hidden ? 'hidden' : 'visible', t: rel(now()) })
    },
  }

  const scoreKeys = (events, timeline, endMs) => {
    try { return scoreHolds(parseKeyLog(events, { endMs }), halfPulses(timeline)).summary } catch (_) { return null }
  }

  async function present({ phase, spec, specPromise, reminder = false }) {
    const { circle, question } = els()
    if (isCancelled()) return { cancelled: true }
    // 1. keys-up gate
    if (mustWaitForRelease(arm, tracker.held(), cfg.keys)) {
      showCue({ kind: 'release' })
      onUi({ what: 'gate', phase })
      await new Promise(resolve => {
        onRelease = () => { if (!mustWaitForRelease(arm, tracker.held(), cfg.keys)) { onRelease = null; resolve() } }
      })
      if (isCancelled()) return { cancelled: true }
    }
    const movingCue = phase === 'practice' ? { kind: 'practice' } : null
    showCue(reminder ? { kind: 'compliance' } : movingCue)
    question.style.visibility = 'hidden'
    onTrialScreen = true
    // 2. the circle
    const maxScale = cfg.display.circle_max_size
    let ended = null, questionOnset = null, hiddenAtStart = false, frameTs = null, moving = false, reminderOffMs = null, fullscreenAtOnset = null
    const wallclockStart = new Date().toISOString()
    let durs = spec ? spec.pulse_durations_s : null
    if (!spec && specPromise) specPromise.then(s => { if (s) { durs = s.pulse_durations_s; onUi({ what: 'circle', phase, t0, durs, cell: s.cell, reminder: !!reminder }) } }, () => {})
    const rec = await presentCircle({
      cfg, spec, specPromise, framePeriodMs: o.framePeriodMs(), isCancelled,
      raf: cb => rafImpl(ts => { frameTs = ts; cb(ts) }),
      now,
      render: (s, state) => {
        circle.style.transform = `scale(${(s / maxScale).toFixed(5)})`
        if (!moving && state && state.segment !== 'fixation') {
          // the first frame the circle moves: the compliance line goes, in this frame
          moving = true
          if (reminder) { showCue(movingCue); reminderOffMs = frameTs - t0 }
        }
      },
      onStart: ts => {
        t0 = ts
        focus = []
        hiddenAtStart = doc().visibilityState === 'hidden'
        fullscreenAtOnset = o.fullscreen ? o.fullscreen.isActive() : null
        log = createKeyLog(cfg.keys)
        log.begin(0, tracker.held())
        onUi({ what: 'circle', phase, t0, durs, cell: spec ? spec.cell : null, reminder: !!reminder })
      },
      onEnd: ts => {
        ended = log.end(ts - t0, tracker.held())
        log = null
        question.style.visibility = 'visible'
        questionOnset = ts
      },
    })
    if (rec.cancelled || rec.no_trial) { log = null; focus = null; onTrialScreen = false; if (rec.no_trial) showCue(null); return rec }
    onUi({ what: 'question', phase, cell: rec.spec.cell, trial_index: rec.spec.trial_index })
    // 3. the answer
    const answer = await new Promise(resolve => {
      onAnswer = ev => {
        onAnswer = null
        resolve({ response: answerOf[ev.key], key: ev.key, rtMs: ev.timeStamp - questionOnset, questionOnsetMs: questionOnset - t0 })
      }
    })
    question.style.visibility = 'hidden'
    onTrialScreen = false
    const focusEvents = focus
    focus = null
    const reasons = interruptionReasons(focusEvents, { startMs: 0, endMs: rec.t_end, hiddenAtStart })
    const interrupted = reasons.length > 0
    onUi({ what: 'between', phase })
    return {
      pres: { ...rec, reminder_off_ms: reminderOffMs },
      answer,
      interrupted,
      interruptionReasons: reasons,
      fullscreenAtOnset,
      focusEvents,
      keys: { events: ended.events, repeats: ended.repeats, blurs: ended.blurs, summary: scoreKeys(ended.events, rec.timeline, rec.t_end) },
      tStartMs: rec.t0 - runStart,
      wallclockStart,
    }
  }

  return {
    present,
    tracker,
    attach() {
      const w = win(), d = doc()
      w.addEventListener('keydown', handlers.keydown, true)
      w.addEventListener('keyup', handlers.keyup, true)
      w.addEventListener('blur', handlers.blur)
      w.addEventListener('focus', handlers.focus)
      d.addEventListener('visibilitychange', handlers.visibilitychange)
      if (o.fullscreen && !unsubscribe) unsubscribe = o.fullscreen.subscribe(onFullscreen)
    },
    detach() {
      const w = win(), d = doc()
      w.removeEventListener('keydown', handlers.keydown, true)
      w.removeEventListener('keyup', handlers.keyup, true)
      w.removeEventListener('blur', handlers.blur)
      w.removeEventListener('focus', handlers.focus)
      d.removeEventListener('visibilitychange', handlers.visibilitychange)
      if (unsubscribe) { unsubscribe(); unsubscribe = null }
      onAnswer = null; onRelease = null; log = null; focus = null
    },
  }
}
