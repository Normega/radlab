// Whole simulated sessions through the run order, the engine (main-thread controller), the interruption
// rule and the in-memory store, and the replay Stage C will use to resume.
// Run: node --test src/games/BcatThreshold/session.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeConfig, ENGINE_VERSION } from './config.js'
import { createEngineClient } from './engineClient.js'
import { createSimulatedPresenter } from './simulate.js'
import { createTrialSequence } from './sequence.js'
import { createMemoryStore } from './store.js'
import { makeRunRecord, makeResultRecord } from './records.js'
import { runPractice, runEngineTrials, runRepeats } from './session.js'
import { buildTrialPlan } from './trialPlan.js'
import { replay, savedTrial } from './engine/replay.js'

async function simulatedRun({ arm, seed, interruptMain = [], prestart = true }) {
  const cfg = makeConfig({ demo: true })
  const engine = createEngineClient({ worker: false })
  const store = createMemoryStore()
  const sequence = createTrialSequence()
  const sim = createSimulatedPresenter({ cfg, arm, seed })
  let mainShown = 0
  const present = async req => {
    const out = await sim(req)
    if (req.phase === 'main' && !out.no_trial) {
      mainShown += 1
      if (interruptMain.includes(mainShown)) return { ...out, interrupted: true, focusEvents: [{ type: 'blur', t: 3000 }, { type: 'focus', t: 4000 }] }
    }
    return out
  }
  const runId = 'run-' + seed
  await store.saveRun(makeRunRecord({ id: runId, arm, cfg, seed, kind: 'simulated', plannedTrials: buildTrialPlan(cfg, seed).counts.total }))
  const saveTrial = row => store.saveTrial(row)
  let feedback = 0
  await runPractice({ cfg, present, sequence, saveTrial, runId, afterEach: async () => { feedback += 1 } })
  const main = await runEngineTrials({ engine, cfg, seed, present, sequence, saveTrial, runId, prestart })
  await runRepeats({ present, sequence, saveTrial, runId })
  const { readout } = await engine.call({ type: 'readout' })
  const snap0 = store.snapshot(runId)
  await store.saveResult(makeResultRecord({ runId, trials: snap0.trials, readout }))
  engine.terminate()
  return { cfg, snap: store.snapshot(runId), main, readout, feedback }
}

for (const arm of ['vision', 'touch', 'breath']) {
  test(`a simulated demo session runs from practice to readout (${arm})`, async () => {
    const seed = 1000 + arm.length
    const { cfg, snap, main, readout, feedback } = await simulatedRun({ arm, seed })
    const rows = snap.trials
    assert.equal(feedback, 3, 'a feedback page after each practice trial')
    assert.deepStrictEqual(rows.map(r => r.seq), rows.map((_, i) => i + 1), 'seq is 1..n with no gaps')
    assert.deepStrictEqual(rows.slice(0, 3).map(r => r.phase), ['practice', 'practice', 'practice'])
    const mains = rows.filter(r => r.phase === 'main')
    assert.equal(mains.length, main.n)
    assert.equal(mains.length, buildTrialPlan(cfg, seed).counts.total, 'every trial answered: the session is as long as planned')
    assert.equal(rows.filter(r => r.phase === 'repeat').length, 0)
    assert.deepStrictEqual(mains.map(r => r.trial_index), mains.map((_, i) => i + 1))
    for (const r of mains) {
      assert.ok(['slowed', 'same', 'sped_up'].includes(r.response))
      assert.equal(r.engine_response, r.response)
      assert.ok(r.posterior && typeof r.posterior.speeding_threshold === 'number', 'posterior summary after the update')
      if (arm === 'vision') assert.equal(r.key_events.length, 0)
      else {
        assert.ok(r.key_events.length >= 2 * 2 * r.planned_pulses_s.length - 2, `${r.key_events.length} key events`)
        assert.ok(r.key_summary.n_matched > 0)
      }
    }
    assert.equal(snap.result.n_main, mains.length)
    assert.equal(snap.result.readout.n_trials_total, mains.length)
    assert.equal(readout.n_missing_responses, 0)
    assert.equal(snap.run.engine_version, ENGINE_VERSION)

    // what Stage C will do on a reload: rebuild the posterior from the saved rows
    const saved = rows.filter(r => r.sent_to_engine).map(r => savedTrial(r, r.engine_response))
    const rep = replay(saved, cfg.engine, snap.run.seed, { expect: { engine_version: snap.run.engine_version, config_hash: snap.run.config_hash } })
    assert.equal(rep.finished, true)
    assert.deepStrictEqual(rep.session.readout().cells.speeding.threshold, readout.cells.speeding.threshold)
    assert.deepStrictEqual(rep.session.readout().cells.slowing.threshold, readout.cells.slowing.threshold)
  })
}

test('an interrupted trial is flagged, withheld from the engine, and shown once more at the end', async () => {
  const seed = 77
  const { snap, readout } = await simulatedRun({ arm: 'touch', seed, interruptMain: [2, 5] })
  const rows = snap.trials
  const mains = rows.filter(r => r.phase === 'main')
  const hit = [mains[1], mains[4]]
  for (const r of hit) {
    assert.equal(r.interrupted, true)
    assert.ok(r.response !== null, 'the participant still answered')
    assert.equal(r.engine_response, null, 'the engine was not given the answer')
    assert.equal(r.repeat_queued, true)
  }
  const repeats = rows.filter(r => r.phase === 'repeat')
  assert.deepStrictEqual(repeats.map(r => r.repeat_of), [hit[0].trial_index, hit[1].trial_index])
  assert.deepStrictEqual(repeats.map(r => r.magnitude), [hit[0].magnitude, hit[1].magnitude], 'the same stimulus')
  assert.deepStrictEqual(repeats.map(r => r.planned_pulses_s), [hit[0].planned_pulses_s, hit[1].planned_pulses_s])
  assert.ok(repeats.every(r => r.sent_to_engine === false && r.posterior === null))
  assert.ok(rows.indexOf(repeats[0]) > rows.indexOf(mains[mains.length - 1]), 'after the last engine trial')
  assert.equal(readout.n_missing_responses, 2, 'the engine counted them as unanswered')
  assert.equal(snap.result.n_withheld, 2)
  assert.equal(snap.result.n_interrupted, 2)

  const saved = rows.filter(r => r.sent_to_engine).map(r => savedTrial(r, r.engine_response))
  const rep = replay(saved, makeConfig({ demo: true }).engine, seed)
  assert.equal(rep.finished, true, 'replay with engine_response reproduces the whole run')
  // replaying the keys pressed instead would not: it is the wrong record
  const wrong = rows.filter(r => r.sent_to_engine).map(r => savedTrial(r, r.response))
  assert.throws(() => replay(wrong, makeConfig({ demo: true }).engine, seed))
})

test('waiting for each reply (no prestart) gives the same session', async () => {
  const a = await simulatedRun({ arm: 'vision', seed: 5, prestart: true })
  const b = await simulatedRun({ arm: 'vision', seed: 5, prestart: false })
  const strip = rows => rows.map(r => [r.trial_index, r.cell, r.placement, r.magnitude, r.response])
  assert.deepStrictEqual(strip(a.snap.trials), strip(b.snap.trials))
})
