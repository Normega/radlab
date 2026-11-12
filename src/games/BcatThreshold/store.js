// ── BCAT threshold: where a run's data go ──────────────────────────────────
//
// Pure and node-testable (store.test.mjs). The ONE door through which the task's data leave it. The task
// code calls only these four methods; Stage C swaps createMemoryStore for a Supabase-backed store with the
// same methods and the task does not change.
//
//   saveRun(run)          once per run, before its first trial (bcat_threshold_runs)
//   saveTrial(trial)      once per trial, as it ends; unique on (run_id, seq) (bcat_threshold_trials)
//   saveResult(result)    once per run, at the end (bcat_threshold_results)
//   flush()               resolves to { unsaved } when everything handed over is stored or has failed
//
// Every method returns a promise. Append-only (CLAUDE.md, data logging rule 5): nothing is ever overwritten.
// A second save of the same row is refused with StoreConflictError, never merged; a trial or result for a
// run that was never saved is refused too. Rows are deep-copied on the way in, so a caller that keeps
// mutating its object cannot change what was stored.
//
// Identity (user, study, schedule, is_test) is not in the rows. The store is made with it (`context`), and
// the database store adds it on insert, so the task code never handles a participant identifier. The memory
// store keeps the context but never puts it in a row or a download.
//
// The row shapes are made by records.js.

export class StoreConflictError extends Error {
  constructor(message, details) { super(message); this.name = 'StoreConflictError'; this.details = details }
}

const clone = v => structuredClone(v)

/** In-memory store: this tab only, gone on reload. For Stage B and for previews (where it is all there is). */
export function createMemoryStore(context = {}) {
  const runs = new Map(), trials = new Map(), results = new Map()
  const requireRun = (row, what) => {
    if (!row || typeof row.run_id !== 'string' || !row.run_id) throw new TypeError(`${what}: run_id is required`)
    if (!runs.has(row.run_id)) throw new StoreConflictError(`${what}: run ${row.run_id} was never saved`, { run_id: row.run_id })
  }
  return {
    kind: 'memory',
    context: Object.freeze({ ...context }),
    async saveRun(run) {
      if (!run || typeof run.id !== 'string' || !run.id) throw new TypeError('saveRun: run.id is required')
      if (runs.has(run.id)) throw new StoreConflictError(`saveRun: run ${run.id} is already saved`, { run_id: run.id })
      runs.set(run.id, clone(run))
      trials.set(run.id, new Map())
      return { id: run.id }
    },
    async saveTrial(trial) {
      requireRun(trial, 'saveTrial')
      if (!Number.isInteger(trial.seq) || trial.seq < 1) throw new TypeError('saveTrial: seq must be a whole number >= 1')
      const byRun = trials.get(trial.run_id)
      if (byRun.has(trial.seq)) throw new StoreConflictError(`saveTrial: run ${trial.run_id} already has trial ${trial.seq}`, { run_id: trial.run_id, seq: trial.seq })
      byRun.set(trial.seq, clone(trial))
      return { run_id: trial.run_id, seq: trial.seq }
    },
    async saveResult(result) {
      requireRun(result, 'saveResult')
      if (results.has(result.run_id)) throw new StoreConflictError(`saveResult: run ${result.run_id} already has a result`, { run_id: result.run_id })
      results.set(result.run_id, clone(result))
      return { run_id: result.run_id }
    },
    async flush() { return { unsaved: 0 } },
    /** Everything stored for one run, as copies: { run, trials (by seq), result }. Not part of the Stage C interface. */
    snapshot(runId) {
      if (!runs.has(runId)) return null
      return {
        run: clone(runs.get(runId)),
        trials: [...trials.get(runId).values()].sort((a, b) => a.seq - b.seq).map(clone),
        result: results.has(runId) ? clone(results.get(runId)) : null,
      }
    },
  }
}
