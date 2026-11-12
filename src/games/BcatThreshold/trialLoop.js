// ── BCAT threshold: one circle, frame by frame ─────────────────────────────
//
// Pure and node-testable (trialLoop.test.mjs): requestAnimationFrame, the clock and the drawing are passed
// in, so the tests drive it with a fake frame clock. No React: render() writes the size straight to the DOM.
//
// Timing (PLAN.md section 3, "Timing rules"):
//   - one absolute start time per trial: t0 is the time stamp of the first frame (fixation onset), and every
//     frame looks the circle up in the trial's precomputed schedule at (frame time - t0), pacerClock.circleAt.
//     A late or dropped frame never stretches a pulse or shifts the next one.
//   - a boundary counts as delivered on the first frame at or after (planned - half a frame), as in the test
//     build and the PsychoPy prototype; delivered pulse durations are differences of those frame times.
//   - per trial: planned and delivered boundaries (fixation onset, each pulse start, the end), dropped frames
//     (a gap over 1.5 frame periods counts round(gap / period) - 1), the longest frame gap, frame count.
//
// Starting before the level is known. The first n_lead_in + change_after_pulse pulses (in the approved
// config no lead-in and two baseline pulses: the first changed pulse is due 1.5 + 8 = 9.5 s after fixation
// onset) are always at the baseline pace, so a trial can start while the engine still computes its level
// (Stage A notes). Until the spec arrives the circle runs a provisional
// all-baseline schedule; if it is still missing when the first changed pulse is due, the circle holds still
// at its smallest size until it comes (level_wait_ms > 0 flags such a trial; the boundaries after it are
// planned from the end of the hold). Expected never to happen: an update takes about 50-300 ms.

import { buildTimeline, timelineForTrial, circleAt } from './pacerClock.js'

/** The pulse count before the first changed pulse: the part of the schedule known without the level. */
export function knownPrefix(cfg) {
  const st = cfg.engine.stimulus
  return Number(st.n_lead_in_pulses) + Number(st.change_after_pulse)
}

/** The all-baseline schedule a trial runs while its level is on the way. */
export function provisionalTimeline(cfg) {
  const st = cfg.engine.stimulus
  const n = Number(st.n_lead_in_pulses) + Number(st.n_pulses)
  return buildTimeline(Array(n).fill(Number(st.baseline_pulse_s)), {
    fixationMs: cfg.timing.fixation_ms, nLeadIn: Number(st.n_lead_in_pulses), changeIndex: null,
    minScale: cfg.display.circle_min_size, maxScale: cfg.display.circle_max_size,
  })
}

/** [fixation onset, each pulse start, the end], in ms from fixation onset. */
export function plannedBoundaries(timeline) {
  return [0, ...timeline.pulses.map(p => p.startMs), timeline.totalMs]
}

/**
 * Show one circle. Resolves when the last pulse ends, with the presentation record.
 * @param {object} o
 * @param {object} o.cfg               makeConfig()
 * @param {object|null} [o.spec]       the trial, if known now
 * @param {Promise<object|null>} [o.specPromise]  otherwise: resolves to the trial (null: there is none)
 * @param {(cb: (ts: number) => void) => any} o.raf   requestAnimationFrame
 * @param {() => number} o.now         performance.now
 * @param {number} o.framePeriodMs     measured before the task (median frame interval)
 * @param {(scale: number, state: object|null) => void} o.render  write the circle (scale = diameter / window height)
 * @param {(t0: number) => void} [o.onStart]   called in the first frame, before drawing it (begin the key log)
 * @param {(ts: number, t0: number) => void} [o.onEnd]  called in the last frame (end the key log, show the question)
 * @param {() => boolean} [o.isCancelled]
 * @returns {Promise<object>} the record; { no_trial: true } if specPromise gave null; { cancelled: true } if cancelled
 */
export function presentCircle(o) {
  const { cfg, raf, now, render, onStart, onEnd, isCancelled = () => false } = o
  const P = Number(o.framePeriodMs) > 0 ? Number(o.framePeriodMs) : 1000 / 60
  const half = P / 2
  const prefixN = knownPrefix(cfg)
  let spec = o.spec || null
  let timeline = spec ? timelineForTrial(spec, cfg) : provisionalTimeline(cfg)
  const prefixEndMs = timeline.pulses[prefixN] ? timeline.pulses[prefixN].startMs : timeline.totalMs
  const minScale = cfg.display.circle_min_size
  let t0 = null, last = null, nFrames = 0, dropped = 0, maxGap = 0
  let hold = 0, holdStart = null, specKnownAt = spec ? 0 : null, noTrial = false, failed = null
  let nextB = 1
  const delivered = []

  if (!spec) {
    if (!o.specPromise || typeof o.specPromise.then !== 'function') throw new Error('presentCircle: spec or specPromise is required')
    o.specPromise.then(s => {
      if (!s) { noTrial = true; return }
      spec = s
      timeline = timelineForTrial(s, cfg)
      specKnownAt = t0 === null ? 0 : now() - t0
    }, err => { failed = err || new Error('the trial could not be prepared') })
  }

  return new Promise((resolve, reject) => {
    const frame = ts => {
      if (isCancelled()) { resolve({ cancelled: true }); return }
      if (t0 === null) {
        t0 = ts; last = ts; nFrames = 1
        delivered[0] = 0
        if (onStart) onStart(t0)
        render(minScale, null)
        raf(frame)
        return
      }
      const iv = ts - last
      last = ts; nFrames += 1
      if (iv > maxGap) maxGap = iv
      if (iv > 1.5 * P) dropped += Math.round(iv / P) - 1
      if (failed) { reject(failed); return }
      if (noTrial) { render(minScale, null); resolve({ no_trial: true, t0 }); return }
      if (!spec && ts - t0 - hold >= prefixEndMs - half) {
        // the level is not here yet: hold at the smallest size (where every pulse starts) until it is
        if (holdStart === null) holdStart = ts
        render(minScale, null)
        raf(frame)
        return
      }
      if (holdStart !== null) { hold += ts - holdStart; holdStart = null }
      const el = ts - t0 - hold
      const planned = plannedBoundaries(timeline)
      while (nextB < planned.length && el >= planned[nextB] - half) { delivered[nextB] = ts - t0; nextB += 1 }
      if (el >= timeline.totalMs - half) {
        render(minScale, null)
        if (onEnd) onEnd(ts, t0)
        // the schedule as it ran: boundaries after a hold are planned from the end of the hold
        const plannedAbs = planned.map((b, i) => (i > prefixN && hold > 0 ? b + hold : b))
        const plannedPulses = plannedAbs.slice(1).map((b, i, a) => (i + 1 < a.length ? a[i + 1] - b : null)).slice(0, -1)
        const deliveredPulses = delivered.slice(1).map((b, i, a) => (i + 1 < a.length ? a[i + 1] - b : null)).slice(0, -1)
        resolve({
          spec, timeline, t0, t_end: ts - t0,
          planned_boundaries_ms: plannedAbs,
          delivered_boundaries_ms: delivered.slice(),
          boundary_error_ms: delivered.map((d, i) => d - plannedAbs[i]),
          planned_pulses_ms: plannedPulses,
          delivered_pulses_ms: deliveredPulses,
          n_frames: nFrames, dropped_frames: dropped, max_frame_gap_ms: maxGap, frame_period_ms: P,
          level_ready_ms: specKnownAt, level_wait_ms: hold,
        })
        return
      }
      const c = circleAt(timeline, el)
      render(c.scale, c)
      raf(frame)
    }
    raf(frame)
  })
}
