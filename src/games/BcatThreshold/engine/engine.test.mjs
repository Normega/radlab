// Engine equivalence: the ported engine (engine.js, adaptive.js) against the Python prototype, and replay.
// Run: node --test src/games/BcatThreshold/engine/engine.test.mjs
//
// The reference sessions in ./reference/ were made by 6_online_pilot/tests/reference/make_reference.py from
// SHA-256-checked copies of the Python prototype (see reference/provenance.json and make_fixtures.mjs). This is
// the source build's tests/test_engine_equivalence.js, unchanged in what it checks: for every case and every
// trial, the scheduler queue (Python's order injected), trial type, placement, chosen stimulus level (exact grid
// index), mutual-information vector, scoring, every running column (posterior summaries, flags), and at the end
// the full readout, at tolerance 1e-9 (absolute, or relative when |value| > 1). Quantiles over tied grid values
// are checked against Python rerun with a stable sort (numpy's default sort is not stable).
//
// The one change from the source test: case A's three full likelihood rows (20 MB) are kept as every 211th value
// plus the row sum and sum of absolute values (make_fixtures.mjs).
//
// Then: replay determinism, the thing resume-by-replay (PLAN.md section 4) relies on.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import * as E from './engine.js'
import * as A from './adaptive.js'
import { replay, savedTrial, ReplayMismatchError } from './replay.js'
import { makeConfig, ENGINE_VERSION, configHash } from '../config.js'

const REF = new URL('./reference/', import.meta.url)
const readRef = f => JSON.parse(readFileSync(new URL(f, REF), 'utf8'))
const TOL = 1e-9
const TIE_KEYS = /(criterion|lapse_rate|miss_rate|threshold_secondary)\.(median|ci_low|ci_high|ln_median|ln_ci_low|ln_ci_high|x_ci_low|x_ci_high)$/

function diff(a, b) { return Math.abs(a - b) / Math.max(1, Math.abs(b)) }

// Collects every failure (as the source test does) so one run shows them all; the test asserts there are none.
function makeComparer() {
  const st = { failures: [], maxDiff: 0, maxDiffWhere: '', maxTieDiff: 0, maxTieStable: 0, maxMiDiff: 0, n: 0 }
  const fail = msg => { st.failures.push(msg) }
  function compare(js, py, where) {
    if (py === null || py === undefined) {
      if (!(js === null || js === undefined || (typeof js === 'number' && Number.isNaN(js)))) fail(`${where}: js ${js} vs py null`)
      return
    }
    if (typeof py === 'number') {
      if (typeof js === 'boolean') js = js ? 1 : 0
      if (typeof js !== 'number') { fail(`${where}: js ${js} vs py ${py}`); return }
      const d = diff(js, py); st.n++
      if (TIE_KEYS.test(where)) { if (d > st.maxTieDiff) st.maxTieDiff = d; return }
      if (d > st.maxDiff) { st.maxDiff = d; st.maxDiffWhere = where }
      if (d > TOL) fail(`${where}: js ${js} vs py ${py} (diff ${d.toExponential(2)})`)
      return
    }
    if (typeof py === 'boolean') { if (Boolean(js) !== py) fail(`${where}: js ${js} vs py ${py}`); return }
    if (typeof py === 'string') { if (js !== py) fail(`${where}: js ${JSON.stringify(js)} vs py ${JSON.stringify(py)}`); return }
    if (Array.isArray(py)) {
      if (!js || js.length !== py.length) { fail(`${where}: length js ${js && js.length} vs py ${py.length}`); return }
      py.forEach((v, i) => compare(js[i], v, `${where}[${i}]`)); return
    }
    for (const k of Object.keys(py)) compare(js ? js[k] : undefined, py[k], `${where}.${k}`)
  }
  function compareTiesStable(js, py, where) {
    if (py && typeof py === 'object') { for (const k of Object.keys(py)) compareTiesStable(js ? js[k] : undefined, py[k], where + '.' + k); return }
    if (typeof py === 'number' && TIE_KEYS.test(where)) {
      const d = diff(js, py); st.maxTieStable = Math.max(st.maxTieStable, d); st.n++
      if (d > TOL) fail(`${where} (stable sort): js ${js} vs py ${py}`)
    }
  }
  return { st, fail, compare, compareTiesStable }
}

const fmtFailures = f => `${f.length} failure(s):\n  ` + f.slice(0, 40).join('\n  ')

test('ndtr matches scipy, and the lapse prior weights match Python', () => {
  const { st, compare } = makeComparer()
  const nd = readRef('ndtr.json')
  let maxRel = 0
  nd.x.forEach((x, i) => {
    const a = E.ndtr(x), b = nd.ndtr[i]
    if (b > 0) maxRel = Math.max(maxRel, Math.abs(a - b) / b)
  })
  assert.ok(maxRel <= 1e-13, `ndtr relative error ${maxRel}`)
  const lw = E.lamWeights([0.0, 0.03, 0.06, 0.10, 0.15, 0.25, 0.40, 0.60, 0.80], ['logitnormal', 0.049, 2.3])
  compare(Array.from(lw), nd.lam_weights_aya, 'lam_weights')
  assert.equal(st.failures.length, 0, fmtFailures(st.failures))
  console.log(`  ndtr vs scipy over ${nd.x.length} points: max rel ${maxRel.toExponential(2)}`)
})

const CASES = readdirSync(REF).filter(f => /^case_.*\.json$/.test(f)).sort()
const STABLE = readRef('readouts_stable_sort.json')
const totals = { trials: 0, levels: 0, numbers: 0, maxDiff: 0, maxDiffWhere: '', maxMi: 0, maxTieStable: 0, maxTieUnstable: 0, timing: [] }

test('there are seven reference sessions', () => {
  assert.equal(CASES.length, 7, CASES.join(', '))
})

for (const f of CASES) {
  test(`reference session ${f}: every trial, level choice, summary and the readout match Python`, () => {
    const ref = readRef(f)
    const { st, fail, compare, compareTiesStable } = makeComparer()
    let qi = 0
    const shuffle = items => {
      const py = ref.queues[qi++]
      if (!py) { fail(`${ref.name}: JS asked for queue ${qi} but Python made only ${ref.queues.length}`); return items }
      const cnt = a => a.slice().sort().join(',')
      if (cnt(items) !== cnt(py)) fail(`${ref.name}: queue ${qi} items differ: js [${cnt(items)}] py [${cnt(py)}]`)
      return py.slice()
    }
    const sess = new A.AdaptiveSession(ref.config, A.makeRng(1), { shuffle })
    const sp = sess.proc.specs
    compare(Array.from(sp[0].x), ref.spec.x, `${ref.name}.grid_x`)
    compare(Array.from(sp[0].a), ref.spec.a, `${ref.name}.grid_alpha`)
    compare(Array.from(sp[0].c_v), ref.spec.c_v, `${ref.name}.grid_c`)
    if (ref.spec.lp_own_slowing) {
      compare(Array.from(sp[0].lp_shared), ref.spec.lp_shared, `${ref.name}.lp_shared`)
      compare(Array.from(sp[0].lp_own), ref.spec.lp_own_speeding, `${ref.name}.lp_own_speeding`)
      compare(Array.from(sp[1].lp_own), ref.spec.lp_own_slowing, `${ref.name}.lp_own_slowing`)
      compare([Array.from(sp[0].lognc0), Array.from(sp[0].lognc1)], ref.spec.lognc, `${ref.name}.lognc`)
      const rows = ref.spec.logL_slowing_rows_sampled
      assert.ok(rows && Object.keys(rows).length === 3, 'case A carries three sampled likelihood rows')
      for (const [key, row] of Object.entries(rows)) {
        const [o, s] = key.split('_').map(Number)
        const js = sp[1].logLikRow(s, o, new Float64Array(sp[1].AM * sp[1].J))
        if (js.length !== row.n) { fail(`${ref.name}.logL_slowing[${key}] length js ${js.length} vs py ${row.n}`); continue }
        let m = 0
        row.values.forEach((v, k) => { m = Math.max(m, diff(js[k * row.stride], v)) })
        let sum = 0, sumAbs = 0
        for (let i = 0; i < js.length; i++) { sum += js[i]; sumAbs += Math.abs(js[i]) }
        m = Math.max(m, diff(sum, row.sum), diff(sumAbs, row.sum_abs))
        if (m > TOL) fail(`${ref.name}.logL_slowing[${key}] max diff ${m}`)
        st.maxDiff = Math.max(st.maxDiff, m); st.n += row.values.length + 2
      }
    }
    compare(sess.runningColumns(), ref.prior.running, `${ref.name}.prior.running`)
    compare({ speeding: sess.proc.summary('speeding'), slowing: sess.proc.summary('slowing') }, ref.prior.summary, `${ref.name}.prior.summary`)

    let nLevels = 0
    for (const rt of ref.trials) {
      const t0 = performance.now()
      const t = sess.nextTrial()
      if (!t) { fail(`${ref.name}: JS session ended before trial ${rt.trial_index}`); break }
      const w = `${ref.name}.trial${rt.trial_index}`
      for (const k of ['trial_index', 'cell', 'placement', 'is_change', 'cell_trial_index', 'requested_magnitude', 'magnitude',
        'log_ratio', 'clamped', 'reference_threshold', 'target_dprime', 'changed_pulse_s', 'pulse_durations_s']) compare(t[k], rt[k], `${w}.${k}`)
      if (rt.mi) {
        nLevels++
        const mi = sess.proc._lastMI
        let m = 0
        rt.mi.forEach((v, i) => { m = Math.max(m, Math.abs(mi[i] - v)) })
        st.maxMiDiff = Math.max(st.maxMiDiff, m)
        if (m > TOL) fail(`${w}.mi max abs diff ${m}`)
        const gi = Array.from(sess.proc.stim_grid).findIndex(v => Math.abs(v - t.magnitude) < 1e-12)
        if (gi !== rt.grid_index) fail(`${w}: chosen grid index js ${gi} vs py ${rt.grid_index}`)
      }
      const scoring = sess.recordResponse(t, rt.response)
      const running = sess.runningColumns()
      totals.timing.push(performance.now() - t0)
      compare(scoring, rt.scoring, `${w}.scoring`)
      compare(running, rt.running, `${w}.running`)
    }
    if (sess.nextTrial() !== null) fail(`${ref.name}: JS session continues after Python's last trial`)
    if (qi !== ref.queues.length) fail(`${ref.name}: JS used ${qi} queues, Python ${ref.queues.length}`)
    const readout = sess.readout()
    compare(readout, ref.readout, `${ref.name}.readout`)
    assert.ok(STABLE[ref.name], `stable-sort readout for ${ref.name}`)
    compareTiesStable(readout, STABLE[ref.name], `${ref.name}.readout`)

    totals.trials += ref.trials.length; totals.levels += nLevels; totals.numbers += st.n
    if (st.maxDiff > totals.maxDiff) { totals.maxDiff = st.maxDiff; totals.maxDiffWhere = st.maxDiffWhere }
    totals.maxMi = Math.max(totals.maxMi, st.maxMiDiff)
    totals.maxTieStable = Math.max(totals.maxTieStable, st.maxTieStable)
    totals.maxTieUnstable = Math.max(totals.maxTieUnstable, st.maxTieDiff)
    console.log(`  ${ref.name}: ${ref.trials.length} trials, ${nLevels} QUEST+ level choices, ${ref.queues.length} queues, ` +
      `max diff ${st.maxDiff.toExponential(2)}`)
    assert.equal(st.failures.length, 0, fmtFailures(st.failures))
  })
}

test('equivalence totals (printed for the record)', () => {
  const tm = [...totals.timing].sort((a, b) => a - b)
  const mean = tm.reduce((a, b) => a + b, 0) / Math.max(1, tm.length)
  console.log(`  ${totals.trials} trials, ${totals.levels} QUEST+ level choices, ${totals.numbers} numbers compared`)
  console.log(`  max difference ${totals.maxDiff.toExponential(2)} at ${totals.maxDiffWhere}; mutual information ${totals.maxMi.toExponential(2)}`)
  console.log(`  tied-grid quantiles: vs Python stable sort ${totals.maxTieStable.toExponential(2)} (pass/fail); vs numpy default sort ${totals.maxTieUnstable.toExponential(2)} (not pass/fail)`)
  console.log(`  per-trial engine time (update + next level + summaries): mean ${mean.toFixed(1)} ms, median ${tm[tm.length >> 1]?.toFixed(1)} ms, max ${tm[tm.length - 1]?.toFixed(1)} ms`)
  if (totals.trials) {
    assert.equal(totals.trials, 411)
    assert.equal(totals.levels, 219)
  }
})

// ── replay determinism ────────────────────────────────────────────────────
// A live run through the worker's controller, with a simulated observer answering. Then, at several cut
// points, the saved trials up to there are replayed from scratch: the posterior summary after the replay and
// the next trial it offers must equal the live run's, exactly (not to a tolerance).

function liveRun(cfg, seed, observer, obsSeed) {
  // structuredClone stands in for postMessage: the controller's replies share arrays with the live session
  // (history() returns them), and only the worker boundary turns them into snapshots.
  const ctl = A.makeController()
  const handle = msg => structuredClone(ctl(msg))
  const rng = A.makeRng(obsSeed)
  const init = handle({ type: 'init', cfg, seed })
  const steps = []   // after each answer: saved trial, running columns, next trial, history
  let trial = init.trial
  while (trial) {
    const response = observer.respond(trial, rng)
    const r = handle({ type: 'respond', trial_index: trial.trial_index, response })
    steps.push({ saved: savedTrial(trial, response), running: r.running, next: r.next_trial, history: r.history, finished: r.finished })
    trial = r.next_trial
  }
  return { init, steps, readout: handle({ type: 'readout' }).readout }
}

const OBSERVER = new A.SimulatedObserver({ alpha_speeding: 0.17, alpha_slowing: 0.12, beta_speeding: 1.4, beta_slowing: 0.7,
  criterion: 1.25, lapse_rate: 0.04, miss_slowing: 0.1 })

test('replay: the saved trials of a live run rebuild its posterior and its next trial exactly', () => {
  const cfg = makeConfig({ mode: 'online', demo: true, changeTrialsPerDirection: 8 }).engine
  const seed = 4242
  const live = liveRun(cfg, seed, OBSERVER, 7)
  const n = live.steps.length
  assert.ok(n > 20, `${n} trials`)
  const saved = live.steps.map(s => s.saved)
  // a fresh session offers the same first trial as the live init
  assert.deepStrictEqual(replay([], cfg, seed).next, live.init.trial)
  for (const k of [1, 6, n - 1, n]) {
    const t0 = performance.now()
    const r = replay(saved.slice(0, k), cfg, seed)
    const ms = performance.now() - t0
    assert.deepStrictEqual(r.running, live.steps[k - 1].running, `running columns after ${k} trials`)
    assert.deepStrictEqual(r.next, live.steps[k - 1].next, `next trial after ${k} trials`)
    assert.deepStrictEqual(r.history, live.steps[k - 1].history, `update history after ${k} trials`)
    assert.equal(r.finished, live.steps[k - 1].finished)
    if (k === n) {
      assert.equal(r.next, null)
      assert.deepStrictEqual(r.session.readout(), live.readout, 'readout after the full replay')
      console.log(`  replay of all ${n} trials: ${ms.toFixed(0)} ms (${(ms / n).toFixed(1)} ms per trial)`)
    }
  }
})

test('replay: an interrupted trial comes back as the same trial at the same level', () => {
  const cfg = makeConfig({ mode: 'online', demo: true }).engine
  const live = liveRun(cfg, 99, OBSERVER, 3)
  const k = 4
  const saved = live.steps.slice(0, k).map(s => s.saved)
  // trial k + 1 was shown but never answered: resuming offers it again
  const r = replay(saved, cfg, 99)
  assert.deepStrictEqual(r.next, live.steps[k - 1].next)
  assert.equal(r.next.trial_index, k + 1)
})

// Trial matching is a consistency check, not a seed check (replay.js header): with few saved trials a wrong seed
// is often accepted. Both cases below are fixed examples, not a search for a seed that happens to fail; the run
// row's stored seed, engine version and config hash are the guard (next test).
test('replay: trial matching refuses an edited level or answer, but is no proof of the seed', () => {
  const cfg = makeConfig({ mode: 'online', demo: true }).engine
  const live = liveRun(cfg, 5, OBSERVER, 11)
  const saved = live.steps.map(s => s.saved)
  assert.equal(saved.length, 9)
  // seed 8's first trial is also a no-change trial, so one saved trial of the seed-5 run replays under seed 8
  const wrong = replay(saved.slice(0, 1), cfg, 8)
  assert.equal(wrong.n_replayed, 1, 'a wrong seed accepted: matching one trial says nothing about the seed')
  // with the whole list the same wrong seed, and another, are refused
  assert.throws(() => replay(saved, cfg, 8), ReplayMismatchError)
  assert.throws(() => replay(saved, cfg, 6), ReplayMismatchError)
  const iAdaptive = saved.findIndex(t => t.placement === 'infogain')
  assert.ok(iAdaptive >= 0)
  const edited = saved.map((t, i) => (i === iAdaptive ? { ...t, magnitude: t.magnitude * 1.01 } : t))
  assert.throws(() => replay(edited, cfg, 5), ReplayMismatchError)
  assert.throws(() => replay([...saved, saved[0]], cfg, 5), ReplayMismatchError, 'a trial after the session ended')
  const badAnswer = saved.map((t, i) => (i === 0 ? { ...t, response: 'faster' } : t))
  assert.throws(() => replay(badAnswer, cfg, 5), ReplayMismatchError)
})

test('replay: unanswered (null) trials replay too', () => {
  const cfg = makeConfig({ mode: 'online', demo: true }).engine
  const handle = A.makeController()
  let t = handle({ type: 'init', cfg, seed: 17 }).trial
  const saved = []
  let last = null
  for (let i = 0; i < 6 && t; i++) {
    const response = i === 2 ? null : (i % 2 ? 'same' : 'slowed')
    last = handle({ type: 'respond', trial_index: t.trial_index, response })
    saved.push(savedTrial(t, response))
    t = last.next_trial
  }
  const r = replay(saved, cfg, 17)
  assert.deepStrictEqual(r.running, last.running)
  assert.deepStrictEqual(r.next, last.next_trial)
})

test('replay: the stored engine version and config hash are checked before anything is replayed', () => {
  const cfg = makeConfig({ mode: 'online', demo: true }).engine
  const live = liveRun(cfg, 5, OBSERVER, 11)
  const saved = live.steps.map(s => s.saved)
  const expect = { engine_version: ENGINE_VERSION, config_hash: configHash(cfg) }
  assert.match(expect.config_hash, /^fnv1a64:[0-9a-f]{16}$/)
  assert.deepStrictEqual(replay(saved, cfg, 5, { expect }).history, replay(saved, cfg, 5).history, 'a matching header changes nothing')
  const refused = (opts, field) => assert.throws(() => replay(saved, cfg, 5, opts),
    e => e instanceof ReplayMismatchError && e.details.field === field)
  refused({ expect: { ...expect, engine_version: 'sdt-0.3.0-js1+radlab.0' } }, 'engine_version')
  refused({ expect: { ...expect, config_hash: configHash({ ...cfg, design: { ...cfg.design, no_change_rate: 0.2 } }) } }, 'config_hash')
  // the header is checked first: even an empty list (where trial matching has nothing to compare) is refused
  assert.throws(() => replay([], cfg, 5, { expect: { ...expect, config_hash: 'fnv1a64:0000000000000000' } }), ReplayMismatchError)
  // half a header is a caller error, not a pass
  assert.throws(() => replay(saved, cfg, 5, { expect: { engine_version: ENGINE_VERSION } }), TypeError)
  assert.throws(() => replay(saved, cfg, 5, { expect: null }), TypeError)
})

test('configHash: key order does not matter, any value does; deterministic', () => {
  const cfg = makeConfig().engine
  const deepReorder = o => (o && typeof o === 'object' && !Array.isArray(o)
    ? Object.fromEntries(Object.keys(o).reverse().map(k => [k, deepReorder(o[k])])) : o)
  assert.equal(configHash(deepReorder(cfg)), configHash(cfg))
  assert.notEqual(JSON.stringify(deepReorder(cfg)), JSON.stringify(cfg), 'the reordering is real')
  assert.equal(configHash(JSON.parse(JSON.stringify(cfg))), configHash(cfg), 'a JSON round trip (as through the database)')
  assert.equal(configHash(makeConfig().engine), configHash(cfg))
  assert.notEqual(configHash(makeConfig({ mode: 'lab' }).engine), configHash(cfg))
  assert.notEqual(configHash({ a: [1, 2] }), configHash({ a: [2, 1] }))
  assert.notEqual(configHash({ a: 1 }), configHash({ a: '1' }))
  assert.equal(configHash({ a: 1, b: undefined }), configHash({ a: 1 }))
  // pinned, so a change to the hash itself (which would orphan every stored run) fails here
  assert.equal(configHash({ b: [1, 'x', null, true], a: { d: 0.25, c: -3 } }), configHash({ a: { c: -3, d: 0.25 }, b: [1, 'x', null, true] }))
  assert.equal(configHash(''), 'fnv1a64:07cc7607b4949e25')   // FNV-1a 64 of the two bytes ""
  assert.equal(configHash({ b: [1, 'x', null, true], a: { d: 0.25, c: -3 } }), 'fnv1a64:cc1a97ad3184d180')
  assert.throws(() => configHash({ a: NaN }), TypeError)
})

test('replay: a saved trial without a response field is refused; an explicit null is unanswered', () => {
  const cfg = makeConfig({ mode: 'online', demo: true }).engine
  const live = liveRun(cfg, 5, OBSERVER, 11)
  const saved = live.steps.map(s => s.saved)
  const { response: _dropped, ...noField } = saved[1]
  assert.throws(() => replay([saved[0], noField, ...saved.slice(2)], cfg, 5), e => e instanceof ReplayMismatchError && /no response field/.test(e.message))
  assert.throws(() => replay([saved[0], { ...saved[1], response: undefined }], cfg, 5), ReplayMismatchError)
  assert.throws(() => replay([null], cfg, 5), ReplayMismatchError)
  assert.equal(replay([saved[0], { ...saved[1], response: null }], cfg, 5).n_replayed, 2)
  assert.throws(() => savedTrial(live.init.trial), TypeError)
})

test('an AdaptiveSession must be seeded', () => {
  assert.throws(() => new A.AdaptiveSession(makeConfig().engine), /seeded rng/)
})

test('seeds: only an integer number in [0, 2^32) is accepted, by the controller, replay and makeRng', () => {
  const cfg = makeConfig({ mode: 'online', demo: true }).engine
  const BAD = [undefined, null, 1.9, '7', 'abc', -1, 2 ** 32, 2 ** 32 + 1, NaN, Infinity, 7n, true, [7], { seed: 7 }]
  for (const seed of BAD) {
    const msg = { type: 'init', cfg }
    if (seed !== undefined) msg.seed = seed
    assert.throws(() => A.makeController()(msg), RangeError, `controller init, seed ${String(seed)}`)
    assert.throws(() => replay([], cfg, seed), RangeError, `replay, seed ${String(seed)}`)
    assert.throws(() => A.makeRng(seed), /integer number in \[0, 2\^32\)/)
  }
  // a refused init leaves no session behind to answer
  const ctl = A.makeController()
  const first = ctl({ type: 'init', cfg, seed: 3 })
  assert.throws(() => ctl({ type: 'init', cfg, seed: -1 }), RangeError)
  assert.throws(() => ctl({ type: 'respond', trial_index: first.trial.trial_index, response: 'same' }), /unexpected trial/)
  assert.equal(ctl({ type: 'readout' }).readout, null)
  // valid seeds, including both ends, are used as before (draws pinned from the unguarded makeRng of commit 807d26b0)
  for (const seed of [0, 1, 4242, 0xdeadbeef, 2 ** 32 - 1]) {
    assert.equal(A.assertSeed(seed), seed)
    assert.ok(A.makeController()({ type: 'init', cfg, seed }).trial)
  }
  const draws = r => Array.from({ length: 5 }, () => r.random())
  assert.deepStrictEqual(draws(A.makeRng(1)), [0.8969592412468046, 0.2911854269914329, 0.9763102538418025, 0.243563235970214, 0.7215832360088825])})
