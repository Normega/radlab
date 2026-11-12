// ── Rebuild an adaptive session from its saved trials ──────────────────────
//
// Pure and node-testable. The engine is deterministic: the same config and seed, fed the same answers in
// the same order, make the same queue shuffles, the same posterior and the same level choices, bit for
// bit. So a session is resumed by replaying its saved trials from scratch (PLAN.md section 4, "Reload and
// resume"): the posterior after the replay, and the next trial it offers, are those of the live run.
//
// Each saved trial is checked against the trial the replayed session offers at that point. Any
// difference (another trial type, placement or level) means the saved list, the config or the seed is not
// the one the run used; replay then throws instead of continuing on a posterior that is not the
// participant's. It never skips or reorders a saved trial.

import { AdaptiveSession, makeRng, RESPONSES } from './adaptive.js'

const LEVEL_TOL = 1e-12

/** The part of a trial and its answer that replay needs. `response` is 'slowed' | 'same' | 'sped_up' | null. */
export function savedTrial(trial, response) {
  return { trial_index: trial.trial_index, cell: trial.cell, placement: trial.placement, magnitude: trial.magnitude, response }
}

export class ReplayMismatchError extends Error {
  constructor(message, details) {
    super(message)
    this.name = 'ReplayMismatchError'
    this.details = details
  }
}

/**
 * Replay saved trials, in order, through a fresh session built from (cfg, seed).
 * @param {Array<{trial_index:number, cell:string, placement:string, magnitude:number, response:string|null}>} trials
 * @returns {{ session: AdaptiveSession, next: object|null, finished: boolean, running: object, history: object, n_replayed: number }}
 *   next — the trial the live run would show after these (null when the session is over); running — the
 *   posterior summary columns after the last replayed answer, as the live controller reports them.
 */
export function replay(trials, cfg, seed) {
  if (!Array.isArray(trials)) throw new TypeError('replay: trials must be an array')
  const session = new AdaptiveSession(cfg, makeRng(seed))
  trials.forEach((saved, i) => {
    const t = session.nextTrial()
    const where = `saved trial ${i + 1} (trial_index ${saved && saved.trial_index})`
    if (!t) throw new ReplayMismatchError(`${where}: the replayed session had already finished`, { saved })
    const same = t.trial_index === saved.trial_index && t.cell === saved.cell && t.placement === saved.placement &&
      Math.abs(Number(t.magnitude) - Number(saved.magnitude)) <= LEVEL_TOL
    if (!same) {
      throw new ReplayMismatchError(
        `${where}: replay offers ${t.cell}/${t.placement} at ${t.magnitude}, saved ${saved.cell}/${saved.placement} at ${saved.magnitude}`,
        { saved, replayed: { trial_index: t.trial_index, cell: t.cell, placement: t.placement, magnitude: t.magnitude } })
    }
    const response = saved.response === undefined ? null : saved.response
    if (response !== null && !RESPONSES.includes(response)) throw new ReplayMismatchError(`${where}: unknown response ${response}`, { saved })
    session.recordResponse(t, response)
  })
  const running = session.runningColumns()
  const next = session.nextTrial()
  return { session, next, finished: next === null, running, history: session.history(), n_replayed: trials.length }
}
