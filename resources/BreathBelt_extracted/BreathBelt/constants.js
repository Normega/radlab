// ── Breath timing ─────────────────────────────────────────────────────────
export const BASE_BREATH_SPEED_S    = 4;    // seconds per cycle (baseline)
export const FASTER_BREATH_SPEED_S  = 3;    // Phase 2 fixed faster condition
export const SLOWER_BREATH_SPEED_S  = 5;    // Phase 2 fixed slower condition

// ── Trial structure ───────────────────────────────────────────────────────
export const TRIALS_PER_CONDITION    = 3;   // 3×SAME + 3×FASTER + 3×SLOWER = 9
export const BASELINE_BREATHS_COUNT  = 2;   // breaths 1–2 at BASE speed
export const CONDITION_BREATHS_COUNT = 2;   // breaths 3–4 at condition speed

// ── Calibration ───────────────────────────────────────────────────────────
export const CALIB_CYCLES            = 3;   // breath cycles per calibration phase
export const READY_DELAY_MS          = 1000;

// ── Natural baseline ──────────────────────────────────────────────────────
export const BASELINE_DURATION_MS    = 60_000;  // 60 s free breathing

// ── QUEST parameters ──────────────────────────────────────────────────────
// Stimulus domain: absolute delta in seconds (log10 space internally)
export const QUEST_LOG_MIN         = Math.log10(0.1);   // 0.1 s delta minimum
export const QUEST_LOG_MAX         = Math.log10(2.0);   // 2.0 s delta maximum
export const QUEST_N_STEPS         = 46;
export const QUEST_SLOPE           = 5.70;
export const QUEST_LAPSE           = 0.02;
export const QUEST_GUESS           = 1 / 3;             // 3AFC
export const QUEST_CONVERGENCE_SD  = 0.04;
export const QUEST_PRIOR_MEAN_LOG  = Math.log10(0.5);   // centred at 0.5 s delta
export const QUEST_PRIOR_SD        = 0.25;

// ── Polar H10 BLE UUIDs ───────────────────────────────────────────────────
export const PMD_SERVICE    = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
export const PMD_CONTROL    = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8';
export const PMD_DATA       = 'fb005c82-02e7-f387-1cad-8acd2d8df0c8';
export const HR_SERVICE     = 'heart_rate';
export const HR_MEASUREMENT = 'heart_rate_measurement';
