// ── BCAT threshold: the order of a run (practice, engine trials, repeats) ──
//
// No React and no DOM: everything that shows a trial is a `present` function passed in, so the same code runs
// a live session (presenter.js, in the browser) and a simulated one (simulate.js, in a preview or in node).
// session.test.mjs runs whole simulated sessions through it on the engine's main-thread controller.
//
// present({ phase, spec } | { phase, specPromise }) resolves to
//   { pres, answer: { response, key, rtMs, questionOnsetMs }, interrupted, focusEvents, keys, tStartMs, wallclockStart }
// or { no_trial: true } (specPromise gave null) or { cancelled: true }.
//
// Engine trials (PLAN.md section 3): the answer goes to the engine at once, and while the engine updates (in
// its worker) the next trial already starts with fixation and its baseline pulses, its level arriving within a few
// hundred ms (trialLoop.js holds the circle if it ever does not). That needs the previous reply's
// last_trial === false, which says the session goes on whatever this answer is; otherwise it waits for the
// reply. What the engine is given, and what is shown again later, is sequence.js's rule.

import { practiceTrials } from './trialPlan.js'
import { makeTrialRecord } from './records.js'

const cancelled = Object.freeze({ cancelled: true })

/** The practice trials, each followed by afterEach(spec) (the feedback page). Never sent to the engine. */
export async function runPractice({ cfg, present, sequence, saveTrial, runId, afterEach, isCancelled = () => false }) {
  for (const spec of practiceTrials(cfg)) {
    if (isCancelled()) return cancelled
    const shown = await present({ phase: 'practice', spec })
    if (shown.cancelled) return cancelled
    const seq = sequence.nextSeq()
    await saveTrial(makeTrialRecord({ runId, seq, phase: 'practice', spec, pres: shown.pres, answer: shown.answer,
      interrupted: shown.interrupted, focusEvents: shown.focusEvents, keys: shown.keys, tStartMs: shown.tStartMs,
      wallclockStart: shown.wallclockStart }))
    if (afterEach) await afterEach(spec)
  }
  return { done: true }
}

/**
 * The adaptive trials, from init to the engine's last trial.
 * @returns {Promise<{ init: object, n: number } | { cancelled: true }>}
 */
export async function runEngineTrials({ engine, cfg, seed, present, sequence, saveTrial, runId, isCancelled = () => false, prestart = true }) {
  const init = await engine.call({ type: 'init', cfg: cfg.engine, seed })
  let source = init.trial ? { spec: init.trial } : null
  let lastFlag = init.last_trial
  let n = 0
  const saves = []
  while (source) {
    if (isCancelled()) return cancelled
    const shown = await present({ phase: 'main', ...source })
    if (shown.cancelled) return cancelled
    if (shown.no_trial) break
    const spec = shown.pres.spec
    const decision = sequence.mainAnswered({ spec, response: shown.answer.response, interrupted: shown.interrupted })
    const seq = sequence.nextSeq()
    n += 1
    const replyP = engine.call({ type: 'respond', trial_index: spec.trial_index, response: decision.engineResponse })
    const saved = replyP.then(reply => saveTrial(makeTrialRecord({ runId, seq, phase: 'main', spec, pres: shown.pres,
      answer: shown.answer, interrupted: shown.interrupted, focusEvents: shown.focusEvents, keys: shown.keys,
      engineResponse: decision.engineResponse, reply, repeatQueued: decision.repeatQueued, tStartMs: shown.tStartMs,
      wallclockStart: shown.wallclockStart })))
    saved.catch(() => {})   // awaited below; this only stops an early "unhandled rejection"
    saves.push(saved)
    if (prestart && lastFlag === false) {
      source = { specPromise: replyP.then(r => { lastFlag = r.last_trial; return r.next_trial }) }
    } else {
      const r = await replyP
      if (r.finished) break
      source = { spec: r.next_trial }
      lastFlag = r.last_trial
    }
  }
  await Promise.all(saves)
  return { init, n }
}

/** The repeats sequence.js queued, each shown once, data only. */
export async function runRepeats({ present, sequence, saveTrial, runId, isCancelled = () => false }) {
  let r, n = 0
  while ((r = sequence.takeRepeat())) {
    if (isCancelled()) return cancelled
    const shown = await present({ phase: 'repeat', spec: r.spec })
    if (shown.cancelled) return cancelled
    const seq = sequence.nextSeq()
    n += 1
    await saveTrial(makeTrialRecord({ runId, seq, phase: 'repeat', spec: r.spec, pres: shown.pres, answer: shown.answer,
      interrupted: shown.interrupted, focusEvents: shown.focusEvents, keys: shown.keys, repeatOf: r.repeatOf,
      tStartMs: shown.tStartMs, wallclockStart: shown.wallclockStart }))
  }
  return { n }
}
