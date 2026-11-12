// Headless checks for the store interface (in-memory implementation) and the row builders.
// Run: node --test src/games/BcatThreshold/store.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStore, StoreConflictError } from './store.js'
import { newSeed, newRunId, plain, hiddenTime, makeRunRecord, makeTrialRecord, makeResultRecord } from './records.js'
import { makeConfig, configHash, ENGINE_VERSION } from './config.js'
import { practiceTrials } from './trialPlan.js'

const STORE_METHODS = ['saveRun', 'saveTrial', 'saveResult', 'flush']

test('the store has exactly the interface Stage C implements, and every method returns a promise', async () => {
  const s = createMemoryStore()
  for (const m of STORE_METHODS) assert.equal(typeof s[m], 'function', m)
  const p = s.flush()
  assert.ok(p instanceof Promise)
  assert.deepStrictEqual(await p, { unsaved: 0 })
})

test('append-only: a second save of a run, a trial seq or a result is refused, never merged', async () => {
  const s = createMemoryStore()
  await s.saveRun({ id: 'r1', arm: 'touch' })
  await assert.rejects(s.saveRun({ id: 'r1', arm: 'vision' }), StoreConflictError)
  await s.saveTrial({ run_id: 'r1', seq: 1, response: 'same' })
  await assert.rejects(s.saveTrial({ run_id: 'r1', seq: 1, response: 'slowed' }), StoreConflictError)
  await s.saveResult({ run_id: 'r1', status: 'completed' })
  await assert.rejects(s.saveResult({ run_id: 'r1', status: 'completed' }), StoreConflictError)
  const snap = s.snapshot('r1')
  assert.equal(snap.run.arm, 'touch')
  assert.equal(snap.trials[0].response, 'same')
})

test('trials and results need their run first; bad keys are refused', async () => {
  const s = createMemoryStore()
  await assert.rejects(s.saveTrial({ run_id: 'nope', seq: 1 }), StoreConflictError)
  await assert.rejects(s.saveResult({ run_id: 'nope' }), StoreConflictError)
  await assert.rejects(s.saveRun({}), TypeError)
  await s.saveRun({ id: 'r' })
  await assert.rejects(s.saveTrial({ run_id: 'r', seq: 0 }), TypeError)
  await assert.rejects(s.saveTrial({ run_id: 'r', seq: 1.5 }), TypeError)
  await assert.rejects(s.saveTrial({ seq: 1 }), TypeError)
})

test('rows are copied on the way in and out', async () => {
  const s = createMemoryStore()
  const run = { id: 'r', nested: { a: 1 } }
  await s.saveRun(run)
  run.nested.a = 2
  const t = { run_id: 'r', seq: 2, keys: [1] }
  await s.saveTrial(t)
  t.keys.push(2)
  await s.saveTrial({ run_id: 'r', seq: 1 })
  const snap = s.snapshot('r')
  assert.equal(snap.run.nested.a, 1)
  assert.deepStrictEqual(snap.trials.map(x => x.seq), [1, 2], 'by seq')
  assert.deepStrictEqual(snap.trials[1].keys, [1])
  snap.trials[1].keys.push(9)
  assert.deepStrictEqual(s.snapshot('r').trials[1].keys, [1])
  assert.equal(s.snapshot('other'), null)
})

test('identity stays with the store, never in a row', async () => {
  const s = createMemoryStore({ userId: 'u-1', studyId: 's-1', scheduleId: 'p-1', isTest: true })
  assert.equal(s.context.userId, 'u-1')
  await s.saveRun({ id: 'r' })
  assert.equal(JSON.stringify(s.snapshot('r')).includes('u-1'), false)
})

test('newSeed: an integer in [0, 2^32) from getRandomValues, and nothing without it', () => {
  for (const v of [0, 1, 0xffffffff, 123456789]) {
    const fake = { getRandomValues: a => { a[0] = v; return a } }
    assert.equal(newSeed(fake), v)
  }
  for (let i = 0; i < 200; i++) { const s = newSeed(); assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32) }
  assert.throws(() => newSeed({}), /getRandomValues/)
  assert.throws(() => newSeed(null), /getRandomValues/)
})

test('newRunId: a v4 uuid, with or without randomUUID', () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  assert.match(newRunId(), re)
  assert.match(newRunId({ getRandomValues: a => { a.fill(255); return a } }), re)
})

test('plain() makes engine output JSON-safe', () => {
  assert.deepStrictEqual(plain({ a: new Float64Array([1, 2]), b: NaN, c: undefined, d: [Infinity, null, undefined], e: 'x' }),
    { a: [1, 2], b: null, d: [null, null, null], e: 'x' })
})

test('hiddenTime adds hidden spans on the trial clock, closing an open one at the end', () => {
  assert.equal(hiddenTime([{ type: 'hidden', t: 100 }, { type: 'visible', t: 400 }, { type: 'hidden', t: 900 }], 1000), 400)
  assert.equal(hiddenTime([], 1000), 0)
})

test('run, trial and result rows carry what Stage C stores', () => {
  const cfg = makeConfig({ demo: true })
  const run = makeRunRecord({ id: 'r', arm: 'breath', cfg, seed: 42, kind: 'demo', plannedTrials: 9, client: { screen_w: 1 } })
  assert.equal(run.engine_version, ENGINE_VERSION)
  assert.equal(run.config_hash, configHash(cfg.engine))
  assert.equal(run.seed, 42)
  assert.equal(run.arm, 'breath')
  assert.equal(run.config.engine.stopping.change_trials_per_cell, 3)
  assert.throws(() => makeRunRecord({ id: 'r', arm: 'breath', cfg, seed: undefined, kind: 'demo' }), /seed/)
  assert.throws(() => makeRunRecord({ id: 'r', arm: 'breath', cfg, seed: 2 ** 32, kind: 'demo' }), /seed/)

  const spec = practiceTrials(cfg)[0]
  const pres = { t_end: 9000, planned_boundaries_ms: [0, 1500], delivered_boundaries_ms: [0, 1499], boundary_error_ms: [0, -1], delivered_pulses_ms: [], n_frames: 10, dropped_frames: 0, max_frame_gap_ms: 17, frame_period_ms: 16.7, level_ready_ms: 0, level_wait_ms: 0 }
  const answer = { response: 'sped_up', key: 'ArrowRight', rtMs: 800, questionOnsetMs: 9000 }
  const base = { runId: 'r', seq: 1, spec, pres, answer, interrupted: true, focusEvents: [{ type: 'blur', t: 10 }], keys: { events: [], repeats: 0, blurs: 1, summary: null }, tStartMs: 5 }
  const main = makeTrialRecord({ ...base, phase: 'main', engineResponse: null, reply: { running: { a: new Float64Array([1]) }, scoring: {}, procedure_ms: 50 } })
  assert.equal(main.response, 'sped_up', 'the key pressed is kept')
  assert.equal(main.engine_response, null, 'what the engine got')
  assert.equal(main.sent_to_engine, true)
  assert.deepStrictEqual(main.posterior, { a: [1] })
  assert.equal(main.n_blur, 1)
  const practice = makeTrialRecord({ ...base, phase: 'practice', interrupted: false })
  assert.equal(practice.trial_type, 'practice')
  assert.equal(practice.sent_to_engine, false)
  assert.equal(practice.engine_response, null)
  assert.equal(practice.posterior, null)
  const plainMain = makeTrialRecord({ ...base, phase: 'main', interrupted: false, reply: null })
  assert.equal(plainMain.engine_response, 'sped_up', 'defaults to the answer when nothing was withheld')

  const res = makeResultRecord({ runId: 'r', trials: [practice, main, { ...main, phase: 'repeat', interrupted: false }], readout: { x: 1 } })
  assert.deepStrictEqual([res.n_rows, res.n_practice, res.n_main, res.n_repeats, res.n_interrupted, res.n_withheld], [3, 1, 1, 1, 1, 1])
})
