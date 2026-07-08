// ── emberMechanics.js ───────────────────────────────────────────────────────
//
// Pure, React-free transfer functions for Ember. Everything that turns the
// breath signal into fire lives here so it can be unit-tested headless (see
// emberMechanics.test.mjs) and tuned without touching the render loop.

import {
  RATE_PER_S, RESONANCE_BPM, ZERO_GAIN_BPM,
  REG_CV_SCALE, REG_MIN,
  FLAME_BASE_MIN, FLAME_FLICKER,
  RESONANCE_ZONE_BPM, DEFAULT_RATE_BPM,
} from './constants.js'

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

// Current breath rate in bpm from the signal snapshot. Prefer the instantaneous
// last period (responsive); fall back to the smoothed bpm, then a default so the
// fire behaves sensibly in the first few seconds before any breath is measured.
export function rateFromSignal(signal) {
  if (signal?.lastPeriodMs) return 60000 / signal.lastPeriodMs
  if (signal?.bpm)          return signal.bpm
  return DEFAULT_RATE_BPM
}

// Rate → signed warmth gain in [-1, +1].
//   ≤ RESONANCE_BPM → +1   (breathing at/below resonance feeds the fire fully)
//   = ZERO_GAIN_BPM →  0   (holding steady)
//   ≥ NEG_CLAMP_BPM → -1   (fast breathing actively drains it)
export function rateGain(rate) {
  return clamp((ZERO_GAIN_BPM - rate) / (ZERO_GAIN_BPM - RESONANCE_BPM), -1, 1)
}

// Regularity multiplier in [REG_MIN, 1] from the breath-rate coefficient of
// variation. Null CV (too few breaths yet) → 1 so the fire isn't penalized
// before regularity can be measured.
export function regularityFactor(cv) {
  if (cv == null) return 1
  return clamp(1 - cv / REG_CV_SCALE, REG_MIN, 1)
}

// Change in warmth this frame. Regularity gates only gains, never the drain:
// ragged slow breathing fills slower, but panic-breathing always clearly empties.
export function warmthDelta(rate, cv, dtS) {
  const gain = rateGain(rate)
  const scaled = gain > 0 ? gain * regularityFactor(cv) : gain
  return scaled * RATE_PER_S * dtS
}

// Advance the warmth accumulator, clamped to [0, 1].
export function stepWarmth(W, signal, dtS) {
  return clamp(W + warmthDelta(rateFromSignal(signal), signal?.regularityCv, dtS), 0, 1)
}

// Flame geometry from warmth (slow, strategic) + breath value (fast, tactical).
// base grows with warmth; the flame breathes ±FLAME_FLICKER within each cycle.
export function flameGeom(W, value) {
  const base = FLAME_BASE_MIN + (1 - FLAME_BASE_MIN) * W
  const v = value == null ? 0.5 : value
  const flame = base * (1 + FLAME_FLICKER * (v - 0.5) * 2)
  return { base, flame }
}

// Coarse rate class for color / smoke decisions.
export function classifyRate(rate) {
  if (rate <= RESONANCE_ZONE_BPM) return 'resonance'
  if (rate <= ZERO_GAIN_BPM)      return 'ok'
  return 'fast'
}

// Warm palette by warmth: dim red ember → bright gold. Returned as an {r,g,b}
// so the caller can lerp toward grey when smoking.
export function flameColor(W) {
  // ember (120,30,10) → mid orange (230,110,20) → gold (255,200,70)
  const stops = [
    { at: 0.0, c: [120, 30, 10] },
    { at: 0.5, c: [230, 110, 20] },
    { at: 1.0, c: [255, 200, 70] },
  ]
  let a = stops[0], b = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (W >= stops[i].at && W <= stops[i + 1].at) { a = stops[i]; b = stops[i + 1]; break }
  }
  const t = b.at === a.at ? 0 : (W - a.at) / (b.at - a.at)
  return {
    r: Math.round(a.c[0] + (b.c[0] - a.c[0]) * t),
    g: Math.round(a.c[1] + (b.c[1] - a.c[1]) * t),
    b: Math.round(a.c[2] + (b.c[2] - a.c[2]) * t),
  }
}

// Fold one frame into the running metrics accumulator (mutates + returns it).
// caughtFire latches true once the hold streak first reaches HOLD_MS.
export function accumulateMetrics(m, { W, rate, regularitySdMs, holdMs, dtMs }) {
  m.maxWarmth = Math.max(m.maxWarmth, W)
  m.longestHoldMs = Math.max(m.longestHoldMs, holdMs)
  if (rate <= RESONANCE_ZONE_BPM) m.timeInResonanceMs += dtMs
  m.bpmSum += rate; m.bpmN += 1
  if (regularitySdMs != null) { m.regSum += regularitySdMs; m.regN += 1 }
  return m
}

export function emptyMetrics() {
  return {
    maxWarmth: 0, longestHoldMs: 0, timeInResonanceMs: 0,
    bpmSum: 0, bpmN: 0, regSum: 0, regN: 0, caughtFire: false, startMs: null,
  }
}

// Derive the human-facing summary from the raw accumulator.
export function summarize(m, endMs) {
  return {
    maxWarmth: m.maxWarmth,
    longestHoldMs: m.longestHoldMs,
    timeInResonanceMs: m.timeInResonanceMs,
    meanBpm: m.bpmN ? m.bpmSum / m.bpmN : null,
    meanRegularitySdMs: m.regN ? m.regSum / m.regN : null,
    caughtFire: m.caughtFire,
    durationMs: m.startMs != null ? endMs - m.startMs : 0,
  }
}
