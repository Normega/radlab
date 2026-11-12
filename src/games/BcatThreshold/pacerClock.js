// ── BCAT threshold pacer clock ──────────────────────────────────────────────
//
// Pure, React-free and node-testable. Where the circle is at time t, looked up from one precomputed
// schedule. Every time is in ms from ONE absolute trial start (fixation onset, the trial's t = 0), so a
// late frame can never stretch a pulse or shift the next one: a renderer reads circleAt(timeline, now - t0)
// on each requestAnimationFrame and writes the size.
//
// One trial (PLAN.md section 3):
//   fixation   the circle still at its smallest size, timing.fixation_ms (1500 ms)
//   lead-in    n_lead_in_pulses pulses at the baseline pace (4 s), not analyzed. 0 in the approved config
//              since 2026-11-12: no lead-in is shown (the option stays; the timeline still supports one)
//   pulses     4 test pulses; on a change trial pulses 3 and 4 are changed abruptly (2-8 s)
//   done       back at the smallest size, still; the question follows
//
// Motion is symmetric: each pulse is a grow half and a shrink half of equal length, each eased with the
// same cosine, (1 - cos(pi x)) / 2, the 'symmetric' shape of practiceTask/breathTiming.js (decision 9.6).
// So the circle is at its smallest size at every pulse boundary and at its largest at every midpoint.
//
// No modulo arithmetic: the pulse is found by comparing t with the precomputed boundaries, and intervals
// are half-open [start, end). At the exact end of the last pulse the circle is 'done', never the start of
// another pulse.

const clamp01 = x => Math.min(1, Math.max(0, x))
const ease = x => (1 - Math.cos(Math.PI * clamp01(x))) / 2

/** Fill (0 smallest .. 1 largest) a fraction x through a grow or shrink half. */
export function fillAt(phase, x) {
  return phase === 'grow' ? ease(x) : 1 - ease(x)
}

/**
 * The schedule of one trial.
 * @param {number[]} pulseDurationsS  every pulse in order, any lead-in first (an engine trial's pulse_durations_s)
 * @param {{ fixationMs?: number, nLeadIn?: number, changeIndex?: number|null, minScale?: number, maxScale?: number }} [opts]
 *   nLeadIn — how many of the first pulses are lead-in (default 0, none; callers pass the trial's n_lead_in_pulses)
 *   changeIndex — 0-based index of the first changed pulse, or null on a no-change trial
 * @returns {{ fixationMs, totalMs, nLeadIn, minScale, maxScale, pulses: Array<{ index, startMs, midMs, endMs,
 *   durationMs, leadIn, changed }> }}  index is 1-based, counting any lead-in pulse first (the source build's pulse_index)
 */
export function buildTimeline(pulseDurationsS, opts = {}) {
  const { fixationMs = 1500, nLeadIn = 0, changeIndex = null, minScale = 0.1, maxScale = 0.3 } = opts
  if (!Array.isArray(pulseDurationsS) || pulseDurationsS.length === 0) throw new Error('buildTimeline: need at least one pulse')
  if (!(fixationMs >= 0) || !Number.isFinite(fixationMs)) throw new Error('buildTimeline: fixationMs must be a finite number >= 0')
  const pulses = []
  let t = fixationMs
  pulseDurationsS.forEach((d, i) => {
    const durationMs = Number(d) * 1000
    if (!(durationMs > 0) || !Number.isFinite(durationMs)) throw new Error(`buildTimeline: pulse ${i + 1} has no positive duration`)
    const startMs = t
    const endMs = startMs + durationMs
    pulses.push({ index: i + 1, startMs, midMs: startMs + durationMs / 2, endMs, durationMs,
      leadIn: i < nLeadIn, changed: changeIndex !== null && i >= changeIndex })
    t = endMs
  })
  return { fixationMs, totalMs: t, nLeadIn, minScale, maxScale, pulses }
}

/** The timeline of an engine trial (a nextTrial() spec, or a practice spec) under a config from makeConfig(). */
export function timelineForTrial(spec, cfg) {
  return buildTimeline(spec.pulse_durations_s, {
    fixationMs: cfg.timing.fixation_ms,
    nLeadIn: Number(spec.n_lead_in_pulses),
    changeIndex: spec.is_change ? Number(spec.change_index) : null,
    minScale: cfg.display.circle_min_size,
    maxScale: cfg.display.circle_max_size,
  })
}

/**
 * The planned boundaries of every half-pulse, in order: what delivered timing and key presses are scored against.
 * @returns {Array<{ half: number, pulseIndex: number, phase: 'grow'|'shrink', startMs: number, endMs: number,
 *   durationMs: number, leadIn: boolean, changed: boolean }>}  half is 0-based
 */
export function halfPulses(timeline) {
  const out = []
  for (const p of timeline.pulses) {
    out.push({ half: out.length, pulseIndex: p.index, phase: 'grow', startMs: p.startMs, endMs: p.midMs,
      durationMs: p.midMs - p.startMs, leadIn: p.leadIn, changed: p.changed })
    out.push({ half: out.length, pulseIndex: p.index, phase: 'shrink', startMs: p.midMs, endMs: p.endMs,
      durationMs: p.endMs - p.midMs, leadIn: p.leadIn, changed: p.changed })
  }
  return out
}

/**
 * The circle at time tMs from the trial start.
 * @returns {{ segment: 'fixation'|'leadin'|'pulse'|'done', pulseIndex: number|null, testPulse: number|null,
 *   phase: 'grow'|'shrink'|'still', fill: number, scale: number, tInPulse: number|null, tInHalf: number|null,
 *   changed: boolean }}
 *   testPulse — 1..4 for the test pulses, null for the lead-in and outside pulses
 */
export function circleAt(timeline, tMs) {
  if (typeof tMs !== 'number' || Number.isNaN(tMs)) throw new Error('circleAt: t must be a number')
  const { pulses, minScale, maxScale, nLeadIn } = timeline
  const still = segment => ({ segment, pulseIndex: null, testPulse: null, phase: 'still', fill: 0, scale: minScale,
    tInPulse: null, tInHalf: null, changed: false })
  if (tMs < timeline.fixationMs) return still('fixation')
  if (tMs >= timeline.totalMs) return still('done')
  let k = pulses.length - 1
  while (k > 0 && tMs < pulses[k].startMs) k--
  const p = pulses[k]
  const grow = tMs < p.midMs
  const x = grow ? (tMs - p.startMs) / (p.midMs - p.startMs) : (tMs - p.midMs) / (p.endMs - p.midMs)
  const phase = grow ? 'grow' : 'shrink'
  const fill = fillAt(phase, x)
  return {
    segment: p.leadIn ? 'leadin' : 'pulse',
    pulseIndex: p.index,
    testPulse: p.leadIn ? null : p.index - nLeadIn,
    phase,
    fill,
    scale: minScale + (maxScale - minScale) * fill,
    tInPulse: tMs - p.startMs,
    tInHalf: grow ? tMs - p.startMs : tMs - p.midMs,
    changed: p.changed,
  }
}
