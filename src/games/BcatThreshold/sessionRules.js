// ── BCAT threshold: the session's own rules (Stage C) ──────────────────────
//
// Pure and node-testable (sessionRules.test.mjs). Four rules Norm set on 2026-11-19 (PLAN.md, "Rulings of
// 2026-11-19"), none of which touches what the engine is told or cfg.engine (configHash unchanged):
//
//   break        one break after half the planned main trials: Math.round(trial plan count / 2) main trials shown,
//                then a page the participant leaves when they like (ruling 5). breakAfterMain.
//   practice     touch and breath only (ruling 12): after each set of practice trials, the mean coverage of the
//   gate         last cfg.practice.gate.window ASSESSED practice trials (a moving window across sets; older trials
//                drop out) must be >= cfg.compliance.min_coverage, the same number as the exclusion criterion
//                (ruling 8). Interrupted or not-assessed trials (compliant null) do not enter the window. With
//                fewer assessed trials than the window holds, the gate is not met (it cannot be shown to be).
//                Not met: another set, after a page with the arm's key instruction, up to max_sets sets; then the
//                session ends. Vision: no gate; practice is completed when its set is done. createPracticeGate.
//   time limit   cfg.session.max_total_ms from the first practice trial's start (the first main trial's when
//                there is no practice); the break counts. Past it no new trial starts. createTimeLimit.
//   moving       during main trials only, over the last cfg.exclusion.moving_window ASSESSED main trials:
//   average      touch and breath the mean coverage, vision the share of trials with any W or S press. Every
//                main trial records the value after it and how many trials it is over; the result records the
//                minimum (touch, breath) or maximum (vision) over FULL windows only, and, for touch and breath,
//                whether a full window ever fell below min_coverage (exclusion_flag_coverage). With no full
//                window those are null: a partial window is not evidence either way. Vision has no threshold.
//                A flag only, it never stops the session. createMovingCompliance.

import { armUsesPacerKeys } from './keysGate.js'

/** How many main trials come before the break: half the planned count, rounded to the nearest trial. */
export function breakAfterMain(plannedTrials) {
  const n = Number(plannedTrials)
  if (!Number.isFinite(n) || n < 0) throw new Error('breakAfterMain: plannedTrials must be a number >= 0')
  return Math.round(n / 2)
}

const mean = a => a.reduce((s, x) => s + x, 0) / a.length
const isAssessed = c => !!c && c.compliant !== null && c.compliant !== undefined

/**
 * The practice gate of one session.
 * @param {{ cfg: object, arm: string }} o
 * add(compliance) after every practice trial (compliance.js's assessment: { compliant, coverage }), closeSet()
 * after the last trial of each set. restore(rows) replays saved practice rows (chain order) into it.
 */
export function createPracticeGate({ cfg, arm }) {
  const g = cfg.practice.gate
  const gated = armUsesPacerKeys(arm) && !!g.enabled
  const threshold = cfg.compliance.min_coverage
  const assessed = []          // coverage of every assessed practice trial, in the order shown
  let setsDone = 0, completed = false, passed = null
  const sets = []              // the verdict of each closed set
  const api = {
    get gated() { return gated },
    get setsDone() { return setsDone },
    get completed() { return completed },
    get passed() { return passed },
    /** One practice trial ended. Only assessed trials with a coverage enter the window. */
    add(compliance) {
      if (isAssessed(compliance) && typeof compliance.coverage === 'number') assessed.push(compliance.coverage)
    },
    /**
     * A set ended: the verdict, recorded on that set's last trial row.
     * @returns {{ set: number, gated: boolean, window: number[], n: number, mean: number|null, threshold: number|null,
     *   verdict: 'passed'|'retry'|'failed'|'not_gated', completed: boolean, passed: boolean|null }}
     */
    closeSet() {
      setsDone += 1
      let v
      if (!gated) {
        v = { set: setsDone, gated: false, window: [], n: 0, mean: null, threshold: null, verdict: 'not_gated', completed: true, passed: null }
      } else {
        const window = assessed.slice(-g.window)
        const m = window.length ? mean(window) : null
        const met = window.length === g.window && m >= threshold
        const verdict = met ? 'passed' : setsDone < g.max_sets ? 'retry' : 'failed'
        v = { set: setsDone, gated: true, window, n: window.length, mean: m, threshold, verdict, completed: met, passed: met ? true : verdict === 'failed' ? false : null }
      }
      sets.push(v)
      if (v.completed) completed = true
      if (v.verdict === 'passed') passed = true
      else if (v.verdict === 'failed') passed = false
      return v
    },
    /** Resume: replay saved practice rows (chain order) into the gate; a set counts once it has a verdict. */
    restore(rows) {
      for (const r of rows || []) {
        if (r.phase !== 'practice') continue
        api.add({ compliant: r.compliant, coverage: r.compliance_coverage })
        const pg = r.practice_gate
        if (pg && typeof pg === 'object' && pg.verdict) {
          setsDone = Math.max(setsDone + 1, Number(pg.set) || 0)
          sets.push(pg)
          if (pg.completed) completed = true
          if (pg.verdict === 'passed') passed = true
          else if (pg.verdict === 'failed') passed = false
        }
      }
      return api
    },
    /** For the result row. */
    summary() {
      return { gated, sets_used: setsDone, completed, passed: gated ? passed : null, sets: sets.map(s => ({ ...s, window: [...(s.window || [])] })) }
    },
  }
  return api
}

/**
 * The time limit. `now` is the clock the limit runs on (performance.now live; a simulated run's own clock).
 * @param {{ limitMs: number|null, now: () => number }} o
 */
export function createTimeLimit({ limitMs, now }) {
  let origin = null, carried = 0
  const elapsed = () => carried + (origin === null ? 0 : now() - origin)
  return {
    get limitMs() { return limitMs },
    get started() { return origin !== null },
    /** The first practice (or main) trial starts now. Later calls do nothing. */
    start() { if (origin === null) origin = now() },
    /** Resume: this much had passed since the chain's first trial; the limit keeps running from there. */
    resumeFrom(elapsedMs) { carried = Math.max(0, Number(elapsedMs) || 0); origin = now() },
    elapsed,
    /** Past the limit: no new trial may start. */
    exceeded() { return limitMs !== null && limitMs !== undefined && origin !== null && elapsed() >= limitMs },
  }
}

/**
 * The moving average during main trials. add(compliance) after each main trial returns what that trial records.
 * @param {{ cfg: object, arm: string }} o
 */
export function createMovingCompliance({ cfg, arm }) {
  const N = cfg.exclusion.moving_window
  const pacer = armUsesPacerKeys(arm)
  const threshold = cfg.compliance.min_coverage
  const values = []
  let extreme = null, everBelow = false, nFull = 0
  const api = {
    /**
     * @returns {{ coverage_moving_avg: number|null, ws_press_moving_share: number|null, moving_window_n: number }}
     */
    add(compliance) {
      if (isAssessed(compliance)) {
        const v = pacer ? compliance.coverage : (compliance.ws_presses > 0 ? 1 : 0)
        if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
      }
      const w = values.slice(-N)
      const m = w.length ? mean(w) : null
      if (w.length === N) {
        nFull += 1
        extreme = extreme === null ? m : pacer ? Math.min(extreme, m) : Math.max(extreme, m)
        if (pacer && m < threshold) everBelow = true
      }
      return { coverage_moving_avg: pacer ? m : null, ws_press_moving_share: pacer ? null : m, moving_window_n: w.length }
    },
    /** Resume: replay the saved main rows (chain order). */
    restore(rows) {
      for (const r of rows || []) if (r.phase === 'main') api.add({ compliant: r.compliant, coverage: r.compliance_coverage, ws_presses: r.compliance_ws_presses })
      return api
    },
    /** For the result row. */
    summary() {
      return {
        moving_window: N,
        moving_n_full_windows: nFull,
        coverage_moving_avg_min: pacer ? extreme : null,
        exclusion_flag_coverage: pacer && nFull > 0 ? everBelow : null,
        ws_press_moving_share_max: pacer ? null : extreme,
      }
    },
  }
  return api
}
