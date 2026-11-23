// ── Flow game: level ladder, staircase, ability estimate, zones ────────────
//
// Pure, DOM-free and node-testable. The prototype at
// /prototypes/flow-game.html imports a byte-identical copy from
// public/prototypes/flow-game/levels.js (levels.test.mjs fails if they drift).
//
// The ladder is Asteroid Impact's standard01–13 (asteroidimpact/
// asteroid_impact_py3, makestandardlevels.py; CC BY-SA 4.0) with every level
// held at 3 crystals, as in the original samplescript-adaptive.json, so only
// the hazards change between levels. hard01 equals standard13 once its crystal
// count is held at 3, so the ladder stops at 13.
//
// Speeds are units per frame at 60 fps in a 1280×960 virtual screen, as in
// the original; one value s is drawn from the named list and dx, dy are each a
// random integer 1..s with a random sign.

export const SPEEDS = {
  slow: [2, 3, 3, 4],
  medium: [4, 6, 6, 7],
  fast: [10, 12, 12, 14],
  extreme: [16, 20, 20, 22],
}

const small = [60, 100, 90, 70, 110, 80]
const medium = [110, 120, 150, 120, 140, 130]
const large = [200, 160, 170, 220, 210, 220]
export const SIZES = { small, medium, large, varied: [...small, ...medium, ...large] }

export const TARGETS_PER_LEVEL = 3

// LADDER[i] is level i + 1. powerups cycle in order; delay is the gap (s)
// before each one appears.
export const LADDER = [
  { asteroids: 1, speed: 'slow', size: 'large', powerups: [], delay: 0 },
  { asteroids: 1, speed: 'medium', size: 'large', powerups: [], delay: 0 },
  { asteroids: 2, speed: 'medium', size: 'large', powerups: [], delay: 0 },
  { asteroids: 3, speed: 'slow', size: 'large', powerups: [], delay: 0 },
  { asteroids: 2, speed: 'medium', size: 'large', powerups: ['shield'], delay: 0.5 },
  { asteroids: 3, speed: 'medium', size: 'large', powerups: ['shield'], delay: 0.5 },
  { asteroids: 3, speed: 'medium', size: 'large', powerups: ['slow'], delay: 0.5 },
  { asteroids: 2, speed: 'fast', size: 'large', powerups: ['slow'], delay: 0.5 },
  { asteroids: 4, speed: 'medium', size: 'medium', powerups: ['slow', 'shield'], delay: 2.0 },
  { asteroids: 4, speed: 'fast', size: 'medium', powerups: ['slow', 'shield'], delay: 2.0 },
  { asteroids: 6, speed: 'medium', size: 'small', powerups: ['slow', 'shield'], delay: 2.0 },
  { asteroids: 8, speed: 'medium', size: 'varied', powerups: ['slow', 'shield'], delay: 2.0 },
  { asteroids: 5, speed: 'extreme', size: 'large', powerups: ['shield'], delay: 0.5 },
]
export const TOP_LEVEL = LADDER.length

// Calibration climbs fast (Norm wanted a ballpark in 2–3 min); the flow round
// uses the original samplescript-adaptive.json steps.
export const STAIRCASES = {
  calibration: { up: 1.0, down: 1.0 },
  flow: { up: 0.4, down: 0.3 },
}

// Low and high sit this many levels below and above the ability estimate.
export const CONDITION_OFFSET = 3

// Zone bands, in levels relative to the ability estimate.
export const ZONE_BAND = 2

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Score → level, as the original's int(score + 0.001), 1-based.
export function levelFromScore(score) {
  return clamp(Math.floor(score + 0.001), 1, TOP_LEVEL)
}

// One staircase step. outcome is 'clear' or 'death'. The score stays within
// the ladder so a run of clears at the top can't bank levels.
export function stepScore(score, outcome, steps) {
  const next = outcome === 'clear' ? score + steps.up : score - steps.down
  return clamp(next, 1, TOP_LEVEL + 0.999)
}

// Ballpark ability: the time-weighted mean level over the last `frac` of the
// calibration, rounded. samples: [{ t, level }] at a fixed tick (t in ms from
// the start), so each sample carries equal weight.
export function estimateAbility(samples, totalMs, frac = 0.6) {
  const from = totalMs * (1 - frac)
  const tail = samples.filter(s => s.t >= from)
  if (!tail.length) return 1
  const mean = tail.reduce((a, s) => a + s.level, 0) / tail.length
  return clamp(Math.round(mean), 1, TOP_LEVEL)
}

// Where a round starts and whether it adapts. gap is the realised distance
// from ability, smaller than CONDITION_OFFSET when the ladder clamps it.
export function conditionPlan(condition, ability) {
  if (condition === 'flow') return { level: ability, adaptive: true, gap: 0, clamped: false }
  if (condition === 'low') {
    const level = Math.max(1, ability - CONDITION_OFFSET)
    return { level, adaptive: false, gap: ability - level, clamped: ability - level < CONDITION_OFFSET }
  }
  if (condition === 'high') {
    const level = Math.min(TOP_LEVEL, ability + CONDITION_OFFSET)
    return { level, adaptive: false, gap: level - ability, clamped: level - ability < CONDITION_OFFSET }
  }
  throw new Error(`unknown condition: ${condition}`)
}

export function zoneOf(level, ability) {
  const d = level - ability
  if (d <= -ZONE_BAND) return 'below'
  if (d >= ZONE_BAND) return 'above'
  return 'matched'
}

export const ZONES = ['below', 'matched', 'above']

export function emptyZoneTally() {
  return Object.fromEntries(ZONES.map(z => [z, { ms: 0, deaths: 0, clears: 0, crystals: 0 }]))
}

// Per-zone seconds and per-minute rates (null where no time was spent).
export function zoneSummary(tally) {
  return Object.fromEntries(ZONES.map(z => {
    const { ms, deaths, clears, crystals } = tally[z]
    const min = ms / 60000
    const rate = n => (ms > 0 ? n / min : null)
    return [z, {
      seconds: ms / 1000, deaths, clears, crystals,
      deathsPerMin: rate(deaths), clearsPerMin: rate(clears), crystalsPerMin: rate(crystals),
    }]
  }))
}
