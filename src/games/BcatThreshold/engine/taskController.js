// ── BCAT threshold: the engine controller the task runs (Stage C) ──────────
//
// Pure and node-testable (resume.test.mjs). makeController (adaptive.js, unchanged) with one more message,
// `restore`, for resuming a session after a reload:
//
//   {type:'restore', cfg, seed, trials, expect}  ->  {type:'trial', trial, finished, last_trial, n_replayed, replay_ms, restored: true, running}
//
// The saved engine trials are fed through the SAME controller, as init then one respond per trial, so the state
// after a restore is the controller's own, bit for bit, and every later respond behaves as in an uninterrupted
// run (no second code path for the posterior). Before anything is replayed, `expect` (the run row's stored
// engine_version and config_hash) is checked against this code and config (replay.js, checkExpect); a mismatch
// throws, and the worker answers with an error: the old run is not continued (fail closed). Each saved trial is
// checked against the trial the controller offers at that point (trial_index, cell, placement, level), as
// replay() does; any difference throws. `trials` are savedTrial(row, row.engine_response) in chain order.
// The reply has init's shape, so the caller treats it as the start of the engine trials.

import { makeController } from './adaptive.js'
import { checkExpect, ReplayMismatchError } from './replay.js'

const LEVEL_TOL = 1e-12

export function makeTaskController(now) {
  const clock = now || (() => performance.now())
  const handle = makeController(now)
  return function task(msg) {
    if (msg.type === 'hello') return { type: 'hello' }   // engineClient.ready(): is the worker up? (review item 9)
    if (msg.type !== 'restore') return handle(msg)
    if (!Array.isArray(msg.trials)) throw new TypeError('restore: trials must be an array')
    if (msg.expect === undefined) throw new TypeError('restore: expect (the run row\'s engine_version and config_hash) is required')
    checkExpect(msg.expect, msg.cfg)
    const t0 = clock()
    const init = handle({ type: 'init', cfg: msg.cfg, seed: msg.seed })
    let current = init.trial, lastTrial = init.last_trial, running = init.prior_running
    msg.trials.forEach((saved, i) => {
      const where = `saved trial ${i + 1} (trial_index ${saved && saved.trial_index})`
      if (!saved || typeof saved !== 'object' || saved.response === undefined) throw new ReplayMismatchError(`${where}: not a saved trial with a response field`, { saved })
      if (!current) throw new ReplayMismatchError(`${where}: the restored session had already finished`, { saved })
      const same = current.trial_index === saved.trial_index && current.cell === saved.cell && current.placement === saved.placement &&
        Math.abs(Number(current.magnitude) - Number(saved.magnitude)) <= LEVEL_TOL
      if (!same) {
        throw new ReplayMismatchError(`${where}: restore offers ${current.cell}/${current.placement} at ${current.magnitude}, saved ${saved.cell}/${saved.placement} at ${saved.magnitude}`,
          { saved, offered: { trial_index: current.trial_index, cell: current.cell, placement: current.placement, magnitude: current.magnitude } })
      }
      const r = handle({ type: 'respond', trial_index: current.trial_index, response: saved.response })
      current = r.next_trial
      lastTrial = r.last_trial
      running = r.running
    })
    return { type: 'trial', restored: true, trial: current, finished: current === null, last_trial: lastTrial, running,
      n_replayed: msg.trials.length, replay_ms: clock() - t0 }
  }
}
