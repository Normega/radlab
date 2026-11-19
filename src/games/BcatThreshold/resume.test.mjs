// Resume after a reload: the engine's `restore` message, planResume's decisions, and whole sessions cut at
// several points and resumed, against the run they should equal.
// Run: node --test src/games/BcatThreshold/resume.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeConfig, configHash, ENGINE_VERSION } from './config.js'
import { createEngineClient } from './engineClient.js'
import { makeController } from './engine/adaptive.js'
import { makeTaskController } from './engine/taskController.js'
import { savedTrial } from './engine/replay.js'
import { createSimulatedPresenter } from './simulate.js'
import { createTrialSequence } from './sequence.js'
import { createCompliance } from './compliance.js'
import { makeRunRecord, makeResultRecord } from './records.js'
import { runSession } from './session.js'
import { buildTrialPlan } from './trialPlan.js'
import { planResume, chainElapsedMs, specFromRow } from './resume.js'

const ARM = 'touch'

// A participant whose answer depends only on the trial, so two runs that show different trials in between still
// answer each trial the same way (the simulated observer's draws would drift apart).
function participant(cfg, seed, { closeAtMain = null, interruptMain = null, offPractice = () => false } = {}) {
  const sim = createSimulatedPresenter({ cfg, arm: ARM, seed, offTask: (n, phase) => phase === 'practice' && offPractice(n) })
  let main = 0
  const present = async req => {
    if (req.phase === 'main') {
      main += 1
      if (closeAtMain !== null && main === closeAtMain) return { cancelled: true }   // the page closes during this trial
    }
    const out = await sim(req)
    if (out.no_trial) return out
    const s = out.pres.spec
    const response = !s.is_change ? 'same' : s.magnitude > 0.15 ? (s.cell === 'speeding' ? 'sped_up' : 'slowed') : 'same'
    const res = { ...out, answer: { ...out.answer, response } }
    if (req.phase === 'main' && interruptMain === main) return { ...res, interrupted: true, interruptionReasons: ['blur'], focusEvents: [{ type: 'blur', t: 3000 }] }
    return res
  }
  present.now = sim.now
  return present
}

async function session({ seed, present, restore = null, runId, cancelAfter = null }) {
  const cfg = makeConfig({ demo: true })
  const engine = createEngineClient({ worker: false })
  const rows = []
  let cancelled = false
  const sequence = createTrialSequence(undefined, restore ? { pending: restore.pending, repeated: restore.repeated, withheld: restore.withheld } : null)
  const out = await runSession({ cfg, arm: ARM, seed, engine, present, sequence, runId, compliance: createCompliance({ cfg, arm: ARM }),
    saveTrial: async r => { rows.push(r); if (cancelAfter && cancelAfter(r)) cancelled = true },
    isCancelled: () => cancelled, plannedTrials: buildTrialPlan(cfg, seed).counts.total, clock: present.now, restore })
  const readout = out.status === 'completed' ? (await engine.call({ type: 'readout' })).readout : null
  engine.terminate()
  return { cfg, out, rows, readout }
}

// The saved state after a session that stopped, as loadSession would return it.
function saved(cfg, seed, rows, { runId = 'run-a', engine_version = ENGINE_VERSION, hash = configHash(cfg.engine) } = {}) {
  const run = { ...makeRunRecord({ id: runId, arm: ARM, cfg, seed, kind: 'study' }), engine_version, config_hash: hash, resume_index: 0, resume_root_id: runId, received_at: '2026-11-19T10:00:00Z' }
  return { runs: [run], results: [], trialsByRun: { [runId]: rows } }
}

const engineSeq = rows => rows.filter(r => r.phase === 'main').map(r => [r.trial_index, r.cell, r.placement, +r.magnitude.toFixed(12), r.engine_response])

test('restore: the controller after a restore offers the same next trial and answers the same as the uninterrupted one', () => {
  const cfg = makeConfig({ demo: true }).engine, seed = 99
  const live = makeController(() => 0)
  let r = live({ type: 'init', cfg, seed }), trials = []
  const answers = ['same', 'sped_up', 'slowed', null, 'same', 'slowed']
  for (const a of answers) { trials.push(savedTrial(r.trial ?? r.next_trial, a)); r = live({ type: 'respond', trial_index: (r.trial ?? r.next_trial).trial_index, response: a }) }
  const task = makeTaskController(() => 0)
  const back = task({ type: 'restore', cfg, seed, trials, expect: { engine_version: ENGINE_VERSION, config_hash: configHash(cfg) } })
  assert.equal(back.restored, true)
  assert.equal(back.n_replayed, answers.length)
  assert.deepStrictEqual(back.trial, r.next_trial)
  const a = live({ type: 'respond', trial_index: r.next_trial.trial_index, response: 'sped_up' })
  const b = task({ type: 'respond', trial_index: back.trial.trial_index, response: 'sped_up' })
  assert.deepStrictEqual(b.running, a.running)
  assert.deepStrictEqual(b.next_trial, a.next_trial)
})

test('restore is refused after an engine change, without expect, and on a wrong seed', () => {
  const cfg = makeConfig({ demo: true }).engine
  const task = makeTaskController(() => 0)
  const t1 = task({ type: 'init', cfg, seed: 5 }).trial
  const trials = [savedTrial(t1, 'same')]
  assert.throws(() => task({ type: 'restore', cfg, seed: 5, trials, expect: { engine_version: 'sdt-0.0+old', config_hash: configHash(cfg) } }), /engine/)
  assert.throws(() => task({ type: 'restore', cfg, seed: 5, trials, expect: { engine_version: ENGINE_VERSION, config_hash: 'fnv1a64:0000000000000000' } }), /config hash/)
  assert.throws(() => task({ type: 'restore', cfg, seed: 5, trials }), /expect/)
  const many = []
  let r = task({ type: 'init', cfg, seed: 5 })
  for (let i = 0; i < 6; i++) { const t = r.trial ?? r.next_trial; many.push(savedTrial(t, 'sped_up')); r = task({ type: 'respond', trial_index: t.trial_index, response: 'sped_up' }) }
  assert.throws(() => task({ type: 'restore', cfg, seed: 6, trials: many, expect: { engine_version: ENGINE_VERSION, config_hash: configHash(cfg) } }), /restore offers|finished/)
})

test('planResume: fresh, complete at once, the same end page, refused on an engine change', () => {
  const cfg = makeConfig({ demo: true })
  assert.deepStrictEqual(planResume({ runs: [], results: [], trialsByRun: {}, cfg, arm: ARM, nowMs: 0 }), { action: 'fresh' })
  const base = saved(cfg, 3, [])
  assert.equal(planResume({ ...base, results: [{ run_id: 'run-a', root_run_id: 'run-a', status: 'completed' }], cfg, arm: ARM, nowMs: 0 }).action, 'complete')
  const ended = planResume({ ...base, results: [{ run_id: 'run-a', root_run_id: 'run-a', status: 'practice_failed' }], cfg, arm: ARM, nowMs: 0 })
  assert.deepStrictEqual([ended.action, ended.status], ['ended', 'practice_failed'])
  assert.deepStrictEqual([planResume({ ...saved(cfg, 3, [], { engine_version: 'sdt-old' }), cfg, arm: ARM, nowMs: 0 }).action, planResume({ ...saved(cfg, 3, [], { engine_version: 'sdt-old' }), cfg, arm: ARM, nowMs: 0 }).reason], ['refuse', 'engine_changed'])
  assert.equal(planResume({ ...saved(cfg, 3, [], { hash: 'fnv1a64:0123456789abcdef' }), cfg, arm: ARM, nowMs: 0 }).reason, 'engine_changed')
  assert.equal(planResume({ ...base, cfg, arm: 'vision', nowMs: 0 }).reason, 'run_mismatch')
})

test('planResume: past the time limit, counted from the first trial on both clocks, cannot be resumed', () => {
  const cfg = makeConfig({ demo: true })
  const t0 = Date.parse('2026-11-19T10:00:00Z')
  const rows = [
    { phase: 'practice', seq: 1, wallclock_start: new Date(t0).toISOString(), received_at: new Date(t0 + 15000).toISOString(), practice_completed: null },
    { phase: 'practice', seq: 2, wallclock_start: new Date(t0 + 20000).toISOString(), received_at: new Date(t0 + 35000).toISOString(), practice_completed: null },
  ]
  const s = saved(cfg, 3, rows)
  assert.equal(planResume({ ...s, cfg, arm: ARM, nowMs: t0 + 30 * 60000 }).action, 'resume')
  const late = planResume({ ...s, cfg, arm: ARM, nowMs: t0 + 61 * 60000 })
  assert.equal(late.action, 'timed_out')
  assert.ok(late.elapsedMs >= 61 * 60000)
  // the computer's clock set back an hour: the server's received_at still shows how long it has been
  const setBack = rows.map((r, i) => (i === 1 ? { ...r, received_at: new Date(t0 + 62 * 60000).toISOString() } : r))
  assert.equal(planResume({ ...saved(cfg, 3, setBack), cfg, arm: ARM, nowMs: t0 - 3600000 }).action, 'timed_out')
  assert.equal(chainElapsedMs([], t0), null, 'no trial yet: the limit has not started')
})

test('practice is redone when no row says it was completed; its sets keep counting across the reload', async () => {
  const seed = 31
  // set 1 all off task (the gate is missed), then the page closes during set 2
  const a = await session({ seed, runId: 'run-a', present: participant(makeConfig({ demo: true }), seed, { offPractice: n => n <= 3 }),
    cancelAfter: r => r.phase === 'practice' && r.practice_set === 2 && r.trial_index === 1 })
  assert.equal(a.out.cancelled, true)
  const plan = planResume({ ...saved(a.cfg, seed, a.rows), cfg: a.cfg, arm: ARM, nowMs: Date.now() })
  assert.equal(plan.action, 'resume')
  assert.equal(plan.practiceCompleted, false)
  assert.equal(plan.engineTrials.length, 0)
  const b = await session({ seed, runId: 'run-b', present: participant(a.cfg, seed), restore: plan })
  const pr = b.rows.filter(r => r.phase === 'practice')
  assert.deepStrictEqual(pr.map(r => r.practice_set), [2, 2, 2], 'set 1 was judged; set 2 was cut off before its verdict, so it is redone as set 2')
  assert.equal(b.out.practice.sets_used, 2)
  assert.equal(b.out.practice.sets[0].verdict, 'retry', 'the verdict of the first set is carried over')
  assert.equal(pr[2].practice_gate.verdict, 'passed')
  assert.equal(b.out.status, 'completed')
  assert.deepStrictEqual(engineSeq(b.rows), engineSeq((await session({ seed, runId: 'ref', present: participant(a.cfg, seed) })).rows), 'the main trials as in a run that never reloaded')
})

for (const k of [0, 2, 5]) {
  test(`a reload during main trial ${k + 1}: replay, the lost trial by the interruption rule, the same session as a run where it was interrupted`, async () => {
    const seed = 40 + k
    const cfg = makeConfig({ demo: true })
    const ref = await session({ seed, runId: 'ref', present: participant(cfg, seed, { interruptMain: k === 0 ? null : k + 1 }) })
    const a = await session({ seed, runId: 'run-a', present: participant(cfg, seed, { closeAtMain: k + 1 }) })
    assert.equal(a.rows.filter(r => r.phase === 'main').length, k)
    const plan = planResume({ ...saved(cfg, seed, a.rows), cfg, arm: ARM, nowMs: Date.now() })
    assert.equal(plan.action, 'resume')
    assert.equal(plan.practiceCompleted, true)
    assert.equal(plan.lostTrial, k > 0, 'with no saved main trial nothing was lost')
    const b = await session({ seed, runId: 'run-b', present: participant(cfg, seed), restore: plan })
    assert.equal(b.out.status, 'completed')
    assert.equal(b.rows.filter(r => r.phase === 'practice').length, 0, 'practice is not redone')
    const lost = b.rows.filter(r => r.lost_on_reload)
    if (k > 0) {
      assert.equal(lost.length, 1)
      assert.deepStrictEqual([lost[0].seq, lost[0].phase, lost[0].interrupted, lost[0].interruption_reason, lost[0].response, lost[0].engine_response, lost[0].repeat_queued],
        [1, 'main', true, 'page_closed', null, null, true])
      assert.equal(b.rows.filter(r => r.phase === 'repeat' && r.repeat_of === lost[0].trial_index).length, 1, 'shown once more at the end, data only')
    } else assert.equal(lost.length, 0)
    // the engine saw exactly what it saw in the reference run (the lost trial as the interrupted one)
    const chain = [...a.rows, ...b.rows]
    assert.deepStrictEqual(engineSeq(chain), engineSeq(ref.rows))
    assert.deepStrictEqual(b.readout.cells.speeding.threshold, ref.readout.cells.speeding.threshold)
    assert.deepStrictEqual(b.readout.cells.slowing.threshold, ref.readout.cells.slowing.threshold)
    assert.equal(b.readout.n_trials_total, ref.readout.n_trials_total)
    // the result counts the whole chain
    const res = makeResultRecord({ runId: 'run-b', trials: chain, readout: b.readout, session: b.out })
    assert.equal(res.n_main, ref.rows.filter(r => r.phase === 'main').length)
  })
}

test('the break, the reminders and the moving average are rebuilt from the saved rows', async () => {
  const seed = 52
  const cfg = makeConfig({ demo: true })
  const ref = await session({ seed, runId: 'ref', present: participant(cfg, seed) })
  const at = ref.rows.find(r => r.break_before).break_before.after_main
  // closed after the break was taken (two main trials past it)
  const a = await session({ seed, runId: 'run-a', present: participant(cfg, seed, { closeAtMain: at + 3 }) })
  assert.equal(a.rows.filter(r => r.break_before).length, 1)
  const plan = planResume({ ...saved(cfg, seed, a.rows), cfg, arm: ARM, nowMs: Date.now() })
  assert.equal(plan.breakTaken, true)
  const b = await session({ seed, runId: 'run-b', present: participant(cfg, seed), restore: plan })
  assert.equal(b.rows.filter(r => r.break_before).length, 0, 'no second break')
  assert.equal(b.out.break.taken, true, 'the result says the break was taken (before the reload)')
  const firstNew = b.rows.find(r => r.phase === 'main' && !r.lost_on_reload)
  assert.ok(firstNew.moving_window_n >= 2, 'the moving window carries the trials saved before the reload')
  // closed before the break was due: it comes once, after the reload
  const c = await session({ seed, runId: 'run-a', present: participant(cfg, seed, { closeAtMain: at }) })
  const plan2 = planResume({ ...saved(cfg, seed, c.rows), cfg, arm: ARM, nowMs: Date.now() })
  assert.equal(plan2.breakTaken, false)
  const d = await session({ seed, runId: 'run-b', present: participant(cfg, seed), restore: plan2 })
  assert.equal(d.rows.filter(r => r.break_before).length, 1)
})

test('repeats still owed after a reload are shown at the end, once', async () => {
  const seed = 61
  const cfg = makeConfig({ demo: true })
  const a = await session({ seed, runId: 'run-a', present: participant(cfg, seed, { interruptMain: 2, closeAtMain: 4 }) })
  const plan = planResume({ ...saved(cfg, seed, a.rows), cfg, arm: ARM, nowMs: Date.now() })
  assert.equal(plan.pending.length, 1)
  assert.equal(plan.pending[0].repeatOf, a.rows.filter(r => r.phase === 'main')[1].trial_index)
  assert.deepStrictEqual(plan.pending[0].spec.pulse_durations_s, a.rows.filter(r => r.phase === 'main')[1].planned_pulses_s)
  const b = await session({ seed, runId: 'run-b', present: participant(cfg, seed), restore: plan })
  assert.deepStrictEqual(b.rows.filter(r => r.phase === 'repeat').map(r => r.repeat_of).sort((x, y) => x - y),
    [plan.pending[0].repeatOf, b.rows.find(r => r.lost_on_reload).trial_index].sort((x, y) => x - y))
})

test('specFromRow rebuilds a trial the timeline can draw', () => {
  const cfg = makeConfig({ demo: true })
  const row = { trial_index: 4, cell: 'slowing', placement: 'infogain', is_change: true, magnitude: 0.3, log_ratio: 0.3, changed_pulse_s: 5.4, planned_pulses_s: [4, 4, 5.4, 5.4] }
  const s = specFromRow(row, cfg)
  assert.equal(s.change_index, 2)
  assert.deepStrictEqual(s.pulse_durations_s, [4, 4, 5.4, 5.4])
})

// A chainable fake of supabase-js reads: records every filter, answers from `tables` (or with `error`).
function fakeReadDb({ tables = {}, error = null } = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      const q = { table, filters: [] }
      calls.push(q)
      const chain = {
        select() { return chain },
        eq(col, v) { q.filters.push(['eq', col, v]); return chain },
        in(col, v) { q.filters.push(['in', col, v]); return chain },
        order() { return chain },
        range(a, b) {
          if (error) return Promise.resolve({ data: null, error })
          let rows = (tables[table] || []).filter(r => q.filters.every(([op, c, v]) => (op === 'eq' ? r[c] === v : v.includes(r[c]))))
          rows = rows.slice(a, b + 1)
          return Promise.resolve({ data: rows, error: null })
        },
      }
      return chain
    },
  }
}

test('loadSession filters every read by user_id, and by study and schedule for the runs', async () => {
  const { loadSession } = await import('./resume.js')
  const db = fakeReadDb({ tables: {
    bcat_threshold_runs: [{ id: 'a', user_id: 'u', study_id: 's', schedule_id: 'p', resume_root_id: 'a' }, { id: 'x', user_id: 'other', study_id: 's', schedule_id: 'p', resume_root_id: 'x' }],
    bcat_threshold_trials: [{ run_id: 'a', user_id: 'u', seq: 1 }, { run_id: 'x', user_id: 'other', seq: 1 }],
    bcat_threshold_results: [],
  } })
  const got = await loadSession(db, { userId: 'u', studyId: 's', scheduleId: 'p' })
  assert.deepStrictEqual(got.runs.map(r => r.id), ['a'], 'another participant\'s run (visible to a lab account) is never picked up')
  assert.deepStrictEqual(Object.keys(got.trialsByRun), ['a'])
  for (const c of db.calls) assert.ok(c.filters.some(([op, col, v]) => op === 'eq' && col === 'user_id' && v === 'u'), `${c.table}: filtered by user_id`)
  const runQ = db.calls.find(c => c.table === 'bcat_threshold_runs')
  assert.ok(runQ.filters.some(f => f[1] === 'schedule_id' && f[2] === 'p') && runQ.filters.some(f => f[1] === 'study_id' && f[2] === 's'))
})

test('loadSession fails closed: tables missing or a failed read throw; they never read as "nothing saved"', async () => {
  const { loadSession } = await import('./resume.js')
  await assert.rejects(loadSession(fakeReadDb({ error: { code: 'PGRST205', message: 'Could not find the table' } }), { userId: 'u', studyId: 's', scheduleId: 'p' }),
    e => e.kind === 'missing')
  await assert.rejects(loadSession(fakeReadDb({ error: { code: '', message: 'Failed to fetch' } }), { userId: 'u', studyId: 's', scheduleId: 'p' }),
    e => e.kind === 'lookup')
  await assert.rejects(loadSession(fakeReadDb(), { userId: 'u', studyId: 's', scheduleId: null }), e => e.kind === 'no_context')
})
