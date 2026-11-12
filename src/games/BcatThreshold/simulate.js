// ── BCAT threshold: a simulated participant (preview and tests only) ───────
//
// Pure and node-testable. A presenter with the live one's contract (session.js) that shows nothing: a
// SimulatedObserver (engine/adaptive.js) answers each trial at once, and in the touch and breath arms it
// also "holds" W and S along with the schedule, a little late, so the key log and its scoring are
// exercised. Planned and delivered boundaries are the same; timing.simulated is true on every row.
// Settings are the test build's (6_online_pilot/js/config.js, online.simulation).
//
// Reachable only from a preview (BcatThreshold.jsx refuses it in a study run).

import { SimulatedObserver, makeRng } from './engine/adaptive.js'
import { timelineForTrial, halfPulses } from './pacerClock.js'
import { createKeyLog, parseKeyLog, scoreHolds } from './keyLog.js'
import { plannedBoundaries } from './trialLoop.js'

export const SIM_OBSERVER = Object.freeze({ alpha_speeding: 0.17, alpha_slowing: 0.12, beta_speeding: 1.4, beta_slowing: 0.7, criterion: 1.25, lapse_rate: 0.04, miss_slowing: 0.0 })
export const SIM_TIMING = Object.freeze({ rt_median_ms: 1200, key_lag_ms: 250, key_lag_sd_ms: 80 })

/**
 * @param {{ cfg: object, arm: string, seed: number, observer?: object, timing?: object }} o
 * @returns {(req: { phase: string, spec?: object, specPromise?: Promise<object|null> }) => Promise<object>}
 */
export function createSimulatedPresenter({ cfg, arm, seed, observer = SIM_OBSERVER, timing = SIM_TIMING }) {
  const rng = makeRng((seed ^ 0x5bd1e995) >>> 0)
  const obs = new SimulatedObserver({ ...observer })
  const answerKey = cfg.keys.answers
  let clock = 0
  return async function present({ spec, specPromise }) {
    if (!spec) spec = await specPromise
    if (!spec) return { no_trial: true }
    const tl = timelineForTrial(spec, cfg)
    const planned = plannedBoundaries(tl)
    const total = tl.totalMs
    const log = createKeyLog(cfg.keys)
    log.begin(0, [])
    if (arm !== 'vision') {
      const evs = []
      for (const h of halfPulses(tl)) {
        const k = h.phase === 'grow' ? cfg.keys.grow : cfg.keys.shrink
        const down = h.startMs + timing.key_lag_ms + timing.key_lag_sd_ms * rng.normal()
        const up = Math.min(h.endMs + timing.key_lag_ms + timing.key_lag_sd_ms * rng.normal(), total)
        if (down < up) { evs.push({ type: 'keydown', k, t: down }); evs.push({ type: 'keyup', k, t: up }) }
      }
      evs.sort((a, b) => a.t - b.t)
      for (const e of evs) log[e.type]({ key: e.k.key, code: e.k.code, t: e.t, tHandler: e.t + 1 })
    }
    const ended = log.end(total, [])
    const summary = scoreHolds(parseKeyLog(ended.events, { endMs: total }), halfPulses(tl)).summary
    const response = obs.respond(spec, rng)
    const rtMs = timing.rt_median_ms * Math.exp(0.35 * rng.normal())
    const pulses = planned.slice(1, -1).map((b, i) => planned[i + 2] - b)
    const t0 = clock
    clock += total + rtMs
    return {
      pres: {
        spec, timeline: tl, t0, t_end: total,
        planned_boundaries_ms: planned, delivered_boundaries_ms: planned.slice(), boundary_error_ms: planned.map(() => 0),
        planned_pulses_ms: pulses, delivered_pulses_ms: pulses.slice(),
        n_frames: null, dropped_frames: null, max_frame_gap_ms: null, frame_period_ms: null,
        level_ready_ms: 0, level_wait_ms: 0, simulated: true,
      },
      answer: { response, key: answerKey[response], rtMs, questionOnsetMs: total },
      interrupted: false,
      focusEvents: [],
      keys: { events: ended.events, repeats: ended.repeats, blurs: ended.blurs, summary },
      tStartMs: t0,
      wallclockStart: null,
    }
  }
}
