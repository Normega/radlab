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
// participant's. It never skips or reorders a saved trial. Every saved trial must carry a `response`
// field: null is an unanswered trial, a missing field is an error (a row that lost its answer is not an
// unanswered trial).
//
// What trial matching does NOT guard. It is a consistency check, not an identity check. With few saved
// trials a wrong seed (or a slightly different config) very often offers the same first trials, so the
// replay is accepted and continues on another session's schedule. Measured by the reviewer (2026-11-12),
// a wrong seed is accepted 39% of the time with 1 saved trial, 15% with 2, 4.7% with 3 and 1.3% with 5.
// The real guard is what the run row stores: its seed, ENGINE_VERSION and configHash(cfg.engine). Pass
// the seed from the row, never a recomputed one, and pass the other two as `expect`:
//
//   replay(trials, cfg.engine, run.seed, { expect: { engine_version: run.engine_version, config_hash: run.config_hash } })
//
// replay then throws ReplayMismatchError before replaying anything if the code's ENGINE_VERSION or the
// config's hash differs from the stored ones. `expect` is optional only so the tests and tools can replay
// without a run row; production resume must pass it.

import { AdaptiveSession, makeRng, RESPONSES } from './adaptive.js'
import { ENGINE_VERSION, configHash } from '../config.js'

const LEVEL_TOL = 1e-12

/** The part of a trial and its answer that replay needs. `response` is 'slowed' | 'same' | 'sped_up' | null. */
export function savedTrial(trial, response) {
  if (response === undefined) throw new TypeError('savedTrial: response is required (null for an unanswered trial)')
  return { trial_index: trial.trial_index, cell: trial.cell, placement: trial.placement, magnitude: trial.magnitude, response }
}

export class ReplayMismatchError extends Error {
  constructor(message, details) {
    super(message)
    this.name = 'ReplayMismatchError'
    this.details = details
  }
}

function checkExpect(expect, cfg) {
  if (expect === undefined) return
  if (!expect || typeof expect !== 'object') throw new TypeError('replay: opts.expect must be { engine_version, config_hash }')
  const { engine_version: version, config_hash: hash } = expect
  if (typeof version !== 'string' || typeof hash !== 'string') {
    throw new TypeError('replay: opts.expect needs both engine_version and config_hash (strings, as stored on the run row)')
  }
  if (version !== ENGINE_VERSION) {
    throw new ReplayMismatchError(`the run was made by engine ${version}; this code is ${ENGINE_VERSION}`,
      { field: 'engine_version', stored: version, current: ENGINE_VERSION })
  }
  const current = configHash(cfg)
  if (hash !== current) {
    throw new ReplayMismatchError(`the run's config hash ${hash} differs from this config's ${current}`,
      { field: 'config_hash', stored: hash, current })
  }
}

/**
 * Replay saved trials, in order, through a fresh session built from (cfg, seed).
 * @param {Array<{trial_index:number, cell:string, placement:string, magnitude:number, response:string|null}>} trials
 * @param {object} cfg  the engine config (makeConfig().engine)
 * @param {number} seed the run's stored seed: an integer in [0, 2^32), anything else throws
 * @param {{ expect?: { engine_version: string, config_hash: string } }} [opts]
 *   expect — the run row's stored ENGINE_VERSION and configHash(cfg); checked before anything is replayed
 * @returns {{ session: AdaptiveSession, next: object|null, finished: boolean, running: object, history: object, n_replayed: number }}
 *   next — the trial the live run would show after these (null when the session is over); running — the
 *   posterior summary columns after the last replayed answer, as the live controller reports them.
 */
export function replay(trials, cfg, seed, opts = {}) {
  if (!Array.isArray(trials)) throw new TypeError('replay: trials must be an array')
  checkExpect(opts.expect, cfg)
  const session = new AdaptiveSession(cfg, makeRng(seed))
  trials.forEach((saved, i) => {
    const where = `saved trial ${i + 1} (trial_index ${saved && saved.trial_index})`
    if (!saved || typeof saved !== 'object') throw new ReplayMismatchError(`${where}: not a saved trial`, { saved })
    if (!Object.prototype.hasOwnProperty.call(saved, 'response') || saved.response === undefined) {
      throw new ReplayMismatchError(`${where}: no response field (use null for an unanswered trial)`, { saved })
    }
    const t = session.nextTrial()
    if (!t) throw new ReplayMismatchError(`${where}: the replayed session had already finished`, { saved })
    const same = t.trial_index === saved.trial_index && t.cell === saved.cell && t.placement === saved.placement &&
      Math.abs(Number(t.magnitude) - Number(saved.magnitude)) <= LEVEL_TOL
    if (!same) {
      throw new ReplayMismatchError(
        `${where}: replay offers ${t.cell}/${t.placement} at ${t.magnitude}, saved ${saved.cell}/${saved.placement} at ${saved.magnitude}`,
        { saved, replayed: { trial_index: t.trial_index, cell: t.cell, placement: t.placement, magnitude: t.magnitude } })
    }
    const response = saved.response
    if (response !== null && !RESPONSES.includes(response)) throw new ReplayMismatchError(`${where}: unknown response ${response}`, { saved })
    session.recordResponse(t, response)
  })
  const running = session.runningColumns()
  const next = session.nextTrial()
  return { session, next, finished: next === null, running, history: session.history(), n_replayed: trials.length }
}
