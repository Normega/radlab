// ── BCAT threshold: the order of a run (practice, engine trials, repeats) ──
//
// No React and no DOM: everything that shows a trial is a `present` function passed in, so the same code runs
// a live session (presenter.js, in the browser) and a simulated one (simulate.js, in a preview or in node).
// session.test.mjs runs whole simulated sessions through it on the engine's main-thread controller.
//
// present({ phase, spec, reminder } | { phase, specPromise, reminder }) resolves to
//   { pres, answer: { response, key, rtMs, questionOnsetMs }, interrupted, focusEvents, keys, tStartMs, wallclockStart }
// or { no_trial: true } (specPromise gave null) or { cancelled: true }, or { fullscreen_lost: true } when the
// participant was out of full screen as the trial was about to start (presenter.js): nothing was shown, and the
// trial is asked for again after the return page.
//
// Engine trials (PLAN.md section 3): the answer goes to the engine at once, and while the engine updates (in
// its worker) the next trial already starts with fixation and its baseline pulses, its level arriving within a few
// hundred ms (trialLoop.js holds the circle if it ever does not). That needs the previous reply's
// last_trial === false, which says the session goes on whatever this answer is; otherwise it waits for the
// reply. What the engine is given, and what is shown again later, is sequence.js's rule.
//
// Compliance reminders (compliance.js), when a `compliance` object is passed: before each trial it may show the
// page reminder (awaited, so the next trial waits for Continue; the engine meanwhile computes as usual) and
// asks the presenter for the fixation line (present({ ..., reminder: true })); after each trial it scores the
// trial. Neither touches what the engine is given. Without one, rows carry no compliance facts.
//
// Full screen (fullscreen.js), when a `gate` is passed: after the compliance page and right before each trial,
// gate() shows the return-to-full-screen page if the participant is out of full screen, and the trial waits for
// it (it resolves true if the page was shown). If they leave full screen after that and before the circle starts
// (for instance while the keys-up gate waits for W and S to be let go), present() starts nothing and says so,
// and the return page comes first again. A full-screen exit during a trial reaches sequence.js as an
// interruption, through present()'s `interrupted`, like a blur. Without a gate nothing is asked.
//
// The session's own rules (sessionRules.js; Norm, 2026-11-19), in runSession:
//   practice gate  practice runs in sets; after each set the gate decides: go on, another set (after
//                  pages.practiceRetry), or end ('practice_failed'). Vision: one set, no gate.
//   break          before the first main trial once breakAfterMain(planned) main trials have been shown,
//                  pages.breakPage (the participant leaves it when they like); recorded on that trial's row.
//   time limit     checked before every trial (practice, main, repeat) and again after the pages before it; past
//                  it no new trial starts, the trial on screen finishes, and the run ends 'timed_out'.
//   moving average after every main trial, recorded on its row (createMovingCompliance). It never stops anything.
// The order before each trial: time limit, break page, compliance page, time limit again, return-to-full-screen
// page, the trial.

import { practiceTrials } from './trialPlan.js'
import { makeTrialRecord } from './records.js'
import { breakAfterMain, createPracticeGate, createTimeLimit, createMovingCompliance } from './sessionRules.js'

const cancelled = Object.freeze({ cancelled: true })
const NO_REMINDER = Object.freeze({ line: false, page: false })
const before = compliance => (compliance ? compliance.before() : NO_REMINDER)
const after = (compliance, shown) => (compliance ? compliance.after(shown) : null)
const fullscreenGate = async gate => (gate ? !!(await gate()) : false)
const timeUp = timeLimit => !!timeLimit && timeLimit.exceeded()
// what present() reports about full screen and the interruption, for makeTrialRecord
const shownFacts = shown => ({ interruptionReasons: shown.interruptionReasons, fullscreenAtOnset: shown.fullscreenAtOnset })
const defaultClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// The return page (when needed), then the trial; again if full screen was lost before the circle could start.
async function showTrial({ gate, present, req, isCancelled, timeLimit }) {
  let fullscreenReturn = false
  for (;;) {
    if (await fullscreenGate(gate)) fullscreenReturn = true
    if (isCancelled()) return { shown: cancelled, fullscreenReturn }
    if (timeLimit) timeLimit.start()           // the first trial's start is the time limit's origin
    const shown = await present(req)
    if (shown && shown.fullscreen_lost) { fullscreenReturn = true; continue }
    return { shown, fullscreenReturn }
  }
}

/**
 * The practice: sets of the configured trials, each trial followed by afterEach(spec) (the feedback page). Never
 * sent to the engine. With a practice gate (touch, breath), after each set the gate decides; a set that does not
 * pass is followed by retryPage(verdict) and another set, up to the gate's max_sets.
 * @returns {Promise<{ done: true, status: 'completed' } | { status: 'practice_failed' | 'timed_out' } | { cancelled: true }>}
 *   with `gate`: the gate's summary (null without one)
 */
export async function runPractice({ cfg, arm = null, present, sequence, saveTrial, runId, afterEach, retryPage = null, isCancelled = () => false,
  compliance = null, gate = null, timeLimit = null, practiceGate = null }) {
  const specs = practiceTrials(cfg)
  const pg = practiceGate ?? (arm ? createPracticeGate({ cfg, arm }) : null)
  const summary = () => (pg ? pg.summary() : null)
  if (!specs.length) return { done: true, status: 'completed', gate: summary() }
  for (;;) {
    const setNo = (pg ? pg.setsDone : 0) + 1
    let verdict = null
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i]
      if (isCancelled()) return cancelled
      if (timeUp(timeLimit)) return { status: 'timed_out', gate: summary() }
      const reminder = await before(compliance)
      if (isCancelled()) return cancelled
      if (timeUp(timeLimit)) return { status: 'timed_out', gate: summary() }
      const { shown, fullscreenReturn } = await showTrial({ gate, present, req: { phase: 'practice', spec, reminder: reminder.line }, isCancelled, timeLimit })
      if (shown.cancelled) return cancelled
      const comp = after(compliance, shown)
      if (pg) pg.add(comp)
      if (pg && i === specs.length - 1) verdict = pg.closeSet()
      const seq = sequence.nextSeq()
      await saveTrial(makeTrialRecord({ runId, seq, phase: 'practice', spec, pres: shown.pres, answer: shown.answer,
        interrupted: shown.interrupted, focusEvents: shown.focusEvents, keys: shown.keys, tStartMs: shown.tStartMs,
        wallclockStart: shown.wallclockStart, compliance: comp, reminder, fullscreenReturn, ...shownFacts(shown),
        practiceSet: setNo, practiceGate: verdict }))
      if (afterEach) await afterEach(spec)
    }
    if (!pg || verdict.completed) return { done: true, status: 'completed', gate: summary() }
    if (verdict.verdict === 'failed') return { status: 'practice_failed', gate: summary() }
    if (isCancelled()) return cancelled
    if (retryPage) {
      await retryPage(verdict)
      // the retry page repeats the arm's instruction: it stands in for a compliance page reminder now due
      if (compliance && compliance.tracker) compliance.tracker.pageShownElsewhere()
    }
  }
}

// The break: the page (if any) and what to record. `shown` false where nothing is shown (a simulated run).
async function takeBreak({ breakPage, afterMain, afterSeq, clock }) {
  const t0 = clock(), startedAt = new Date().toISOString()
  if (breakPage) await breakPage()
  const t1 = clock()
  return { after_main: afterMain, after_seq: afterSeq, shown: !!breakPage, started_at: startedAt, ended_at: new Date().toISOString(), duration_ms: t1 - t0 }
}

/**
 * The adaptive trials, from init to the engine's last trial (or the time limit).
 * @param {object} o
 * @param {number|null} [o.breakAt]     the break comes before the first main trial after this many (null: none)
 * @param {() => Promise<void>} [o.breakPage]
 * @param {ReturnType<typeof createMovingCompliance>} [o.moving]
 * @param {ReturnType<typeof createTimeLimit>} [o.timeLimit]
 * @returns {Promise<{ init: object, n: number, stopped: null|'timed_out', break: object } | { cancelled: true }>}
 */
export async function runEngineTrials({ engine, cfg, seed, present, sequence, saveTrial, runId, isCancelled = () => false, prestart = true, compliance = null, gate = null,
  breakAt = null, breakPage = null, moving = null, timeLimit = null, clock = defaultClock }) {
  const init = await engine.call({ type: 'init', cfg: cfg.engine, seed })
  let source = init.trial ? { spec: init.trial } : null
  let lastFlag = init.last_trial
  let n = 0, stopped = null, breakFacts = null
  const saves = []
  while (source) {
    if (isCancelled()) return cancelled
    if (timeUp(timeLimit)) { stopped = 'timed_out'; break }
    let breakBefore = null
    if (breakAt !== null && breakAt > 0 && !breakFacts && n >= breakAt) {
      breakBefore = breakFacts = await takeBreak({ breakPage, afterMain: n, afterSeq: sequence.seq, clock })
      if (isCancelled()) return cancelled
    }
    const reminder = await before(compliance)
    if (isCancelled()) return cancelled
    if (timeUp(timeLimit)) { stopped = 'timed_out'; break }   // the break and the pages count toward the limit
    const { shown, fullscreenReturn } = await showTrial({ gate, present, req: { phase: 'main', ...source, reminder: reminder.line }, isCancelled, timeLimit })
    if (shown.cancelled) return cancelled
    if (shown.no_trial) break
    const spec = shown.pres.spec
    const comp = after(compliance, shown)
    const mv = moving ? moving.add(comp) : null
    // the engine gets the answer as sequence.js decides; compliance plays no part in it
    const decision = sequence.mainAnswered({ spec, response: shown.answer.response, interrupted: shown.interrupted })
    const seq = sequence.nextSeq()
    n += 1
    const replyP = engine.call({ type: 'respond', trial_index: spec.trial_index, response: decision.engineResponse })
    const saved = replyP.then(reply => saveTrial(makeTrialRecord({ runId, seq, phase: 'main', spec, pres: shown.pres,
      answer: shown.answer, interrupted: shown.interrupted, focusEvents: shown.focusEvents, keys: shown.keys,
      engineResponse: decision.engineResponse, reply, repeatQueued: decision.repeatQueued, tStartMs: shown.tStartMs,
      wallclockStart: shown.wallclockStart, compliance: comp, reminder, fullscreenReturn, ...shownFacts(shown),
      moving: mv, breakBefore })))
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
  return { init, n, stopped, break: breakFacts ? { taken: true, due_after_main: breakAt, ...breakFacts } : { taken: false, due_after_main: breakAt } }
}

/** The repeats sequence.js queued, each shown once, data only. Stops at the time limit. */
export async function runRepeats({ present, sequence, saveTrial, runId, isCancelled = () => false, compliance = null, gate = null, timeLimit = null }) {
  let r, n = 0
  while (sequence.pendingRepeats > 0) {
    if (isCancelled()) return cancelled
    if (timeUp(timeLimit)) return { n, stopped: 'timed_out' }
    const reminder = await before(compliance)
    if (isCancelled()) return cancelled
    if (timeUp(timeLimit)) return { n, stopped: 'timed_out' }
    r = sequence.takeRepeat()
    const { shown, fullscreenReturn } = await showTrial({ gate, present, req: { phase: 'repeat', spec: r.spec, reminder: reminder.line }, isCancelled, timeLimit })
    if (shown.cancelled) return cancelled
    const seq = sequence.nextSeq()
    n += 1
    await saveTrial(makeTrialRecord({ runId, seq, phase: 'repeat', spec: r.spec, pres: shown.pres, answer: shown.answer,
      interrupted: shown.interrupted, focusEvents: shown.focusEvents, keys: shown.keys, repeatOf: r.repeatOf,
      tStartMs: shown.tStartMs, wallclockStart: shown.wallclockStart, compliance: after(compliance, shown), reminder, fullscreenReturn,
      ...shownFacts(shown) }))
  }
  return { n, stopped: null }
}

/**
 * A whole run: practice (gated), the engine trials (with the break), the repeats, under the time limit.
 * @param {object} o   everything runPractice / runEngineTrials / runRepeats take, plus:
 * @param {string} o.arm
 * @param {number} o.plannedTrials   buildTrialPlan(cfg, seed).counts.total (where the break falls)
 * @param {() => number} [o.clock]   the time limit's and the break's clock (performance.now; a simulated run's own)
 * @param {{ practiceIntro?, practiceFeedback?, practiceRetry?, ready?, beforeMain?, breakPage? }} [o.pages]
 * @returns {Promise<{ status: 'completed'|'timed_out'|'practice_failed', engineStarted: boolean, practice: object|null,
 *   break: object|null, moving: object, main: { n: number }|null, elapsedMs: number, timeLimitMs: number|null } | { cancelled: true }>}
 */
export async function runSession(o) {
  const { cfg, arm, seed, engine, present, sequence, saveTrial, runId, isCancelled = () => false, compliance = null, gate = null,
    clock = defaultClock, pages = {}, plannedTrials, prestart = true } = o
  const timeLimit = o.timeLimit ?? createTimeLimit({ limitMs: cfg.session.max_total_ms, now: clock })
  const practiceGate = createPracticeGate({ cfg, arm })
  const moving = createMovingCompliance({ cfg, arm })
  let engineStarted = false, main = null, brk = null
  const finish = status => ({
    status, engineStarted, main, break: brk, moving: moving.summary(),
    practice: cfg.practice.enabled ? practiceGate.summary() : null,
    elapsedMs: timeLimit.elapsed(), timeLimitMs: timeLimit.limitMs ?? null,
  })
  if (cfg.practice.enabled) {
    if (pages.practiceIntro) await pages.practiceIntro()
    if (isCancelled()) return cancelled
    const pr = await runPractice({ cfg, arm, present, sequence, saveTrial, runId, isCancelled, compliance, gate, timeLimit, practiceGate,
      afterEach: pages.practiceFeedback || null, retryPage: pages.practiceRetry || null })
    if (pr.cancelled) return cancelled
    if (pr.status !== 'completed') return finish(pr.status)
    if (pages.ready) await pages.ready()
    if (isCancelled()) return cancelled
  }
  if (timeUp(timeLimit)) return finish('timed_out')
  if (pages.beforeMain) await pages.beforeMain()
  engineStarted = true
  const breakAt = cfg.session.break_at_half ? breakAfterMain(plannedTrials) : null
  const m = await runEngineTrials({ engine, cfg, seed, present, sequence, saveTrial, runId, isCancelled, prestart, compliance, gate,
    breakAt, breakPage: pages.breakPage || null, moving, timeLimit, clock })
  if (m.cancelled) return cancelled
  main = { n: m.n }
  brk = m.break
  if (m.stopped) return finish(m.stopped)
  const reps = await runRepeats({ present, sequence, saveTrial, runId, isCancelled, compliance, gate, timeLimit })
  if (reps.cancelled) return cancelled
  if (reps.stopped) return finish(reps.stopped)
  return finish('completed')
}
