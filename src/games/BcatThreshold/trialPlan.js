// ── BCAT threshold trial plan ───────────────────────────────────────────────
//
// Pure and node-testable. The seeded, deterministic order of a session's trials: which direction (or no
// change, or a catch trial) comes when, and which change trials are reserved at fixed d' levels. Only the
// levels of the adaptive and reserved trials are left open; the engine picks them as the session runs.
//
// This is the scheduler of AdaptiveSession (engine/adaptive.js: _refillQueue, _nextCell, _catchPending,
// reservedPlacement) run without the posterior, using the same seeded RNG and the same shuffle calls. So for
// one config and seed it gives exactly the trial order the engine will produce; trialPlan.test.mjs checks
// that against live sessions. The engine stays the authority during a run: Stage B can compare each trial
// the worker sends with plan.main[i] and stop on a mismatch.
//
//   - change trials per direction: engine.stopping.change_trials_per_cell (online 30, lab 40)
//   - no-change trials: refilled with each block so they are no_change_rate (25%) of all non-catch trials
//   - reserved trials: change trials 6, 9, 12, ... of a direction are fixed at d' 0.5, 3, 0.5, ... (their level
//     comes from the current posterior, so it is still left open here)
//   - catch trials: if enabled, n_trials slowing trials at magnitude ln 2 (8-s pulses), placed after slowing
//     change trials round((i + 1) N / (n + 1)), e.g. 6, 12, 18, 24 with N = 30
//   - practice trials: config.practice.trials, in their listed order (no randomness, as the source build)
//
// The order does not depend on the answers as long as every trial is answered (the online build waits for
// an answer; a missing one would not count toward its direction). It does depend on them under the
// precision stopping rule, so that rule is refused here.

import {
  CELLS, NO_CHANGE, makeRng, roundHalfEven, maxTrials, reservedPlacement, validateConfig, clampMagnitude, num,
  signedLogRatio, changedPulseDuration, pulseSchedule, changeIndex,
} from './engine/adaptive.js'

const PLACEMENTS_THAT_UPDATE = ['infogain', 'fixed_sub', 'fixed_supra']

function trialFields(st, cell, magnitude) {
  if (magnitude === null) {
    return { magnitude: null, log_ratio: null, changed_pulse_s: null, pulse_durations_s: null }
  }
  const lr = signedLogRatio(cell, magnitude)
  return { magnitude, log_ratio: lr, changed_pulse_s: changedPulseDuration(st.baseline_pulse_s, lr), pulse_durations_s: pulseSchedule(st, lr) }
}

/** Practice trials as trial specs (the source build's practiceSpec). */
export function practiceTrials(cfg) {
  if (!cfg.practice.enabled) return []
  const st = cfg.engine.stimulus
  return cfg.practice.trials.map((p, i) => {
    const cell = p.cell
    const m = cell === NO_CHANGE ? 0 : clampMagnitude(num(p.magnitude), st)[0]
    const lr = signedLogRatio(cell, m)
    return { trial_index: i + 1, cell, placement: 'practice', is_change: cell !== NO_CHANGE, cell_trial_index: i + 1,
      requested_magnitude: m, magnitude: m, log_ratio: lr, clamped: false, reference_threshold: null, target_dprime: null,
      baseline_pulse_s: st.baseline_pulse_s, changed_pulse_s: changedPulseDuration(st.baseline_pulse_s, lr),
      pulse_durations_s: pulseSchedule(st, lr), n_lead_in_pulses: Number(st.n_lead_in_pulses),
      change_after_pulse: Number(st.change_after_pulse), change_index: changeIndex(st) }
  })
}

/**
 * @param {object} cfg  from makeConfig()
 * @param {number} seed the session's seed (the same one the engine's init message gets)
 * @param {{ shuffle?: (items: string[]) => string[] }} [opts]  shuffle: replace the seeded shuffle (the tests inject
 *   the Python reference sessions' queue orders, as engine.test.mjs does)
 * @returns {{ seed, practice: object[], main: object[], queues: string[][], counts: object }}
 *   queues — each block as shuffled, in order
 *   main[i]: { trial_index, cell, placement, is_change, cell_trial_index, level_known, queue,
 *              magnitude, log_ratio, changed_pulse_s, pulse_durations_s }  (the last four null until the engine picks the level)
 */
export function buildTrialPlan(cfg, seed, opts = {}) {
  const ecfg = cfg.engine
  validateConfig(ecfg)
  if (ecfg.stopping.precision_rule.enabled) throw new Error('The precision stopping rule makes the trial order depend on the answers; no fixed plan exists.')
  const st = ecfg.stimulus, design = ecfg.design, ct = design.catch_trials
  const rng = makeRng(seed)
  const shuffle = opts.shuffle || (items => rng.shuffle(items))
  const queues = []
  const N = maxTrials(ecfg)
  const nUpdates = { speeding: 0, slowing: 0 }     // proc.cells[c].n_trials
  const cellCounts = { speeding: 0, slowing: 0 }   // cell_counts (every change trial shown)
  const done = c => nUpdates[c] >= N
  const nCatch = ct.enabled ? Number(ct.n_trials) : 0
  const catchDue = []
  for (let i = 0; i < nCatch; i++) catchDue.push(roundHalfEven((i + 1) * N / (nCatch + 1)))
  let queue = [], nQueues = 0, emittedChange = 0, emittedNoChange = 0, trialIndex = 0

  const catchPending = () => catchDue.length > 0 && nUpdates[ct.cell] >= catchDue[0]
  const finished = () => CELLS.every(done) && !catchPending()
  const refill = () => {
    const rate = design.no_change_rate, k = Number(design.block_change_trials_per_cell)
    const cells = design.after_cell_stops === 'filler' ? CELLS.slice() : CELLS.filter(c => !done(c))
    let items = []
    for (const c of cells) for (let i = 0; i < k; i++) items.push(c)
    const targetNc = rate / (1 - rate) * (emittedChange + items.length)
    const nNc = Math.max(0, roundHalfEven(targetNc - emittedNoChange))
    for (let i = 0; i < nNc; i++) items.push(NO_CHANGE)
    items = shuffle(items)
    queues.push(items.slice())
    queue = items
    nQueues += 1
  }
  const nextCell = () => {
    for (let i = 0; i < 1000; i++) {
      if (!queue.length) refill()
      const item = queue.shift()
      if (item === NO_CHANGE || !done(item)) return item
      if (design.after_cell_stops === 'filler') return item
    }
    throw new Error('Scheduler could not find a trial.')
  }

  const main = []
  let nNoChange = 0
  while (!finished()) {
    if (catchPending()) {
      catchDue.shift()
      const cell = ct.cell, [m] = clampMagnitude(num(ct.magnitude), st)
      trialIndex += 1
      main.push({ trial_index: trialIndex, cell, placement: 'catch', is_change: true, cell_trial_index: cellCounts[cell] + 1,
        level_known: true, queue: nQueues, ...trialFields(st, cell, m) })
      cellCounts[cell] += 1
      continue
    }
    const cell = nextCell()
    trialIndex += 1
    if (cell === NO_CHANGE) {
      emittedNoChange += 1
      main.push({ trial_index: trialIndex, cell: NO_CHANGE, placement: NO_CHANGE, is_change: false, cell_trial_index: nNoChange + 1,
        level_known: true, queue: nQueues, ...trialFields(st, NO_CHANGE, 0) })
      nNoChange += 1
      continue
    }
    emittedChange += 1
    const placement = done(cell) ? 'filler' : reservedPlacement(ecfg, nUpdates[cell])
    main.push({ trial_index: trialIndex, cell, placement, is_change: true, cell_trial_index: cellCounts[cell] + 1,
      level_known: false, queue: nQueues, ...trialFields(st, cell, null) })
    cellCounts[cell] += 1
    if (PLACEMENTS_THAT_UPDATE.includes(placement)) nUpdates[cell] += 1
  }

  const count = f => main.filter(f).length
  return {
    seed,
    practice: practiceTrials(cfg),
    main,
    queues,
    counts: {
      total: main.length,
      change: { speeding: count(t => t.cell === 'speeding' && t.placement !== 'catch'), slowing: count(t => t.cell === 'slowing' && t.placement !== 'catch') },
      no_change: count(t => t.cell === NO_CHANGE),
      catch: count(t => t.placement === 'catch'),
      infogain: count(t => t.placement === 'infogain'),
      fixed_supra: count(t => t.placement === 'fixed_supra'),
      fixed_sub: count(t => t.placement === 'fixed_sub'),
      filler: count(t => t.placement === 'filler'),
      queues: nQueues,
    },
  }
}
