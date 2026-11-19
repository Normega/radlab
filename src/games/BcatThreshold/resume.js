// ── BCAT threshold: finding and planning a resume (Stage C) ────────────────
//
// loadSession() reads what this participant has saved for this session (user, study and schedule row); it is
// the only read the step makes. planResume() is pure (resume.test.mjs) and decides what the step does with it.
// Norm's rules (PLAN.md, rulings of 2026-11-19, 10 and 11):
//
//   nothing saved            'fresh': a new run.
//   a result exists          'complete' when its status is 'completed' (the step completes at once, nothing is
//                            shown); otherwise 'ended' with that status (practice_failed, timed_out,
//                            engine_changed): the same end page again, the step does not complete.
//   engine changed           'refuse': the tip run's engine_version or config_hash is not this code's. The old run
//                            is never continued; the step records a result 'engine_changed' on it and shows a page
//                            saying the session cannot be continued (fail closed). A changed arm or mode refuses
//                            the same way ('run_mismatch').
//   past the time limit      'timed_out': elapsed time, from the first saved trial of the chain (the first practice
//                            trial), is at or past cfg.session.max_total_ms. The step records a result 'timed_out'
//                            (with the readout of what exists) and shows the time-limit page. Elapsed is the larger
//                            of the participant's clock (now - that trial's wallclock_start) and the server's
//                            (the last saved row's received_at - that trial's received_at, a lower bound), so
//                            setting the computer's clock back does not buy time.
//   otherwise                'resume': a new run row with resumed_from = the tip, the same seed. Practice is redone
//                            when no saved row has practice_completed true (the practice gate keeps counting its
//                            sets across the reload, so a reload never buys extra sets); else the saved engine trials
//                            are replayed (`restore`, in the worker) and the engine's next trial, which was on screen
//                            or about to be when the page closed, is treated by the interruption rule: recorded as a
//                            main row with lost_on_reload, interruption_reason 'page_closed', no answer, sent to the
//                            engine as unanswered, and repeated once at the end as data only (Norm, 2026-11-12:
//                            "Interrupted trials ... Final."). When no main trial was saved yet, nothing is lost:
//                            the first engine trial is shown as usual. Repeats still owed are shown at the end.
//                            Compliance reminders, the moving average, the practice gate and whether the break
//                            was taken are rebuilt from the saved rows (session.js, `restore`).
// Several chains for one session (two tabs that both started fresh) are not merged: the most recent tip is
// continued. A failed read never counts as "nothing saved" (loadSession throws; the step shows its error).

import { configHash } from './config.js'
import { savedTrial } from './engine/replay.js'
import { changeIndex } from './engine/adaptive.js'
import { StoreError } from './dbStore.js'

const PAGE = 1000

async function pageAll(make) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1)
    if (error) throw new StoreError(error.code === 'PGRST205' || error.code === '42P01' ? 'missing' : 'lookup', `bcat threshold: lookup failed: ${error.message}`, error)
    out.push(...(data || []))
    if (!data || data.length < PAGE) return out
  }
}

/**
 * Everything saved for this session. Filters by user_id explicitly: a lab account also matches the lab read
 * policy and would otherwise see every participant's rows.
 * @returns {Promise<{ runs: object[], results: object[], trialsByRun: Record<string, object[]> }>}
 */
export async function loadSession(db, { userId, studyId, scheduleId }) {
  if (!userId || !studyId || !scheduleId) throw new StoreError('no_context', 'loadSession: userId, studyId and scheduleId are required')
  const runs = await pageAll(() => db.from('bcat_threshold_runs').select('*')
    .eq('user_id', userId).eq('study_id', studyId).eq('schedule_id', scheduleId).order('resume_index').order('received_at'))
  if (!runs.length) return { runs, results: [], trialsByRun: {} }
  const roots = [...new Set(runs.map(r => r.resume_root_id || r.id))]
  const results = await pageAll(() => db.from('bcat_threshold_results').select('run_id, root_run_id, status, completed_at, received_at')
    .eq('user_id', userId).in('root_run_id', roots).order('received_at'))
  const trialsByRun = {}
  for (const r of runs) {
    trialsByRun[r.id] = await pageAll(() => db.from('bcat_threshold_trials').select('*').eq('user_id', userId).eq('run_id', r.id).order('seq'))
  }
  return { runs, results, trialsByRun }
}

/** A trial spec (what present() and the timeline need) rebuilt from a saved row, for a repeat still owed. */
export function specFromRow(row, cfg) {
  const st = cfg.engine.stimulus
  return {
    trial_index: row.trial_index, cell: row.cell, placement: row.placement, is_change: !!row.is_change,
    cell_trial_index: row.cell_trial_index, requested_magnitude: row.requested_magnitude, magnitude: row.magnitude,
    log_ratio: row.log_ratio, clamped: !!row.clamped, reference_threshold: row.reference_threshold, target_dprime: row.target_dprime,
    baseline_pulse_s: st.baseline_pulse_s, n_lead_in_pulses: Number(st.n_lead_in_pulses), change_after_pulse: Number(st.change_after_pulse),
    change_index: changeIndex(st), changed_pulse_s: row.changed_pulse_s, pulse_durations_s: row.planned_pulses_s,
  }
}

const ms = iso => (typeof iso === 'string' ? Date.parse(iso) : NaN)

/** Elapsed time of a chain at `nowMs` (participant's clock), as the larger of the two clocks; null before any trial. */
export function chainElapsedMs(rows, nowMs) {
  const first = rows.find(r => r.phase === 'practice' || r.phase === 'main' || r.phase === 'repeat')
  if (!first) return null
  const client = ms(first.wallclock_start)
  const byClient = Number.isFinite(client) ? nowMs - client : null
  const lastRecv = Math.max(...rows.map(r => ms(r.received_at)).filter(Number.isFinite))
  const firstRecv = ms(first.received_at)
  const byServer = Number.isFinite(lastRecv) && Number.isFinite(firstRecv) ? lastRecv - firstRecv : null
  const vals = [byClient, byServer].filter(v => v !== null && Number.isFinite(v))
  return vals.length ? Math.max(0, ...vals) : null
}

/**
 * @param {{ runs, results, trialsByRun, cfg, arm, nowMs }} o
 * @returns {{ action: 'fresh' } | { action: 'complete'|'ended', result, status } | { action: 'refuse', reason, tip, chain, rows }
 *   | { action: 'timed_out', tip, chain, rows, elapsedMs, practiceCompleted, engineTrials }
 *   | { action: 'resume', tip, chain, rows, elapsedMs, practiceCompleted, engineTrials, lostTrial, pending, repeated, mainShown, breakTaken }}
 */
export function planResume({ runs, results, trialsByRun, cfg, arm, nowMs }) {
  if (!runs || !runs.length) return { action: 'fresh' }
  if (results && results.length) {
    const done = results.find(r => r.status === 'completed')
    const r = done || results[results.length - 1]
    return { action: done ? 'complete' : 'ended', result: r, status: r.status }
  }
  const byId = new Map(runs.map(r => [r.id, r]))
  const continued = new Set(runs.map(r => r.resumed_from).filter(Boolean))
  const tips = runs.filter(r => !continued.has(r.id))
  const t = r => ms(r.received_at) || ms(r.started_at) || 0
  const tip = tips.reduce((a, b) => (t(b) >= t(a) ? b : a))
  const chain = []
  for (let r = tip; r; r = r.resumed_from ? byId.get(r.resumed_from) : null) {
    if (chain.includes(r)) break
    chain.unshift(r)
  }
  const rows = chain.flatMap(r => (trialsByRun[r.id] || []).slice().sort((a, b) => a.seq - b.seq))
  if (tip.engine_version !== cfg.engine_version || tip.config_hash !== configHash(cfg.engine)) return { action: 'refuse', reason: 'engine_changed', tip, chain, rows }
  if (tip.arm !== arm || tip.mode !== cfg.mode || !Number.isInteger(Number(tip.seed))) return { action: 'refuse', reason: 'run_mismatch', tip, chain, rows }
  const practiceCompleted = !cfg.practice.enabled || rows.some(r => r.phase === 'practice' && r.practice_completed === true) || rows.some(r => r.phase === 'main')
  const engineTrials = rows.filter(r => r.sent_to_engine).map(r => savedTrial(r, r.engine_response))
  const elapsedMs = chainElapsedMs(rows, nowMs)
  const limit = cfg.session.max_total_ms
  if (limit !== null && limit !== undefined && elapsedMs !== null && elapsedMs >= limit) {
    return { action: 'timed_out', tip, chain, rows, elapsedMs, practiceCompleted, engineTrials }
  }
  const mains = rows.filter(r => r.phase === 'main')
  const repeatedOf = new Set(rows.filter(r => r.phase === 'repeat').map(r => r.repeat_of))
  const queued = mains.filter(r => r.repeat_queued)
  return {
    action: 'resume', tip, chain, rows, elapsedMs, practiceCompleted, engineTrials,
    lostTrial: practiceCompleted && mains.length > 0,
    pending: queued.filter(r => !repeatedOf.has(r.trial_index)).map(r => ({ spec: specFromRow(r, cfg), repeatOf: r.trial_index })),
    repeated: queued.map(r => r.trial_index),
    mainShown: mains.length,
    breakTaken: rows.some(r => r.break_before),
    breakFacts: rows.find(r => r.break_before)?.break_before ?? null,
  }
}
