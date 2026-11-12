// ── BCAT threshold task: all settings in one object ───────────────────────
//
// Pure and node-testable. makeConfig() returns a fresh copy; nothing here is mutated at run time.
//
// `engine` is the adaptive procedure's configuration, key for key as 6_online_pilot/js/config.js and the
// approved 4_task_prototype/bcat_threshold_config.yaml (model `sdt`, 2026-11-11). It is what the engine
// worker's `init` message takes. The two modes differ only where the source builds differed:
//
//   mode     change trials per direction   catch trials (4 slowing trials at 8-s pulses, data only)
//   online   30                            on   (the online pilot build)
//   lab      40                            off  (the YAML default)
//
// Both are switchable (changeTrialsPerDirection, catchTrials). Belt recording and Biopac triggers are a
// later stage (PLAN.md stage F); `mode` is the switch they will hang from.

import { validateConfig, deepCopy, deepMerge, VERSION as PORT_VERSION } from './engine/adaptive.js'

/** Recorded with every run. Bump the suffix whenever anything in engine/ changes what a session does. */
export const ENGINE_VERSION = `sdt-${PORT_VERSION}+radlab.1`

// JSON with object keys in sorted order at every level, so equal configs give equal text whatever order their
// keys were written in. Values follow JSON (undefined object members are left out, as JSON.stringify does).
function canonicalJson(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new TypeError(`configHash: ${v} cannot be hashed`)
    if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint' || v === undefined) throw new TypeError(`configHash: a ${typeof v} cannot be hashed`)
    return JSON.stringify(v)
  }
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return '[' + Array.from(v, canonicalJson).join(',') + ']'
  const keys = Object.keys(v).filter(k => v[k] !== undefined).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}'
}

/**
 * A deterministic fingerprint of a config snapshot: 64-bit FNV-1a over the UTF-8 bytes of its canonical JSON
 * (keys sorted), as 'fnv1a64:' + 16 hex digits. Synchronous and identical in node and browsers (TextEncoder and
 * BigInt). Not a security hash: it detects a config that differs from the stored one, it does not resist forgery.
 * replay() checks configHash(cfg.engine), the engine config it is given, so store that one with the run.
 */
export function configHash(cfg) {
  const bytes = new TextEncoder().encode(canonicalJson(cfg))
  let h = 0xcbf29ce484222325n
  const PRIME = 0x100000001b3n, MASK = 0xffffffffffffffffn
  for (const b of bytes) h = ((h ^ BigInt(b)) * PRIME) & MASK
  return 'fnv1a64:' + h.toString(16).padStart(16, '0')
}

export const MODES = {
  online: { change_trials_per_cell: 30, catch_trials_enabled: true },
  lab:    { change_trials_per_cell: 40, catch_trials_enabled: false },
}

// The approved `sdt` configuration (6_online_pilot/js/config.js, sections model to sdt).
const LN_1_5 = Math.log(1.5)

const ENGINE = {
  model: 'sdt',
  stimulus: {
    baseline_pulse_s: 4.0,      // one pulse = grow (inhale) + shrink (exhale); 4 s = 15 breaths/min
    n_lead_in_pulses: 0,        // no lead-in: two pulses at baseline, then two changed (Norm, 2026-11-12)
    n_pulses: 4,                // the trial's pulses
    change_after_pulse: 2,      // pulses 1-2 at baseline, 3-4 changed (abrupt)
    min_pulse_s: 2.0,
    max_pulse_s: 8.0,
  },
  design: {
    no_change_rate: 0.25,       // share of ALL trials with no change (they update only criterion and lapse)
    block_change_trials_per_cell: 3,
    after_cell_stops: 'drop',
    catch_trials: { enabled: true, cell: 'slowing', n_trials: 4, magnitude: 'ln2' },   // enabled: set by mode
  },
  stopping: {
    change_trials_per_cell: 30, // set by mode
    precision_rule: { enabled: false, max_sd_ln_threshold: 0.20, min_change_trials_per_cell: 15, max_change_trials_per_cell: 80 },
  },
  placement: {
    reserved_every: 3, reserved_after: 4, sub_target_dprime: 0.5, supra_target_dprime: 3.0,
    yesno_sub_factor: 0.5, yesno_supra_factor: 2.0,
  },
  sdt: {
    likelihood_categories: 3,
    separate_slopes: true,
    stim_grid: { geomspace: [0.01, 'ln2', 24] },
    alpha_grid: { geomspace: [0.02, 1.5, 40] },
    alpha_prior: { median: 0.2, log_sd: 1.0 },
    beta_grid: [0.4, 0.5, 0.6, 0.8, 1.0, 1.25, 1.6, 2.0, 2.5, 3.2, 4.0],
    beta_prior: { median: 1.2, log_sd: 0.6 },
    criterion_grid: { linspace: [0.0, 4.0, 17] },
    criterion_prior: { mean: 1.2, sd: 0.7 },
    lapse_grid: [0.0, 0.03, 0.06, 0.10, 0.15, 0.25, 0.40, 0.60, 0.80],
    lapse_prior: { logit_normal: { median: 0.049, logit_sd: 2.3 } },
    miss: {
      speeding: { grid: [0.0], prior_weights: [1] },
      slowing: { grid: [0.0, 0.1, 0.2, 0.3, 0.4], prior_weights: [12, 1, 1, 1, 1] },
    },
    threshold_dprime: 2.0,
    secondary_dprime: 1.0,
    n_best: 1,
    credible_interval: 0.95,
    quality_flag: { lapse_at_least: 0.25, probability_above: 0.5 },
  },
}

// The source build's ?demo=1: 3 change trials per direction and 1 catch trial (about 9 trials).
const DEMO_OVERRIDES = { stopping: { change_trials_per_cell: 3 }, design: { catch_trials: { n_trials: 1 } } }

const BASE = {
  timing: {
    fixation_ms: 1500,          // still circle at its smallest size before the first pulse (decision 9.2)
  },
  display: {
    circle_min_size: 0.1,       // diameter as a fraction of the window height, as the source build
    circle_max_size: 0.3,
  },
  keys: {
    // Pacer keys (touch and breath arms): hold W while the circle grows, S while it shrinks. Matched by the
    // character typed, with the physical key as the fallback (an AZERTY board's W and S still work).
    grow:   { key: 'w', code: 'KeyW', label: 'W' },
    shrink: { key: 's', code: 'KeyS', label: 'S' },
    answers: { slowed: 'ArrowLeft', same: 'ArrowUp', sped_up: 'ArrowRight' },
  },
  keyLog: {
    min_hold_ms: 300,           // a hold shorter than this is a slip (Kite's MIN_HOLD_MS)
    merge_gap_ms: 300,          // a release shorter than this between two same-key holds is merged (Kite's MERGE_GAP_MS)
    onset_window_frac: 0.5,     // a hold scores against a half-pulse if it starts within ± this share of the half
  },
  practice: {
    enabled: true,
    feedback: true,             // after each practice trial, say what the circle did
    // ln 1.5: 4-s pulses become 2.67 s or 6 s. Was ln 2 (2 s or 8 s), which Norm found excessive (2026-11-12).
    trials: [{ cell: 'speeding', magnitude: LN_1_5 }, { cell: 'slowing', magnitude: LN_1_5 }, { cell: 'no_change' }],
  },
  // Compliance reminders (compliance.js; Norm, 2026-11-12). Outside `engine`: they never change what the engine
  // is told, and configHash(cfg.engine) does not include them. Compliance is scored and recorded on every
  // trial whatever `reminders` says; `reminders` switches only what is shown.
  compliance: {
    reminders: true,            // show the fixation line and the page reminder
    min_coverage: 0.5,          // touch, breath: a trial is non-compliant below this share of the pulses covered by the right key
    vision_min_press_ms: 0,     // vision: a W or S press during the pulses of at least this length is non-compliant (0: any press)
    page_after: 3,              // this many non-compliant trials in a row bring the page reminder before the next trial
  },
  // Full screen (fullscreen.js; the test build's online.require_fullscreen; Norm, 2026-11-12). Outside `engine`:
  // configHash(cfg.engine) does not include it. Asked for in both modes; a browser that cannot or will not go
  // full screen runs the task windowed, and the run records why.
  fullscreen: {
    enabled: true,
  },
}

/**
 * @param {{ mode?: 'online'|'lab', demo?: boolean, catchTrials?: boolean, changeTrialsPerDirection?: number,
 *           practice?: boolean, fixationMs?: number, reminders?: boolean, fullscreen?: boolean }} [opts]
 */
export function makeConfig(opts = {}) {
  const mode = opts.mode === undefined ? 'online' : opts.mode
  if (!Object.prototype.hasOwnProperty.call(MODES, mode)) throw new Error(`Unknown mode ${JSON.stringify(mode)}: use 'online' or 'lab'.`)
  const m = MODES[mode]
  let engine = deepCopy(ENGINE)
  engine.stopping.change_trials_per_cell = m.change_trials_per_cell
  engine.design.catch_trials.enabled = m.catch_trials_enabled
  if (opts.demo) engine = deepMerge(engine, DEMO_OVERRIDES)
  if (opts.changeTrialsPerDirection !== undefined) {
    const n = Number(opts.changeTrialsPerDirection)
    if (!Number.isInteger(n) || n < 1) throw new Error('changeTrialsPerDirection must be a whole number >= 1.')
    engine.stopping.change_trials_per_cell = n
  }
  if (opts.catchTrials !== undefined) engine.design.catch_trials.enabled = !!opts.catchTrials
  validateConfig(engine)

  const cfg = deepCopy(BASE)
  if (opts.practice !== undefined) cfg.practice.enabled = !!opts.practice
  if (opts.fixationMs !== undefined) {
    const f = Number(opts.fixationMs)
    if (!(f >= 0)) throw new Error('fixationMs must be >= 0.')
    cfg.timing.fixation_ms = f
  }
  if (opts.reminders !== undefined) cfg.compliance.reminders = !!opts.reminders
  if (opts.fullscreen !== undefined) cfg.fullscreen.enabled = !!opts.fullscreen
  const cc = cfg.compliance
  if (!(cc.min_coverage >= 0 && cc.min_coverage <= 1)) throw new Error('compliance.min_coverage must be in [0, 1].')
  if (!Number.isInteger(cc.page_after) || cc.page_after < 1) throw new Error('compliance.page_after must be a whole number >= 1.')
  if (!(cc.vision_min_press_ms >= 0)) throw new Error('compliance.vision_min_press_ms must be >= 0.')
  return { mode, demo: !!opts.demo, engine_version: ENGINE_VERSION, engine, ...cfg }
}
