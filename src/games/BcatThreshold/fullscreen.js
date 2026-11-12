// ── BCAT threshold: full screen ────────────────────────────────────────────
//
// Pure and node-testable (fullscreen.test.mjs): the document is passed in. The test build required full screen
// (6_online_pilot/js/app.js, ensureFullscreen; config online.require_fullscreen); this is its rule, on the site
// (Norm, 2026-11-12). Switched by cfg.fullscreen.enabled, outside cfg.engine (configHash unchanged).
//
//   entry    a page before the instructions ("The task runs in full screen."); its Continue (button or space
//            bar) calls enter() inside that click or key press, as the browser requires. Skipped when the
//            browser is known to refuse (no API, or fullscreenEnabled false, as in an iframe without permission).
//   during   a full-screen exit while the circle is up makes the trial interrupted, through the same rule as a
//            blur (sequence.js, INTERRUPTION_POLICY): the presenter subscribes here and logs 'fullscreen_exit'
//            among the trial's focus events. A trial is interrupted once however many losses it has.
//   between  before each trial, if full screen was asked for and is off, a page asks to return
//            ("The task needs full screen. Please return to full screen to continue."), and its Continue
//            re-enters (createReturnGate). The trial waits for it.
//   refused  if the browser rejects a request (at entry or on return) the task goes on windowed and never asks
//            again, as the test build ("do not ask again"); the run and result record why (windowed_reason).
//   end      exit() when the step completes, errors or unmounts. An exit the task makes is not counted.
//
// Change events are de-duplicated on the actual state, so a browser that fires both the prefixed and the
// standard event (or fires one twice) counts one exit.

/** The browser's full-screen API (standard, or Safari's webkit prefix), or null when there is none. */
export function fullscreenApi(doc = globalThis.document) {
  const root = doc && doc.documentElement
  if (!root) return null
  const std = typeof root.requestFullscreen === 'function'
  const wk = !std && typeof root.webkitRequestFullscreen === 'function'
  if (!std && !wk) return null
  return {
    enabled: () => (std ? doc.fullscreenEnabled : doc.webkitFullscreenEnabled) !== false,
    element: () => (std ? doc.fullscreenElement : doc.webkitFullscreenElement) || null,
    request: () => (std ? root.requestFullscreen() : root.webkitRequestFullscreen()),
    exit: () => (std ? doc.exitFullscreen() : doc.webkitExitFullscreen()),
    event: std ? 'fullscreenchange' : 'webkitfullscreenchange',
  }
}

/**
 * One per run.
 * @param {{ enabled?: boolean, doc?: Document, now?: () => number, simulated?: boolean }} [o]
 *   enabled: cfg.fullscreen.enabled; simulated: a simulated preview (nothing is shown, nothing is asked)
 */
export function createFullscreen({ enabled = true, doc = globalThis.document, now = () => performance.now(), simulated = false } = {}) {
  const api = simulated ? null : fullscreenApi(doc)
  const supported = simulated ? null : !!api && api.enabled()
  let windowed = simulated ? 'simulated' : !enabled ? 'config_off' : !api ? 'no_api' : !api.enabled() ? 'not_enabled' : null
  let entered = false, active = api ? !!api.element() : false, leaving = false
  let exits = 0, failed = 0
  const events = []
  const subs = new Set()
  const note = (type, extra) => { events.push({ type, t_ms: now(), ...extra }) }

  const onChange = () => {
    const on = !!api.element()
    if (on === active) return                // a duplicate event, or no change
    active = on
    if (on) { entered = true; note('fullscreen_enter') } else if (leaving) { note('fullscreen_exit_by_task') } else { exits += 1; note('fullscreen_exit') }
    const byTask = !on && leaving
    if (!on) leaving = false
    if (!byTask) for (const f of subs) f(on ? 'fullscreen_enter' : 'fullscreen_exit')
  }
  // old Safari's webkitRequestFullscreen returns nothing: wait for the change (or give up after a second)
  const changed = ms => new Promise(resolve => {
    const t = setTimeout(done, ms)
    function done() { clearTimeout(t); doc.removeEventListener(api.event, done); resolve() }
    doc.addEventListener(api.event, done)
  })

  return {
    /** The task asks for full screen in this run (on, supported, and never refused). */
    get wanted() { return windowed === null },
    get entered() { return entered },
    get exits() { return exits },
    /** In full screen now. */
    isActive() { return !!api && !!api.element() },
    /** Before a trial: the participant must return to full screen first. */
    needsReturn() { return windowed === null && !(!!api && !!api.element()) },
    /**
     * Ask for full screen. Call it synchronously inside a click or key press (the browser refuses it otherwise).
     * Resolves true when in full screen, false when not asked (off, unsupported) or refused; never rejects.
     */
    enter() {
      if (windowed !== null) return Promise.resolve(false)
      if (api.element()) return Promise.resolve(true)
      note('fullscreen_request')
      let r
      try { r = api.request() } catch (e) { r = Promise.reject(e) }
      const p = r && typeof r.then === 'function' ? r : changed(1000).then(() => { if (!api.element()) throw new Error('no full screen after the request') })
      return p.then(() => {
        onChange()                             // in case the change event has not arrived yet
        return !!api.element()
      }, err => {
        failed += 1
        windowed = 'rejected'
        note('fullscreen_request_failed', { message: String(err && err.message || err) })
        return false
      })
    },
    /** Leave full screen, if in it (the end of the step). Not counted as an exit. */
    exit() {
      if (!api || !api.element()) return
      leaving = true
      try { const r = api.exit(); if (r && typeof r.catch === 'function') r.catch(() => {}) } catch (_) { /* nothing to do */ }
    },
    /** fn('fullscreen_exit' | 'fullscreen_enter') on each change the participant makes. Returns unsubscribe. */
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
    attach() { if (api) doc.addEventListener(api.event, onChange) },
    detach() { if (api) doc.removeEventListener(api.event, onChange); subs.clear() },
    /** For the run record, once the entry page is past. */
    runFacts() { return { enabled: !!enabled && !simulated, supported, entered, windowed_reason: windowed } },
    /** For the result record. */
    summary() {
      return { enabled: !!enabled && !simulated, supported, entered, windowed_reason: windowed, exits, failed_requests: failed, events: events.slice() }
    },
  }
}

/**
 * The page between trials. Returns gate(): resolves true if the page was shown (the participant was out of full
 * screen), false if not. It keeps asking until they are back, or the browser refuses (then it goes on windowed).
 * @param {{ fullscreen: ReturnType<typeof createFullscreen>, showPage: (gesture: () => void) => Promise<void>,
 *           isCancelled?: () => boolean }} o
 *   showPage shows the page and resolves on Continue, having called gesture() inside that click or key press
 */
export function createReturnGate({ fullscreen, showPage, isCancelled = () => false }) {
  return async function gate() {
    let shown = false
    while (fullscreen.needsReturn() && !isCancelled()) {
      shown = true
      let req = null
      await showPage(() => { req = fullscreen.enter() })
      await (req || Promise.resolve(false))
    }
    return shown
  }
}
