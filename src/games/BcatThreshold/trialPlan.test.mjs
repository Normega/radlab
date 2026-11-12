// Headless checks for the BCAT threshold trial plan.
// Run: node --test src/games/BcatThreshold/trialPlan.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { buildTrialPlan, practiceTrials } from './trialPlan.js'
import { makeConfig } from './config.js'
import { AdaptiveSession, makeRng, SimulatedObserver } from './engine/adaptive.js'

const REF = new URL('./engine/reference/', import.meta.url)
const readRef = f => JSON.parse(readFileSync(new URL(f, REF), 'utf8'))
const ORDER_KEYS = ['trial_index', 'cell', 'placement', 'is_change', 'cell_trial_index']
const order = trials => trials.map(t => Object.fromEntries(ORDER_KEYS.map(k => [k, t[k]])))
const close = (a, b) => Math.abs(a - b) < 1e-12

// The engine's own session, with the posterior work stubbed out so it runs in milliseconds. The scheduler and
// the bookkeeping that drives it (nextTrial, _refillQueue, _nextCell, _catchPending, recordResponse, _record,
// checkStop) run as they are; only the level choice, the likelihood updates and the summaries are replaced.
function stubbedLiveOrder(engineCfg, seed) {
  const s = new AdaptiveSession(engineCfg, makeRng(seed))
  const x = s.proc.stim_grid
  s.proc.nextMagnitude = () => ({ requested_magnitude: x[5], magnitude: x[5], grid_index: 5, clamped: false, reference_threshold: null, target_dprime: null })
  s.proc.engine.updateChange = () => {}
  s.proc.engine.updateNoChange = () => {}
  s.proc.summary = () => ({ threshold: { ln_sd: 1 } })
  const out = []
  for (let t = s.nextTrial(); t; t = s.nextTrial()) { out.push(t); s.recordResponse(t, out.length % 3 ? 'same' : 'slowed') }
  return out
}

test('against the Python reference sessions: with their queue orders injected, the plan is their trial order', () => {
  let n = 0
  for (const f of readdirSync(REF).filter(f => /^case_.*\.json$/.test(f)).sort()) {
    const ref = readRef(f)
    const cfg = { engine: ref.config, practice: { enabled: false } }
    if (ref.config.stopping.precision_rule.enabled) {
      assert.throws(() => buildTrialPlan(cfg, 1), /precision stopping rule/, `${f}: no fixed plan under the precision rule`)
      continue
    }
    let qi = 0
    const plan = buildTrialPlan(cfg, 1, { shuffle: () => ref.queues[qi++].slice() })
    assert.deepStrictEqual(order(plan.main), order(ref.trials), f)
    assert.equal(qi, ref.queues.length, `${f}: same number of blocks`)
    assert.deepStrictEqual(plan.queues, ref.queues, `${f}: same blocks`)
    for (const [p, r] of plan.main.map((p, i) => [p, ref.trials[i]])) {
      if (p.level_known) {
        assert.ok(close(p.magnitude, r.magnitude), `${f} trial ${p.trial_index}: magnitude`)
        assert.ok(p.pulse_durations_s.every((d, i) => close(d, r.pulse_durations_s[i])), `${f} trial ${p.trial_index}: pulses`)
      } else {
        assert.equal(p.magnitude, null)
      }
    }
    n += plan.main.length
  }
  assert.equal(n, 411 - 38, 'all sessions but the precision-rule one (E, 38 trials)')
})

test('same seed, same plan as the engine session it will run (stubbed posterior, many seeds and settings)', () => {
  const settings = [{ mode: 'online' }, { mode: 'lab' }, { mode: 'online', demo: true }, { mode: 'lab', catchTrials: true },
    { mode: 'online', catchTrials: false }, { mode: 'online', changeTrialsPerDirection: 7 }, { mode: 'online', changeTrialsPerDirection: 1 }]
  for (const o of settings) {
    const cfg = makeConfig(o)
    for (const seed of [0, 1, 2, 12345, 0xdeadbeef, 4294967295]) {
      const plan = buildTrialPlan(cfg, seed)
      assert.deepStrictEqual(order(plan.main), order(stubbedLiveOrder(cfg.engine, seed)), `${JSON.stringify(o)} seed ${seed}`)
    }
  }
})

test('same seed, same plan as a real engine session (no stubs, levels chosen by the posterior)', () => {
  const cfg = makeConfig({ mode: 'online', changeTrialsPerDirection: 10 })
  const seed = 2026
  const s = new AdaptiveSession(cfg.engine, makeRng(seed))
  const obs = new SimulatedObserver({ lapse_rate: 0.1 }), rng = makeRng(9)
  const live = []
  for (let t = s.nextTrial(); t; t = s.nextTrial()) { live.push(t); s.recordResponse(t, obs.respond(t, rng)) }
  const plan = buildTrialPlan(cfg, seed)
  assert.deepStrictEqual(order(plan.main), order(live))
  plan.main.forEach((p, i) => {
    if (p.level_known) assert.deepStrictEqual(p.pulse_durations_s, live[i].pulse_durations_s)
  })
})

test('online plan (seed 77): 84 trials — 30 + 30 change, 20 no change (25%), 4 catch after slowing trials 6, 12, 18, 24', () => {
  const plan = buildTrialPlan(makeConfig({ mode: 'online' }), 77)
  const c = plan.counts
  assert.equal(c.total, 84)
  assert.deepStrictEqual(c.change, { speeding: 30, slowing: 30 })
  assert.equal(c.no_change, 20)
  assert.equal(c.no_change / (c.total - c.catch), 0.25)
  assert.equal(c.catch, 4)
  // every third change trial from the sixth is reserved: 9 per direction, d' 0.5 first
  assert.deepStrictEqual([c.infogain, c.fixed_sub, c.fixed_supra, c.filler], [42, 10, 8, 0])
  for (const cell of ['speeding', 'slowing']) {
    const ch = plan.main.filter(t => t.cell === cell && t.placement !== 'catch')
    const reserved = ch.map((t, i) => [i + 1, t.placement]).filter(([, p]) => p !== 'infogain')
    assert.deepStrictEqual(reserved.map(r => r[0]), [6, 9, 12, 15, 18, 21, 24, 27, 30])
    assert.deepStrictEqual(reserved.map(r => r[1]).slice(0, 3), ['fixed_sub', 'fixed_supra', 'fixed_sub'])
  }
  // catch trials: slowing, 8-s changed pulses, each right after the 6th, 12th, ... slowing change trial
  let nSlowing = 0
  const after = []
  for (const t of plan.main) {
    if (t.placement === 'catch') {
      after.push(nSlowing)
      assert.equal(t.cell, 'slowing')
      assert.ok(close(t.magnitude, Math.log(2)))
      assert.ok([4, 4, 4, 8, 8].every((d, i) => close(t.pulse_durations_s[i], d)))
    } else if (t.cell === 'slowing') nSlowing++
  }
  assert.deepStrictEqual(after, [6, 12, 18, 24])
  // trial indices run 1..84 and no-change trials have all-baseline pulses
  assert.deepStrictEqual(plan.main.map(t => t.trial_index), Array.from({ length: 84 }, (_, i) => i + 1))
  for (const t of plan.main.filter(t => t.cell === 'no_change')) assert.deepStrictEqual(t.pulse_durations_s, [4, 4, 4, 4, 4])
})

test('lab plan: 40 + 40 change, 26-28 no change, no catch trials', () => {
  const c = buildTrialPlan(makeConfig({ mode: 'lab' }), 77).counts
  assert.deepStrictEqual(c.change, { speeding: 40, slowing: 40 })
  assert.ok(c.no_change >= 26 && c.no_change <= 28)
  assert.equal(c.total, 80 + c.no_change)
  assert.equal(c.catch, 0)
  assert.equal(c.infogain, 56)
})

// The no-change trials are topped up block by block; those still queued when both directions finish are
// never shown (as in the source build and the Python prototype). So the total varies a little with the seed:
// online 82-84, lab 106-108. The plan knows each seed's exact count before the session starts.
test('the number of no-change trials varies a little with the seed (online 82-84 trials, lab 106-108)', () => {
  const seen = { online: new Set(), lab: new Set() }
  for (const mode of ['online', 'lab']) {
    const cfg = makeConfig({ mode })
    const n = cfg.engine.stopping.change_trials_per_cell
    for (let seed = 0; seed < 200; seed++) {
      const c = buildTrialPlan(cfg, seed).counts
      assert.deepStrictEqual(c.change, { speeding: n, slowing: n })
      const target = 0.25 / 0.75 * 2 * n
      assert.ok(c.no_change >= Math.floor(target) - 2 && c.no_change <= Math.ceil(target) + 1, `${mode} seed ${seed}: ${c.no_change} no-change`)
      seen[mode].add(c.total)
    }
  }
  assert.deepStrictEqual([...seen.online].sort(), [82, 83, 84])
  assert.deepStrictEqual([...seen.lab].sort(), [106, 107, 108])
})

test('the catch trials switch off', () => {
  const c = buildTrialPlan(makeConfig({ mode: 'online', catchTrials: false }), 77).counts
  assert.equal(c.catch, 0)
  assert.equal(c.total, 80)
})

test('different seeds give different orders; the same seed always the same plan', () => {
  const cfg = makeConfig()
  const a = JSON.stringify(buildTrialPlan(cfg, 5))
  assert.equal(a, JSON.stringify(buildTrialPlan(cfg, 5)))
  assert.notEqual(JSON.stringify(buildTrialPlan(cfg, 5).main), JSON.stringify(buildTrialPlan(cfg, 6).main))
})

test('practice: three large changes in a fixed order (2-s pulses, 8-s pulses, no change), or none', () => {
  const p = practiceTrials(makeConfig())
  assert.deepStrictEqual(p.map(t => [t.cell, t.placement]), [['speeding', 'practice'], ['slowing', 'practice'], ['no_change', 'practice']])
  const want = [[4, 4, 4, 2, 2], [4, 4, 4, 8, 8], [4, 4, 4, 4, 4]]
  p.forEach((t, i) => assert.ok(t.pulse_durations_s.every((d, k) => close(d, want[i][k])), `practice ${i + 1}`))
  assert.deepStrictEqual(buildTrialPlan(makeConfig(), 1).practice, p)
  assert.deepStrictEqual(practiceTrials(makeConfig({ practice: false })), [])
})
