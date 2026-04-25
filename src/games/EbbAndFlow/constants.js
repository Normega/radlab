// ── Breath timing ────────────────────────────────────────────────────────
export const BASELINE_BREATH_DURATION_MS = 4000; // 4 s per cycle
export const BREATHS_PER_TRIAL = 4;
export const WARMUP_BREATHS = 4;
export const WARMUP_SYNC_THRESHOLD = 0.80;

// ── Game modes ────────────────────────────────────────────────────────────
export const GAME_MODES = {
  beginner: { label: 'Beginner', scaleAmplitude: 0.25, unlockAt: 0 },
  listener: { label: 'Listener', scaleAmplitude: 0.12, unlockAt: 50 },
  empath:   { label: 'Empath',   scaleAmplitude: 0.02, unlockAt: 100 },
};

// ── Scoring ───────────────────────────────────────────────────────────────
export const POINTS = {
  correct_high_salience: 10,
  correct_low_salience: 20,
  correct_catch: 8,
  false_alarm: -5,
  confidence_calibrated: 5,
};

// ── QUEST+ priors ─────────────────────────────────────────────────────────
export const QUEST_PRIORS = {
  threshold_mean: 0.20,
  threshold_sd: 0.15,
  slope: 5.70,
  lapse_rate: 0.02,
  guess_rate: 1 / 3,
  target_threshold_pct: 0.75,
};

// ── QUEST+ convergence ────────────────────────────────────────────────────
export const QUEST_CONVERGENCE_SD = 0.04;

// ── Magnitude space ───────────────────────────────────────────────────────
export const MAGNITUDE_MIN = 0.05;
export const MAGNITUDE_MAX = 0.50;
export const MAGNITUDE_STEPS = 46;

// ── Catch trials ──────────────────────────────────────────────────────────
export const CATCH_TRIAL_PROPORTION = 0.25;

// ── Session ───────────────────────────────────────────────────────────────
export const MIN_TRIALS_PER_SESSION = 10;
export const CONTINUE_PROMPT_INTERVAL = 10;

// ── ITI ───────────────────────────────────────────────────────────────────
export const ITI_DURATION_MS = 800;
