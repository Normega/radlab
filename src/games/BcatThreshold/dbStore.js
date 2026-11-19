// ── BCAT threshold: the database store (Stage C) ───────────────────────────
//
// Pure apart from the client it is given, and node-testable with a fake one (dbStore.test.mjs). The same four
// methods as createMemoryStore (store.js): saveRun, saveTrial, saveResult, flush. It writes the three tables of
// the migration draft (NextStudy/Thresholds/7_radlab_site_plan/stage_c_migration_draft/, "DRAFT, NOT APPLIED"):
//   bcat_threshold_runs, bcat_threshold_trials, bcat_threshold_results
// NOTHING HERE IS APPLIED. Until the migration is, every insert fails (PostgREST: table not found), the store
// reports it as `table_missing`, and the step shows its error screen before any trial (fail closed).
//
// Rows. Each insert is built by toRow() from an explicit column list per table (COLUMNS, matching the draft),
// never by spreading the record: a record field the list does not know goes into `extra` (jsonb), so a new fact
// needs no migration and PostgREST never sees an unknown column. The store adds user_id, study_id and
// schedule_id (identity stays out of records.js); it never sends is_test, resume_index, resume_root_id,
// root_run_id or received_at, which the database sets on insert (is_test from the enrollment). No external
// (Prolific) id ever reaches a row.
//
// Errors. supabase-js returns { error } and never throws on a database error, so every insert reads its error
// (src/lib/responseInsertsChecked.test.mjs). An error is classed by classify():
//   saved      23505 on a key a retry of this same row would hit: the run's primary key, a trial's (run_id, seq)
//              or its main trial_index, a result's run_id. The row is already stored.
//   conflict   23505 on another key: a second tab resuming the same run (runs.resumed_from) or finishing the same
//              session (results.root_run_id). Permanent; the step stops.
//   missing    the table is not there (PGRST205, 42P01): the migration is not applied. Permanent.
//   transient  no response or a server-side hiccup (no code, 08xxx, 40001, 40P01, 53xxx, 57014, PGRST000-003,
//              HTTP 5xx): retried with backoff.
//   permanent  anything else (23514 no enrollment, 42501 RLS, 23503, 22xxx ...). Not retried.
// saveRun waits for its insert (with retries): a run that is not stored never starts. saveTrial and saveResult
// queue the row and send it at once; transient failures are retried in the background with backoff. `problem`
// is the first permanent failure, and `stalled` is true once a queued row has used up its retries: the step
// checks both before every trial (session.js beforeTrial) and stops or waits at once, not after the last trial
// (review item 5). flush() re-sends everything unsaved and resolves to { unsaved, failed, problem } only when
// every row has settled; the step completes only on { unsaved: 0 }.

import { createMemoryStore } from './store.js'

/**
 * Which store a mounted step uses (review item 6: a study step never runs on the memory store).
 *   preview (not a study step)              memory, nothing leaves the tab
 *   study step, simulated (admin ?sim=1,    memory: a simulated run never writes to the database
 *     or a simulated observer)
 *   study step, real                        database; refused (fail closed) with no enrollment, no client, or no
 *                                           user, study or schedule
 * @returns {{ store: object, kind: 'memory'|'database' } | { error: 'no_enrollment'|'no_database'|'no_context' }}
 */
export function pickStore({ studyMode, isSimMode = false, simulate = false, db = null, userId = null, studyId = null, scheduleId = null, enrollmentId = null, ...opts }) {
  if (!studyMode) return { store: createMemoryStore({ preview: true }), kind: 'memory' }
  if (isSimMode || simulate) return { store: createMemoryStore({ simulated: true }), kind: 'memory' }
  if (!enrollmentId) return { error: 'no_enrollment' }
  if (!db || typeof db.from !== 'function') return { error: 'no_database' }
  try {
    return { store: createDatabaseStore({ db, userId, studyId, scheduleId, ...opts }), kind: 'database' }
  } catch (e) {
    return { error: e && e.kind ? e.kind : 'no_context' }
  }
}

export const TABLES = Object.freeze({ runs: 'bcat_threshold_runs', trials: 'bcat_threshold_trials', results: 'bcat_threshold_results' })

// Columns the client sends, per table: the record's own fields (records.js), then the identity the store adds.
// Must match the migration draft. Columns the database fills (id defaults, is_test, received_at, resume_*,
// root_run_id, the generated readout columns) are not here.
export const COLUMNS = Object.freeze({
  bcat_threshold_runs: Object.freeze([
    'id', 'schema', 'started_at', 'kind', 'arm', 'mode', 'demo', 'engine_version', 'config_hash', 'config', 'seed',
    'planned_trials', 'interruption_policy', 'engine_mode', 'frame_period_ms', 'client', 'fullscreen', 'resumed_from',
    'resume_state', 'run_start_perf_ms', 'perf_time_origin_ms',
  ]),
  bcat_threshold_trials: Object.freeze([
    'run_id', 'schema', 'seq', 'phase', 'trial_index', 'repeat_of', 'trial_type', 'cell', 'placement', 'direction',
    'is_change', 'cell_trial_index', 'magnitude', 'requested_magnitude', 'log_ratio', 'clamped', 'target_dprime',
    'reference_threshold', 'changed_pulse_s', 'planned_pulses_s', 'planned_boundaries_ms', 'delivered_boundaries_ms',
    'boundary_error_ms', 'delivered_pulses_ms', 'response', 'response_key', 'rt_ms', 'sent_to_engine', 'engine_response',
    'interrupted', 'interruption_reason', 'interruption_reasons', 'repeat_queued', 'focus_events', 'n_blur', 'n_hidden',
    'hidden_ms', 'fullscreen_at_onset', 'shown_fullscreen', 'fullscreen_exits', 'fullscreen_return_shown', 'posterior',
    'scoring', 'procedure_ms', 'key_events', 'key_repeats', 'key_blurs', 'key_summary', 'compliant', 'compliance_skip',
    'compliance_coverage', 'compliance_ws_presses', 'compliance_ws_press_ms', 'noncompliant_streak', 'reminder_shown',
    'reminder_page_shown', 'practice_set', 'practice_gate', 'practice_completed', 'coverage_moving_avg',
    'ws_press_moving_share', 'moving_window_n', 'break_before', 'lost_on_reload', 'timing', 'wallclock_start',
  ]),
  bcat_threshold_results: Object.freeze([
    'run_id', 'schema', 'completed_at', 'status', 'engine_mode', 'n_rows', 'n_practice', 'n_main', 'n_repeats',
    'n_interrupted', 'n_withheld', 'n_noncompliant', 'n_compliance_not_assessed', 'n_reminder_lines', 'n_reminder_pages',
    'n_fullscreen_exits', 'n_fullscreen_return_pages', 'n_interrupted_fullscreen', 'fullscreen', 'readout',
    'timed_out', 'elapsed_ms', 'time_limit_ms', 'practice_completed', 'practice_passed', 'practice_sets', 'practice_gate',
    'break_taken', 'break_after_main', 'break_duration_ms', 'break_facts', 'moving_window', 'moving_n_full_windows',
    'coverage_moving_avg_min', 'exclusion_flag_coverage', 'ws_press_moving_share_max', 'n_runs',
  ]),
})
const IDENTITY = ['user_id', 'study_id', 'schedule_id']
// Set by the database whatever the client sends; a record must never carry them (toRow refuses).
const DB_SET = new Set(['is_test', 'received_at', 'resume_index', 'resume_root_id', 'root_run_id', 'user_id', 'study_id', 'schedule_id', 'extra'])

export class StoreError extends Error {
  constructor(kind, message, details) { super(message); this.name = 'StoreError'; this.kind = kind; this.details = details }
}

/**
 * One insert row from a record: the table's columns, the identity, and every other record field in `extra`.
 * @returns {{ row: object, extraKeys: string[] }}
 */
export function toRow(table, record, ctx) {
  const cols = COLUMNS[table]
  if (!cols) throw new Error(`toRow: unknown table ${table}`)
  if (!record || typeof record !== 'object') throw new TypeError('toRow: record must be an object')
  const row = {}, extra = {}
  for (const [k, v] of Object.entries(record)) {
    if (DB_SET.has(k)) throw new Error(`toRow: ${k} is set by the store or the database, never by a record`)
    if (cols.includes(k)) row[k] = v === undefined ? null : v
    else if (v !== undefined) extra[k] = v
  }
  for (const c of cols) if (!(c in row)) row[c] = null
  row.user_id = ctx.userId
  row.study_id = ctx.studyId
  row.schedule_id = ctx.scheduleId
  row.extra = extra
  return { row, extraKeys: Object.keys(extra) }
}

const constraintOf = e => {
  const m = /constraint "([^"]+)"/.exec(String((e && (e.message || '')) + ' ' + (e && (e.details || ''))))
  return m ? m[1] : null
}

// The keys whose duplicate means "this very row is already stored" (a retry of an insert that landed).
const SAVED_ON = {
  bcat_threshold_runs: ['bcat_threshold_runs_pkey'],
  bcat_threshold_trials: ['bcat_threshold_trials_run_id_seq_key', 'bcat_threshold_trials_run_main_trial', 'bcat_threshold_trials_pkey'],
  bcat_threshold_results: ['bcat_threshold_results_run_id_key'],
}

/** 'saved' | 'conflict' | 'missing' | 'transient' | 'permanent' */
export function classify(table, error) {
  if (!error) return 'saved'
  const code = String(error.code ?? '')
  const status = Number(error.status ?? 0)
  if (code === '23505') return SAVED_ON[table].includes(constraintOf(error)) ? 'saved' : 'conflict'
  if (code === 'PGRST205' || code === '42P01' || (status === 404 && /schema cache|does not exist/i.test(String(error.message)))) return 'missing'
  if (!code || /^(08|53)/.test(code) || ['40001', '40P01', '57014', 'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003'].includes(code)) return 'transient'
  if (status >= 500 && !/^(2|42)/.test(code)) return 'transient'
  return 'permanent'
}

// Each table's insert, written out so the result's `error` is read where the insert is made (one statement per
// table, which is what responseInsertsChecked.test.mjs looks for once these tables are in its RESPONSE_TABLES).
async function insertInto(db, table, row) {
  if (table === 'bcat_threshold_runs') {
    const { error } = await db.from('bcat_threshold_runs').insert(row)
    return error ?? null
  }
  if (table === 'bcat_threshold_trials') {
    const { error } = await db.from('bcat_threshold_trials').insert(row)
    return error ?? null
  }
  if (table === 'bcat_threshold_results') {
    const { error } = await db.from('bcat_threshold_results').insert(row)
    return error ?? null
  }
  throw new Error(`insertInto: unknown table ${table}`)
}

/**
 * @param {object} o
 * @param {object} o.db           a supabase-js client
 * @param {string} o.userId       the participant's account (profile) id; RLS checks it is auth.uid()
 * @param {string} o.studyId
 * @param {string} o.scheduleId   the participant_schedule row: which session (data rule 1)
 * @param {{ attempts?: number, baseMs?: number, maxMs?: number }} [o.retry]  per send; flush() starts a fresh budget
 * @param {(ms: number) => Promise<void>} [o.sleep]
 */
export function createDatabaseStore({ db, userId, studyId, scheduleId, retry = {}, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  if (!db || typeof db.from !== 'function') throw new StoreError('no_client', 'createDatabaseStore: a database client is required')
  for (const [k, v] of Object.entries({ userId, studyId, scheduleId })) {
    if (typeof v !== 'string' || !v) throw new StoreError('no_context', `createDatabaseStore: ${k} is required`)
  }
  const ctx = Object.freeze({ userId, studyId, scheduleId })
  const R = { attempts: 6, baseMs: 500, maxMs: 8000, ...retry }
  const jobs = []
  let problem = null
  const savedRuns = new Set()

  const backoff = n => Math.min(R.maxMs, R.baseMs * 2 ** n)
  async function send(job) {
    for (let n = 0; n < R.attempts; n++) {
      job.attempts += 1
      let error
      try { error = await insertInto(db, job.table, job.row) } catch (e) { error = { message: String(e && e.message || e), code: '' } }
      const kind = classify(job.table, error)
      if (kind === 'saved') { job.state = 'saved'; job.error = null; return job }
      job.error = error
      if (kind !== 'transient') {
        job.state = 'failed'
        job.kind = kind
        if (!problem) problem = new StoreError(kind, `${job.table} insert failed (${kind}): ${error && error.message}`, { table: job.table, code: error && error.code })
        console.warn(`${job.table} insert failed`, error)
        return job
      }
      if (n + 1 < R.attempts) await sleep(backoff(n))
    }
    job.state = 'unsaved'   // transient failures used up this send's retries; flush() sends it again
    console.warn(`${job.table} insert not saved yet`, job.error)
    return job
  }
  function queue(table, record) {
    const { row } = toRow(table, record, ctx)
    const job = { table, row, state: 'sending', attempts: 0, error: null, kind: null }
    job.promise = send(job)
    jobs.push(job)
    return job
  }

  return {
    kind: 'database',
    context: ctx,
    /** The first permanent failure, or null. */
    get problem() { return problem },
    /** A queued row has used up its retries: the step should wait for flush() before the next trial. */
    get stalled() { return jobs.some(j => j.state === 'unsaved') },
    /** Rows not stored yet (sending, unsaved or failed). */
    get unsaved() { return jobs.filter(j => j.state !== 'saved').length },
    async saveRun(run) {
      if (!run || typeof run.id !== 'string' || !run.id) throw new TypeError('saveRun: run.id is required')
      if (problem) throw problem
      const job = queue(TABLES.runs, run)
      await job.promise
      if (job.state !== 'saved') {
        throw job.state === 'failed' ? problem
          : new StoreError('unsaved', `bcat_threshold_runs: not saved after ${job.attempts} attempts`, { table: job.table })
      }
      savedRuns.add(run.id)
      return { id: run.id }
    },
    async saveTrial(trial) {
      if (!trial || !savedRuns.has(trial.run_id)) throw new StoreError('no_run', `saveTrial: run ${trial && trial.run_id} was never saved`)
      if (!Number.isInteger(trial.seq) || trial.seq < 1) throw new TypeError('saveTrial: seq must be a whole number >= 1')
      queue(TABLES.trials, trial)
      return { run_id: trial.run_id, seq: trial.seq, queued: true }
    },
    /** A run saved earlier (read back on a resume): a result may close it (a refused or timed-out resume). */
    adoptSavedRun(runId) { if (typeof runId === 'string' && runId) savedRuns.add(runId) },
    async saveResult(result) {
      if (!result || !savedRuns.has(result.run_id)) throw new StoreError('no_run', `saveResult: run ${result && result.run_id} was never saved`)
      queue(TABLES.results, result)
      return { run_id: result.run_id, queued: true }
    },
    /** Send again whatever is not stored, wait for every row, and say how many are still unsaved. */
    async flush() {
      await Promise.all(jobs.map(j => j.promise))
      const again = jobs.filter(j => j.state === 'unsaved')
      for (const j of again) { j.state = 'sending'; j.promise = send(j) }
      await Promise.all(again.map(j => j.promise))
      const unsaved = jobs.filter(j => j.state !== 'saved').length
      return { unsaved, failed: jobs.filter(j => j.state === 'failed').length, problem }
    },
  }
}
