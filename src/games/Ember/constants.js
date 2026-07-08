// ── Ember tuning constants ──────────────────────────────────────────────────
// All warmth/rate numbers are starting points meant to be dialed in live on
// /dev/breath-lab. Kept in one place so tuning never means hunting through the
// draw loop.

// Warmth accumulator dynamics
// Fill rate + regularity gate tuned against a real 4.5-min belt session
// (belt-recording 2026-07-08): 1/18 fill + soft CV gate catches ~60 s into a
// sustained slow stretch; a clean session (features reset, slow from the start)
// catches faster. See src/games/Ember/replayRecording.mjs to re-tune on new data.
export const RATE_PER_S   = 1 / 18   // full-gain breathing fills the fire in ~18 s
export const WIN_WARMTH   = 0.85     // sustain this to trigger the "caught fire" beacon
export const HOLD_MS      = 10000    // ...for this long, continuously

// Rate → warmth gain breakpoints (breaths per minute)
export const RESONANCE_BPM   = 6     // gain saturates to +1 at or below this
export const ZERO_GAIN_BPM   = 10    // gain crosses zero here
export const NEG_CLAMP_BPM   = 14    // gain saturates to −1 at or above this (from the slope)
export const RESONANCE_ZONE_BPM = 7  // counted as "in the resonance zone" for the metric

// Regularity gate (only throttles gains, never the drain). Uses coefficient of
// variation (SD/mean period), not absolute SD — absolute SD unfairly punishes
// slow breathing, where a longer period naturally carries larger jitter.
export const REG_CV_SCALE = 0.35   // CV at which the regularity factor bottoms out (~35% variation)
export const REG_MIN      = 0.60   // floor so natural breath-to-breath variation still fills well

// Flame geometry
export const FLAME_BASE_MIN  = 0.30  // ember height at W=0 (fraction of full)
export const FLAME_FLICKER   = 0.15  // ±fraction the flame breathes within a cycle

// Pacer halo
export const PACER_PERIOD_MS = 10000 // 6 bpm guide ring (matches resonance target)

// Fallback rate before bpm/lastPeriod exist (a middling, slightly-fast pace)
export const DEFAULT_RATE_BPM = 12
