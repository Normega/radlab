// Where the paced-breathing pacer is at a given amount of VISIBLE time.
//
// The same arithmetic as Sandy's prototype: a settle period ("Get comfortable"),
// then cycles of breathing in (the circle grows from 0.55 to 1) and out (it
// shrinks back), each half eased with a cosine. Time hidden from view never
// reaches this function, so the practice pauses while the participant is away.

export const BREATH_DEFAULTS = {
  breathing_seconds: 240,   // about 4 minutes
  inhale_ms:         4000,  // 6 breaths a minute
  exhale_ms:         6000,
  settle_ms:         2500,  // before the first breath
}

const ease = x => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2

/**
 * @returns {{ phase: 'settle'|'in'|'out', scale: number, cycle: number, done: boolean, progress: number }}
 *   cycle — 1-based number of the breath under way (0 while settling)
 */
export function breathAt(visibleMs, cfg = BREATH_DEFAULTS) {
  const { inhale_ms, exhale_ms, settle_ms, breathing_seconds } = { ...BREATH_DEFAULTS, ...cfg }
  const total    = breathing_seconds * 1000
  const progress = Math.min(1, Math.max(0, visibleMs / total))
  const done     = visibleMs >= total
  if (visibleMs < settle_ms) return { phase: 'settle', scale: 0.55, cycle: 0, done, progress }

  const t     = visibleMs - settle_ms
  const len   = inhale_ms + exhale_ms
  const cycle = Math.floor(t / len) + 1
  const p     = t % len
  if (p < inhale_ms) {
    return { phase: 'in', scale: 0.55 + 0.45 * ease(p / inhale_ms), cycle, done, progress }
  }
  return { phase: 'out', scale: 1 - 0.45 * ease((p - inhale_ms) / exhale_ms), cycle, done, progress }
}
