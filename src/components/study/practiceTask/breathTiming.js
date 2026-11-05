// Where the paced-breathing pacer is at a given amount of VISIBLE time.
//
// A settle period ("Get comfortable"), then cycles of breathing in (the circle
// grows from 0.55 to 1) and out (it shrinks back). Time hidden from view never
// reaches this function, so the practice pauses while the participant is away.
//
// Two shapes for each half of the breath:
//
//   'natural' (the default) follows the average unpaced breath: 258 people,
//     7,605 breaths, chest-belt recordings from the rest period before the BCAT
//     in Aya's study (scratch analysis 2026-11-05). The inhale is a near-even S;
//     the exhale lets most of the air go early (57% out by its midpoint) and
//     settles slowly over its last sixth. The curves are stretched to the
//     configured lengths, which assumes the shape holds at 6 breaths a minute
//     (those recordings ran at about 19).
//   'symmetric' is Sandy's prototype: each half eased with the same cosine.

export const BREATH_DEFAULTS = {
  breathing_seconds: 240,   // about 4 minutes
  inhale_ms:         4000,  // 6 breaths a minute
  exhale_ms:         6000,
  settle_ms:         2500,  // before the first breath
  shape:             'natural',
}

const clamp01 = x => Math.min(1, Math.max(0, x))
const ease = x => (1 - Math.cos(Math.PI * clamp01(x))) / 2

// Fraction of the breath taken in (INHALE) and still held (EXHALE) at every
// 5% of that half, from the averaged template.
const INHALE = [0, .020, .056, .098, .144, .195, .248, .301, .357, .415, .472,
  .532, .593, .653, .714, .774, .832, .885, .935, .978, 1]
const EXHALE = [1, .972, .915, .848, .779, .712, .647, .587, .530, .477, .428,
  .381, .337, .295, .254, .212, .169, .122, .072, .025, 0]

function lookup(table, x) {
  const f = clamp01(x) * (table.length - 1)
  const i = Math.min(table.length - 2, Math.floor(f))
  return table[i] + (table[i + 1] - table[i]) * (f - i)
}

/** How full the breath is (0-1) a fraction x of the way through each half. */
export function fillAt(phase, x, shape = 'natural') {
  if (shape === 'symmetric') return phase === 'in' ? ease(x) : 1 - ease(x)
  return lookup(phase === 'in' ? INHALE : EXHALE, x)
}

/**
 * @returns {{ phase: 'settle'|'in'|'out', scale: number, cycle: number, done: boolean, progress: number }}
 *   cycle — 1-based number of the breath under way (0 while settling)
 */
export function breathAt(visibleMs, cfg = BREATH_DEFAULTS) {
  const { inhale_ms, exhale_ms, settle_ms, breathing_seconds, shape } = { ...BREATH_DEFAULTS, ...cfg }
  const total    = breathing_seconds * 1000
  const progress = clamp01(visibleMs / total)
  const done     = visibleMs >= total
  if (visibleMs < settle_ms) return { phase: 'settle', scale: 0.55, cycle: 0, done, progress }

  const t     = visibleMs - settle_ms
  const len   = inhale_ms + exhale_ms
  const cycle = Math.floor(t / len) + 1
  const p     = t % len
  const [phase, x] = p < inhale_ms ? ['in', p / inhale_ms] : ['out', (p - inhale_ms) / exhale_ms]
  return { phase, scale: 0.55 + 0.45 * fillAt(phase, x, shape), cycle, done, progress }
}
