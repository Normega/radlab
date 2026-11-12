// ── BCAT threshold: the rows a run produces ────────────────────────────────
//
// Pure and node-testable (records.test.mjs). One run object, one object per trial, one result object, in
// the shapes Stage C will insert into bcat_threshold_runs, bcat_threshold_trials and bcat_threshold_results
// (PLAN.md section 4). Identity (user, study, schedule, is_test) is not here: the store adds it (store.js).
//
// For Stage C, resume by replay: the engine's trials are the rows with sent_to_engine true, in seq order,
// and what the engine was given is `engine_response`, NOT `response`. They differ on an interrupted trial
// (sequence.js): `response` is the key the participant pressed, `engine_response` is null because the
// answer was withheld. So:
//   replay(rows.filter(r => r.sent_to_engine).map(r => savedTrial(r, r.engine_response)), cfg.engine, run.seed,
//          { expect: { engine_version: run.engine_version, config_hash: run.config_hash } })
// savedTrial reads trial_index, cell, placement and magnitude, which every trial row carries.
//
// Compliance (compliance.js) is on the trial row as facts only and never enters the replay: `compliant`
// (null when not assessed, `compliance_skip` says why), `compliance_coverage` (touch, breath) or
// `compliance_ws_presses` / `compliance_ws_press_ms` (vision), `noncompliant_streak`, and what was shown:
// `reminder_shown` (the line at this trial's fixation) and `reminder_page_shown` (the page just before this
// trial). The result counts them. The rule's settings are the run's config.compliance.
//
// Full screen (fullscreen.js), facts only, never in the replay. Run: `fullscreen` { enabled, supported, entered,
// windowed_reason } as it stood after the entry page (windowed_reason null when the task asked for full screen
// and got it; else 'config_off', 'simulated', 'no_api', 'not_enabled' (e.g. an iframe without permission) or
// 'rejected'). Trial: `fullscreen_at_onset` (null in a simulated run), `shown_fullscreen` (full screen from
// fixation onset to the circle's end), `fullscreen_exits` (exits from fixation onset to the answer),
// `fullscreen_return_shown` (the return page came just before this trial), and for every interrupted trial
// `interruption_reason` (the first loss: 'blur', 'hidden', 'hidden_at_start' or 'fullscreen_exit') and
// `interruption_reasons` (all of them, once each). Result: `n_fullscreen_exits` over the whole run (pages too;
// an exit the task makes at the end is not counted), `n_fullscreen_return_pages`, and the run's `fullscreen`
// summary with its time-stamped events.

import { configHash } from './config.js'
import { interruptionReasons } from './sequence.js'

export const RUN_SCHEMA = 'bcat_threshold_run/1'
export const TRIAL_SCHEMA = 'bcat_threshold_trial/1'
export const RESULT_SCHEMA = 'bcat_threshold_result/1'

/** A session seed: a whole number in [0, 2^32) from the browser's cryptographic generator. Never a default. */
export function newSeed(c = globalThis.crypto) {
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('newSeed: crypto.getRandomValues is not available')
  const a = new Uint32Array(1)
  c.getRandomValues(a)
  return a[0]
}

/** A client-made run id (uuid v4). */
export function newRunId(c = globalThis.crypto) {
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('newRunId: crypto is not available')
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** JSON-safe copy: typed arrays become arrays, non-finite numbers null, undefined members dropped. */
export function plain(v) {
  if (v === null || v === undefined) return v === undefined ? undefined : null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'object') return v
  if (ArrayBuffer.isView(v)) return Array.from(v, plain)
  if (Array.isArray(v)) return v.map(x => { const p = plain(x); return p === undefined ? null : p })
  const out = {}
  for (const [k, x] of Object.entries(v)) { const p = plain(x); if (p !== undefined) out[k] = p }
  return out
}

/**
 * @param {object} o
 * @param {string} o.id        newRunId()
 * @param {'vision'|'touch'|'breath'} o.arm
 * @param {object} o.cfg       makeConfig()
 * @param {number} o.seed      newSeed()
 * @param {'study'|'preview'|'demo'|'simulated'} o.kind
 * @param {object} [o.client]  screen and browser facts
 */
export function makeRunRecord(o) {
  const { id, arm, cfg, seed, kind } = o
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('makeRunRecord: seed must be a whole number in [0, 2^32)')
  return plain({
    schema: RUN_SCHEMA,
    id,
    started_at: o.startedAt ?? new Date().toISOString(),
    kind,
    arm,
    mode: cfg.mode,
    demo: !!cfg.demo,
    engine_version: cfg.engine_version,
    config_hash: configHash(cfg.engine),
    config: cfg,
    seed,
    planned_trials: o.plannedTrials ?? null,
    interruption_policy: o.policy ?? null,
    engine_mode: o.engineMode ?? null,
    frame_period_ms: o.framePeriodMs ?? null,
    client: o.client ?? null,
    fullscreen: o.fullscreen ?? null,
    resumed_from: null,
  })
}

/**
 * One trial as it ended.
 * @param {object} o
 * @param {string} o.runId
 * @param {number} o.seq                1-based order of everything shown in this run (practice included)
 * @param {'practice'|'main'|'repeat'} o.phase
 * @param {object} o.spec               the engine's (or practice) trial
 * @param {object} o.pres               presentCircle()'s record (or a simulated one)
 * @param {{ response: string|null, key: string|null, rtMs: number|null, questionOnsetMs: number|null }} o.answer
 * @param {boolean} o.interrupted
 * @param {object[]} o.focusEvents      [{ type, t }] on the trial clock
 * @param {object} o.keys               { events, repeats, blurs, summary }
 * @param {string|null} [o.engineResponse]  main trials: what the engine was given
 * @param {object|null} [o.reply]       main trials: the engine's reply ({ running, scoring, procedure_ms })
 * @param {number|null} [o.repeatOf]
 * @param {boolean} [o.repeatQueued]
 * @param {number} o.tStartMs           fixation onset, ms from the run's start (performance.now)
 * @param {object|null} [o.compliance]  compliance.js's assessment of this trial, with `streak`
 * @param {{ line: boolean, page: boolean }} [o.reminder]  what was shown before and at this trial's fixation
 * @param {string[]} [o.interruptionReasons]  the presenter's (sequence.interruptionReasons); else from focusEvents
 * @param {boolean|null} [o.fullscreenAtOnset]  in full screen at fixation onset (null: not known, simulated)
 * @param {boolean} [o.fullscreenReturn]  the return-to-full-screen page was shown just before this trial
 */
export function makeTrialRecord(o) {
  const { spec, pres, answer, phase } = o
  const main = phase === 'main'
  const hiddenMs = hiddenTime(o.focusEvents, answer.questionOnsetMs ?? pres.t_end ?? 0)
  const reasons = !o.interrupted ? []
    : Array.isArray(o.interruptionReasons) ? o.interruptionReasons
      : typeof pres.t_end === 'number' ? interruptionReasons(o.focusEvents, { endMs: pres.t_end }) : []
  const fsOnset = typeof o.fullscreenAtOnset === 'boolean' ? o.fullscreenAtOnset : null
  return plain({
    schema: TRIAL_SCHEMA,
    run_id: o.runId,
    seq: o.seq,
    phase,
    trial_index: spec.trial_index,
    repeat_of: o.repeatOf ?? null,
    trial_type: phase === 'practice' ? 'practice' : spec.placement,
    cell: spec.cell,
    placement: spec.placement,
    direction: spec.is_change ? spec.cell : null,
    is_change: !!spec.is_change,
    cell_trial_index: spec.cell_trial_index ?? null,
    magnitude: spec.magnitude,
    requested_magnitude: spec.requested_magnitude ?? null,
    log_ratio: spec.log_ratio,
    clamped: !!spec.clamped,
    target_dprime: spec.target_dprime ?? null,
    reference_threshold: spec.reference_threshold ?? null,
    changed_pulse_s: spec.changed_pulse_s,
    planned_pulses_s: spec.pulse_durations_s,
    planned_boundaries_ms: pres.planned_boundaries_ms ?? null,
    delivered_boundaries_ms: pres.delivered_boundaries_ms ?? null,
    boundary_error_ms: pres.boundary_error_ms ?? null,
    delivered_pulses_ms: pres.delivered_pulses_ms ?? null,
    response: answer.response,
    response_key: answer.key ?? null,
    rt_ms: answer.rtMs ?? null,
    sent_to_engine: main,
    engine_response: main ? (o.engineResponse === undefined ? answer.response : o.engineResponse) : null,
    interrupted: !!o.interrupted,
    interruption_reason: o.interrupted ? reasons[0] ?? 'unknown' : null,
    interruption_reasons: reasons,
    repeat_queued: !!o.repeatQueued,
    focus_events: o.focusEvents || [],
    n_blur: (o.focusEvents || []).filter(e => e.type === 'blur').length,
    n_hidden: (o.focusEvents || []).filter(e => e.type === 'hidden').length,
    hidden_ms: hiddenMs,
    fullscreen_at_onset: fsOnset,
    shown_fullscreen: fsOnset === null ? null : fsOnset && !reasons.includes('fullscreen_exit'),
    fullscreen_exits: (o.focusEvents || []).filter(e => e.type === 'fullscreen_exit').length,
    fullscreen_return_shown: !!o.fullscreenReturn,
    posterior: main && o.reply ? o.reply.running ?? null : null,
    scoring: main && o.reply ? o.reply.scoring ?? null : null,
    procedure_ms: main && o.reply ? o.reply.procedure_ms ?? null : null,
    key_events: o.keys?.events ?? [],
    key_repeats: o.keys?.repeats ?? 0,
    key_blurs: o.keys?.blurs ?? 0,
    key_summary: o.keys?.summary ?? null,
    compliant: o.compliance ? o.compliance.compliant : null,
    compliance_skip: o.compliance ? o.compliance.skip : 'not_assessed',
    compliance_coverage: o.compliance ? o.compliance.coverage : null,
    compliance_ws_presses: o.compliance ? o.compliance.ws_presses : null,
    compliance_ws_press_ms: o.compliance ? o.compliance.ws_press_ms : null,
    noncompliant_streak: o.compliance ? o.compliance.streak ?? null : null,
    reminder_shown: !!o.reminder?.line,
    reminder_page_shown: !!o.reminder?.page,
    timing: {
      t_start_ms: o.tStartMs ?? null,
      circle_end_ms: pres.t_end ?? null,
      question_onset_ms: answer.questionOnsetMs ?? null,
      n_frames: pres.n_frames ?? null,
      dropped_frames: pres.dropped_frames ?? null,
      max_frame_gap_ms: pres.max_frame_gap_ms ?? null,
      frame_period_ms: pres.frame_period_ms ?? null,
      level_ready_ms: pres.level_ready_ms ?? null,
      level_wait_ms: pres.level_wait_ms ?? null,
      reminder_off_ms: pres.reminder_off_ms ?? null,
      simulated: !!pres.simulated,
    },
    wallclock_start: o.wallclockStart ?? null,
  })
}

/** Time the page was hidden, from hidden/visible pairs on the trial clock, up to `endMs` for one left open. */
export function hiddenTime(focusEvents, endMs) {
  let total = 0, since = null
  for (const e of focusEvents || []) {
    if (e.type === 'hidden' && since === null) since = e.t
    else if (e.type === 'visible' && since !== null) { total += Math.max(0, e.t - since); since = null }
  }
  if (since !== null && typeof endMs === 'number') total += Math.max(0, endMs - since)
  return total
}

/**
 * The end of a run: the engine's readout and counts of what was shown (compliance counts over every row).
 * `fullscreen`: fullscreen.js's summary() (null when there was none, as in the node tests).
 */
export function makeResultRecord({ runId, trials, readout, status = 'completed', completedAt, engineMode = null, fullscreen = null }) {
  const rows = trials || []
  return plain({
    schema: RESULT_SCHEMA,
    run_id: runId,
    completed_at: completedAt ?? new Date().toISOString(),
    status,
    engine_mode: engineMode,
    n_rows: rows.length,
    n_practice: rows.filter(r => r.phase === 'practice').length,
    n_main: rows.filter(r => r.phase === 'main').length,
    n_repeats: rows.filter(r => r.phase === 'repeat').length,
    n_interrupted: rows.filter(r => r.interrupted).length,
    n_withheld: rows.filter(r => r.phase === 'main' && r.response !== null && r.engine_response === null).length,
    n_noncompliant: rows.filter(r => r.compliant === false).length,
    n_compliance_not_assessed: rows.filter(r => r.compliant === null || r.compliant === undefined).length,
    n_reminder_lines: rows.filter(r => r.reminder_shown).length,
    n_reminder_pages: rows.filter(r => r.reminder_page_shown).length,
    n_fullscreen_exits: fullscreen ? fullscreen.exits : null,
    n_fullscreen_return_pages: rows.filter(r => r.fullscreen_return_shown).length,
    n_interrupted_fullscreen: rows.filter(r => (r.interruption_reasons || []).includes('fullscreen_exit')).length,
    fullscreen: fullscreen ?? null,
    readout: readout ?? null,
  })
}
