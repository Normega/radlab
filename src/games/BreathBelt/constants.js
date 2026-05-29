// ── Breath timing ─────────────────────────────────────────────────────────
export const BASE_BREATH_SPEED_S    = 4;
export const FASTER_BREATH_SPEED_S  = 3;
export const SLOWER_BREATH_SPEED_S  = 5;

// ── Trial structure ───────────────────────────────────────────────────────
export const TRIALS_PER_CONDITION    = 3;
export const BASELINE_BREATHS_COUNT  = 2;
export const CONDITION_BREATHS_COUNT = 2;

// ── Calibration ───────────────────────────────────────────────────────────
export const CALIB_CYCLES  = 3;
export const READY_DELAY_MS = 1000;

// ── Baselines — both 120 s for matched pre/post comparison ───────────────
export const BASELINE_DURATION_MS      = 120_000;  // pre-session free breathing
export const POST_BASELINE_DURATION_MS = 120_000;  // post-session free breathing

// ── QUEST parameters ──────────────────────────────────────────────────────
export const QUEST_LOG_MIN         = Math.log10(0.1);
export const QUEST_LOG_MAX         = Math.log10(2.0);
export const QUEST_N_STEPS         = 46;
export const QUEST_SLOPE           = 5.70;
export const QUEST_LAPSE           = 0.02;
export const QUEST_GUESS           = 1 / 3;
export const QUEST_CONVERGENCE_SD  = 0.04;
export const QUEST_PRIOR_MEAN_LOG  = Math.log10(0.5);
export const QUEST_PRIOR_SD        = 0.25;

// ── Trigger / event-marking hardware ──────────────────────────────────────
// Chosen at session setup; determines how COM event triggers are emitted, since
// each testing rig uses different physio equipment.
//   AD_BBT       — ADInstruments PowerLab via Black Box ToolKit USB TTL Module
//                  (Web Serial; 2-char hex per code, "RR" init, "00" clear).
//   Biopac_Left  — Biopac via parallel-port card, left testing rig  (setup TBD).
//   Biopac_Right — Biopac via parallel-port card, right testing rig (setup TBD).
export const TRIGGER_DEVICES = [
  { value: 'AD_BBT',       label: 'AD Instruments + Black Box ToolKit (AD_BBT)' },
  { value: 'Biopac_Left',  label: 'Biopac — Left rig' },
  { value: 'Biopac_Right', label: 'Biopac — Right rig' },
];
export const DEFAULT_TRIGGER_DEVICE = 'AD_BBT';

// ── Polar H10 BLE UUIDs ───────────────────────────────────────────────────
export const PMD_SERVICE    = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
export const PMD_CONTROL    = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8';
export const PMD_DATA       = 'fb005c82-02e7-f387-1cad-8acd2d8df0c8';
export const HR_SERVICE     = 'heart_rate';
export const HR_MEASUREMENT = 'heart_rate_measurement';
