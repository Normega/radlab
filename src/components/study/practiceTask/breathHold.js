// The breathing arm's adherence check: the participant holds the spacebar
// while breathing in and lets go while breathing out. Each press is
// recorded on the pacer's own clock (visible time, breathTiming.js), so it can
// be lined up against the phase the circle was showing.
//
// holdSummary() turns the presses into the measures saved with the response:
//
//   inhale_held_pct   share of in-breath time with the button held
//   exhale_held_pct   share of out-breath time with it held
//   balanced_pct      the mean of the first and (100 - the second): 50 for
//                     holding throughout, never pressing or pressing at random,
//                     100 for holding exactly while the circle grows
//   cycles_pressed    breaths with a press that started near their in-breath
//   onset_lag_ms      median time from the start of the in-breath to the press
//   release_lag_ms    median time from the start of the out-breath to the release
//   phase_r           how consistently presses start at the same point of the
//                     breath (0 to 1, the mean resultant length of the press
//                     onsets' phase angles); phase_lag_ms is their circular mean
//
// A press is assigned to the breath whose in-breath it is nearest to: it counts
// for breath k if it starts between half an out-breath before that in-breath and
// the end of it. Only time after the settle period is scored.

import { BREATH_DEFAULTS } from './breathTiming.js'

const median = a => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Overlap in ms between [a0, a1) and [b0, b1). */
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/**
 * @param presses [{ down, up }] in visible ms; up may be null for a press still held at endMs
 * @param cfg     the pacer settings (inhale_ms, exhale_ms, settle_ms)
 * @param endMs   visible time at which scoring stops (the end of the practice)
 */
export function holdSummary(presses, cfg = BREATH_DEFAULTS, endMs) {
  const { inhale_ms, exhale_ms, settle_ms } = { ...BREATH_DEFAULTS, ...cfg }
  const len = inhale_ms + exhale_ms
  const end = endMs ?? settle_ms
  const list = presses
    .map(p => ({ down: p.down, up: p.up ?? end }))
    .filter(p => Number.isFinite(p.down) && Number.isFinite(p.up) && p.up > p.down)

  // Held time inside every in-breath and out-breath that started before the end
  let inMs = 0, inHeld = 0, outMs = 0, outHeld = 0, breaths = 0
  for (let s = settle_ms; s < end; s += len) {
    breaths++
    const inEnd = Math.min(s + inhale_ms, end), outEnd = Math.min(s + len, end)
    inMs += inEnd - s
    outMs += Math.max(0, outEnd - inEnd)
    for (const p of list) {
      inHeld += overlap(p.down, p.up, s, inEnd)
      outHeld += overlap(p.down, p.up, inEnd, outEnd)
    }
  }
  const pct = (a, b) => b > 0 ? Math.round(1000 * a / b) / 10 : null
  const inhale_held_pct = pct(inHeld, inMs)
  const exhale_held_pct = pct(outHeld, outMs)
  const balanced_pct = inhale_held_pct == null || exhale_held_pct == null
    ? null : Math.round(10 * (inhale_held_pct + 100 - exhale_held_pct) / 2) / 10

  // Each breath's first press, and that press's release
  const onsets = [], releases = []
  for (let k = 0; k < breaths; k++) {
    const s = settle_ms + k * len
    const p = list.find(q => q.down >= s - exhale_ms / 2 && q.down < s + inhale_ms)
    if (!p) continue
    onsets.push(p.down - s)
    if (p.up < end) releases.push(p.up - (s + inhale_ms))
  }

  // Phase consistency of every press onset after the settle
  let cx = 0, cy = 0, n = 0
  for (const p of list) {
    if (p.down < settle_ms) continue
    const a = 2 * Math.PI * (((p.down - settle_ms) % len) / len)
    cx += Math.cos(a); cy += Math.sin(a); n++
  }
  const phase_r = n ? Math.round(1000 * Math.hypot(cx, cy) / n) / 1000 : null
  let phase_lag_ms = null
  if (n) {
    const ang = Math.atan2(cy, cx)                    // -pi..pi, 0 = the start of an in-breath
    phase_lag_ms = Math.round(ang / (2 * Math.PI) * len)
  }

  const round = x => x == null ? null : Math.round(x)
  return {
    presses: list.length,
    breaths,
    cycles_pressed: onsets.length,
    inhale_held_pct,
    exhale_held_pct,
    balanced_pct,
    onset_lag_ms: round(median(onsets)),
    release_lag_ms: round(median(releases)),
    phase_r,
    phase_lag_ms,
  }
}
