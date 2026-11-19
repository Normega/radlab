// Whole simulated sessions through runSession: the practice gate, the break, the time limit and the moving
// average (Stage C), with the engine on its main-thread controller and the in-memory store.
// Run: node --test src/games/BcatThreshold/sessionRun.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeConfig } from './config.js'
import { createEngineClient } from './engineClient.js'
import { createSimulatedPresenter, SIM_SCENARIOS } from './simulate.js'
import { createTrialSequence } from './sequence.js'
import { createCompliance } from './compliance.js'
import { createMemoryStore } from './store.js'
import { makeRunRecord, makeResultRecord } from './records.js'
import { runSession } from './session.js'
import { buildTrialPlan } from './trialPlan.js'
import { breakAfterMain } from './sessionRules.js'

async function run({ arm = 'touch', seed = 11, scenario = null, presOpts = {}, cfgOpts = {}, breakPage = undefined, onRetry = null } = {}) {
  const cfg = makeConfig({ demo: true, ...cfgOpts })
  const engine = createEngineClient({ worker: false })
  const calls = []
  const realCall = engine.call
  engine.call = msg => { calls.push(msg.type); return realCall(msg) }
  const store = createMemoryStore()
  const sequence = createTrialSequence()
  const present = createSimulatedPresenter({ cfg, arm, seed, ...(scenario ? SIM_SCENARIOS[scenario] : {}), ...presOpts })
  let shift = 0
  const clock = () => present.now() + shift
  const shiftClock = ms => { shift += ms }
  const runId = `run-${arm}-${seed}`
  const plannedTrials = buildTrialPlan(cfg, seed).counts.total
  await store.saveRun(makeRunRecord({ id: runId, arm, cfg, seed, kind: 'simulated', plannedTrials }))
  const rows = []
  const saveTrial = r => { rows.push(r); return store.saveTrial(r) }
  const retries = [], breaks = []
  const pages = {
    practiceRetry: async v => { retries.push(v); if (onRetry) onRetry(v) },
    breakPage: breakPage === undefined ? async () => { breaks.push(clock()) } : breakPage && (async () => { breaks.push(clock()); await breakPage(shiftClock) }),
  }
  const compliance = createCompliance({ cfg, arm })
  const outcome = await runSession({ cfg, arm, seed, engine, present, sequence, saveTrial, runId, compliance, pages, plannedTrials, clock })
  const readout = outcome.status === 'completed' ? (await engine.call({ type: 'readout' })).readout
    : outcome.engineStarted ? (await engine.call({ type: 'abort' })).readout : null
  await store.saveResult(makeResultRecord({ runId, trials: rows, readout, status: outcome.status, session: outcome }))
  engine.terminate()
  return { cfg, outcome, rows, calls, retries, breaks, plannedTrials, snap: store.snapshot(runId), present, clock }
}

test('touch: the simulated observer passes the practice gate in the first set by default', async () => {
  const { rows, outcome, snap, retries } = await run({ arm: 'touch' })
  const pr = rows.filter(r => r.phase === 'practice')
  assert.equal(pr.length, 3)
  assert.deepStrictEqual(pr.map(r => r.practice_set), [1, 1, 1])
  assert.deepStrictEqual(pr.map(r => r.practice_gate && r.practice_gate.verdict), [null, null, 'passed'], 'the verdict is on the set\'s last row')
  assert.deepStrictEqual(pr.map(r => r.practice_completed), [null, null, true])
  assert.equal(retries.length, 0)
  assert.equal(outcome.status, 'completed')
  assert.deepStrictEqual([snap.result.practice_completed, snap.result.practice_passed, snap.result.practice_sets], [true, true, 1])
  assert.ok(snap.result.practice_gate.sets[0].mean >= 0.5)
})

test('touch: the gate missed once, the key instruction page, a second set, then passed', async () => {
  const { rows, outcome, snap, retries } = await run({ arm: 'touch', scenario: 'fail_practice_once' })
  const pr = rows.filter(r => r.phase === 'practice')
  assert.deepStrictEqual(pr.map(r => r.practice_set), [1, 1, 1, 2, 2, 2])
  assert.deepStrictEqual(pr.map(r => r.trial_index), [1, 2, 3, 1, 2, 3], 'each set is the same three trials')
  assert.equal(retries.length, 1)
  assert.equal(retries[0].verdict, 'retry')
  assert.ok(retries[0].mean < 0.5)
  assert.equal(pr[5].practice_gate.verdict, 'passed')
  assert.equal(outcome.status, 'completed')
  assert.deepStrictEqual([snap.result.practice_passed, snap.result.practice_sets], [true, 2])
  assert.ok(rows.some(r => r.phase === 'main'))
  assert.ok(rows.every(r => r.phase !== 'practice' || r.sent_to_engine === false), 'practice never reaches the engine')
})

test('breath: three sets missed: the session ends practice_failed, the engine never starts', async () => {
  const { rows, outcome, snap, retries, calls } = await run({ arm: 'breath', scenario: 'fail_practice' })
  assert.equal(rows.length, 9)
  assert.ok(rows.every(r => r.phase === 'practice'))
  assert.equal(retries.length, 2, 'a page before the second and third sets, none after the last')
  assert.equal(rows[8].practice_gate.verdict, 'failed')
  assert.equal(rows[8].practice_completed, false)
  assert.equal(outcome.status, 'practice_failed')
  assert.equal(outcome.engineStarted, false)
  assert.ok(!calls.includes('init'), 'no engine session was made')
  assert.deepStrictEqual([snap.result.status, snap.result.practice_completed, snap.result.practice_passed, snap.result.practice_sets, snap.result.readout],
    ['practice_failed', false, false, 3, null])
  assert.equal(snap.result.timed_out, false)
})

test('vision: no gate; practice is completed when its three trials are done, even off task', async () => {
  const { rows, snap, retries } = await run({ arm: 'vision', scenario: 'fail_practice' })
  const pr = rows.filter(r => r.phase === 'practice')
  assert.equal(pr.length, 3)
  assert.equal(retries.length, 0)
  assert.equal(pr[2].practice_gate.verdict, 'not_gated')
  assert.deepStrictEqual([snap.result.status, snap.result.practice_completed, snap.result.practice_passed], ['completed', true, null])
})

test('the break: once, after half the planned main trials; recorded on the next main row and on the result', async () => {
  const { rows, breaks, plannedTrials, snap } = await run({ arm: 'touch', seed: 21 })
  const at = breakAfterMain(plannedTrials)
  assert.equal(breaks.length, 1)
  const mains = rows.filter(r => r.phase === 'main')
  const withBreak = mains.filter(r => r.break_before)
  assert.equal(withBreak.length, 1)
  assert.equal(withBreak[0].trial_index, at + 1, 'the first main trial after the break')
  assert.equal(withBreak[0].break_before.after_main, at)
  assert.equal(withBreak[0].break_before.after_seq, withBreak[0].seq - 1, 'the seq of the trial before it')
  assert.equal(withBreak[0].break_before.shown, true)
  assert.deepStrictEqual([snap.result.break_taken, snap.result.break_after_main], [true, at])
  assert.equal(typeof snap.result.break_duration_ms, 'number')
})

test('the break: switched off, none; with no page (a simulated preview), recorded as not shown', async () => {
  const off = await run({ arm: 'vision', cfgOpts: { breakAtHalf: false } })
  assert.equal(off.breaks.length, 0)
  assert.equal(off.snap.result.break_taken, false)
  const silent = await run({ arm: 'vision', breakPage: null })
  const row = silent.rows.find(r => r.break_before)
  assert.equal(row.break_before.shown, false)
  assert.equal(silent.snap.result.break_taken, true)
})

test('the time limit: no trial starts once it is past; the run ends timed_out with the abort readout', async () => {
  const limit = 8 * 60 * 1000   // a minute of dawdling per trial: past 8 minutes within the demo's trials
  const { rows, outcome, snap, present } = await run({ arm: 'touch', scenario: 'timeout', cfgOpts: { maxTotalMs: limit } })
  assert.equal(outcome.status, 'timed_out')
  assert.ok(rows.length > 0)
  for (const r of rows) assert.ok(r.timing.t_start_ms < limit, `seq ${r.seq} started at ${r.timing.t_start_ms} ms, before the limit`)
  assert.ok(present.now() >= limit, 'the last trial finished past the limit')
  assert.equal(snap.result.timed_out, true)
  assert.equal(snap.result.status, 'timed_out')
  assert.ok(snap.result.elapsed_ms >= limit)
  assert.equal(snap.result.time_limit_ms, limit)
  assert.equal(snap.result.readout.aborted, true, 'the readout of what existed, flagged by the engine as aborted')
  // the engine's own count includes the trial it had already chosen for the prestart, which never started
  const nMain = rows.filter(r => r.phase === 'main').length
  assert.ok([nMain, nMain + 1].includes(snap.result.readout.n_trials_total), `${snap.result.readout.n_trials_total} vs ${nMain}`)
  assert.equal(snap.result.readout.n_missing_responses, 0, 'the unshown trial is not counted as unanswered')
})

test('the time limit counts the break: a long break ends the run before the next trial', async () => {
  const limit = 30 * 60 * 1000
  const { rows, outcome, snap } = await run({ arm: 'vision', seed: 5, cfgOpts: { maxTotalMs: limit }, breakPage: async shiftClock => shiftClock(limit) })
  assert.equal(outcome.status, 'timed_out')
  assert.equal(rows.filter(r => r.break_before).length, 0, 'no trial started after the break')
  assert.equal(snap.result.break_taken, true)
  assert.ok(snap.result.break_duration_ms >= limit, 'the break duration is on the result')
  assert.equal(snap.result.readout.aborted, true)
})

test('the moving average: on every main row; a run of off-task trials sets the exclusion flag, and the run goes on', async () => {
  const good = await run({ arm: 'touch', seed: 8 })
  const mains = good.rows.filter(r => r.phase === 'main')
  assert.ok(mains.every(r => typeof r.coverage_moving_avg === 'number' && r.ws_press_moving_share === null))
  assert.deepStrictEqual(mains.slice(0, 3).map(r => r.moving_window_n), [1, 2, 3])
  assert.equal(good.snap.result.moving_window, 3)
  assert.equal(good.snap.result.exclusion_flag_coverage, false, 'the simulated observer tracks well')

  const bad = await run({ arm: 'touch', seed: 8, presOpts: { offTask: (n, phase) => phase === 'main' && n >= 6 && n <= 8 } })
  assert.equal(bad.outcome.status, 'completed', 'a flag only: the session is not stopped')
  assert.equal(bad.snap.result.exclusion_flag_coverage, true)
  assert.ok(bad.snap.result.coverage_moving_avg_min < 0.5)
  assert.equal(bad.rows.filter(r => r.phase === 'main').length, mains.length, 'the same session length')

  const vis = await run({ arm: 'vision', seed: 8, presOpts: { offTask: (n, phase) => phase === 'main' && n === 5 } })
  const vm = vis.rows.filter(r => r.phase === 'main')
  assert.ok(vm.every(r => r.coverage_moving_avg === null && typeof r.ws_press_moving_share === 'number'))
  assert.ok(vis.snap.result.ws_press_moving_share_max > 0)
  assert.equal(vis.snap.result.exclusion_flag_coverage, null, 'vision: no threshold')
})

test('full screen lost before a trial could start: the return page, then the same trial; recorded as a return page', async () => {
  const cfg = makeConfig({ demo: true })
  const engine = createEngineClient({ worker: false })
  const sim = createSimulatedPresenter({ cfg, arm: 'touch', seed: 3 })
  let lost = 0, gates = 0
  const present = async req => {
    if (req.phase === 'practice' && req.spec.trial_index === 2 && lost === 0) { lost += 1; return { fullscreen_lost: true } }
    return sim(req)
  }
  const gate = async () => { gates += 1; return lost === 1 && gates === 3 }   // shown on the second try of practice trial 2
  const rows = []
  const out = await runSession({ cfg, arm: 'touch', seed: 3, engine, present, sequence: createTrialSequence(), runId: 'r',
    saveTrial: async r => { rows.push(r) }, gate, compliance: createCompliance({ cfg, arm: 'touch' }), plannedTrials: buildTrialPlan(cfg, 3).counts.total, clock: sim.now })
  engine.terminate()
  assert.equal(out.status, 'completed')
  const pr = rows.filter(r => r.phase === 'practice')
  assert.deepStrictEqual(pr.map(r => r.trial_index), [1, 2, 3], 'the trial was shown once, after the return page')
  assert.deepStrictEqual(pr.map(r => r.fullscreen_return_shown), [false, true, false])
})

test('touch with no compliance scoring: nothing is assessed, so the gate cannot pass (fails closed)', async () => {
  const cfg = makeConfig({ demo: true })
  const engine = createEngineClient({ worker: false })
  const sim = createSimulatedPresenter({ cfg, arm: 'touch', seed: 3 })
  const out = await runSession({ cfg, arm: 'touch', seed: 3, engine, present: sim, sequence: createTrialSequence(), runId: 'r',
    saveTrial: async () => {}, plannedTrials: buildTrialPlan(cfg, 3).counts.total, clock: sim.now })
  engine.terminate()
  assert.equal(out.status, 'practice_failed')
  assert.deepStrictEqual(out.practice.sets.map(x => x.n), [0, 0, 0])
})

test('the practice retry page stands in for the compliance page: the same sentences are not shown twice in a row', async () => {
  const cfg = makeConfig({ demo: true })
  const engine = createEngineClient({ worker: false })
  const present = createSimulatedPresenter({ cfg, arm: 'touch', seed: 4, ...SIM_SCENARIOS.fail_practice_once })
  const shown = []
  const compliance = createCompliance({ cfg, arm: 'touch', showPage: async () => { shown.push('compliance') } })
  const rows = []
  const out = await runSession({ cfg, arm: 'touch', seed: 4, engine, present, sequence: createTrialSequence(), runId: 'r', compliance,
    saveTrial: async r => { rows.push(r) }, pages: { practiceRetry: async () => { shown.push('retry') } },
    plannedTrials: buildTrialPlan(cfg, 4).counts.total, clock: present.now })
  engine.terminate()
  assert.equal(out.status, 'completed')
  assert.deepStrictEqual(shown.slice(0, 2), ['retry'], 'three off-task trials in a row, but no compliance page right after the retry page')
  const set2 = rows.filter(r => r.phase === 'practice' && r.practice_set === 2)
  assert.equal(set2[0].reminder_page_shown, false)
  assert.equal(set2[0].reminder_shown, true, 'the fixation line still comes')
})
