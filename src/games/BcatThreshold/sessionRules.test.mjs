// The session's own rules: the break position, the practice gate, the time limit, the moving average.
// Run: node --test src/games/BcatThreshold/sessionRules.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeConfig, configHash } from './config.js'
import { breakAfterMain, createPracticeGate, createTimeLimit, createMovingCompliance } from './sessionRules.js'

const cfg = makeConfig()
const ok = c => ({ compliant: c >= 0.5, coverage: c, ws_presses: null })
const NA = { compliant: null, coverage: null, ws_presses: null }

test('the new settings are outside cfg.engine: the engine config hash is unchanged by them', () => {
  const a = makeConfig(), b = makeConfig({ maxTotalMs: 1000, practiceGate: false, breakAtHalf: false, movingWindow: 4 })
  assert.equal(configHash(a.engine), configHash(b.engine))
  assert.equal(a.session.max_total_ms, 60 * 60 * 1000, 'sixty minutes')
  assert.equal(a.exclusion.moving_window, 10)
  assert.deepStrictEqual(a.practice.gate, { enabled: true, window: 3, max_sets: 3 })
  assert.equal(a.session.break_at_half, true)
  assert.equal(a.practice.gate.min_coverage, undefined, 'the gate has no threshold of its own: compliance.min_coverage is the one')
  assert.equal(makeConfig({ demo: true }).exclusion.moving_window, 3, 'the demo fills its window within a few trials')
  assert.equal(makeConfig({ maxTotalMs: null }).session.max_total_ms, null)
  assert.throws(() => makeConfig({ maxTotalMs: 0 }), /maxTotalMs/)
  assert.throws(() => makeConfig({ movingWindow: 0 }), /moving_window/)
})

test('the break comes after half the planned main trials, rounded to the nearest trial', () => {
  assert.equal(breakAfterMain(84), 42)
  assert.equal(breakAfterMain(83), 42)
  assert.equal(breakAfterMain(9), 5)
  assert.equal(breakAfterMain(0), 0)
  assert.throws(() => breakAfterMain(undefined))
})

test('practice gate: the mean of the last three assessed trials must reach min_coverage', () => {
  const g = createPracticeGate({ cfg, arm: 'touch' })
  assert.equal(g.gated, true)
  for (const c of [0.9, 0.2, 0.5]) g.add(ok(c))
  const v = g.closeSet()
  assert.equal(v.verdict, 'passed')
  assert.ok(Math.abs(v.mean - 0.5333333) < 1e-6)
  assert.equal(v.threshold, cfg.compliance.min_coverage)
  assert.equal(v.completed, true)
  assert.deepStrictEqual(g.summary().passed, true)
})

test('practice gate: a moving window across sets drops older trials; up to three sets, then failed', () => {
  const g = createPracticeGate({ cfg, arm: 'breath' })
  for (const c of [0.1, 0.0, 0.2]) g.add(ok(c))
  assert.equal(g.closeSet().verdict, 'retry')
  for (const c of [0.9, 0.9, 0.9]) g.add(ok(c))
  const v2 = g.closeSet()
  assert.deepStrictEqual(v2.window, [0.9, 0.9, 0.9], 'only the last three count')
  assert.equal(v2.verdict, 'passed')

  const f = createPracticeGate({ cfg, arm: 'touch' })
  const verdicts = []
  for (let s = 0; s < 3; s++) { for (let i = 0; i < 3; i++) f.add(ok(0.3)); verdicts.push(f.closeSet().verdict) }
  assert.deepStrictEqual(verdicts, ['retry', 'retry', 'failed'])
  assert.deepStrictEqual([f.summary().passed, f.summary().completed, f.summary().sets_used], [false, false, 3])
})

test('practice gate: interrupted or not-assessed trials do not count; too few assessed trials do not pass', () => {
  const g = createPracticeGate({ cfg, arm: 'touch' })
  g.add(ok(0.9)); g.add(NA); g.add(ok(0.9))
  const v = g.closeSet()
  assert.equal(v.n, 2)
  assert.equal(v.verdict, 'retry', 'two assessed trials cannot show adherence over a window of three')
  g.add(ok(0.8)); g.add(NA); g.add(NA)
  const v2 = g.closeSet()
  assert.deepStrictEqual(v2.window, [0.9, 0.9, 0.8], 'the window reaches back into the earlier set for assessed trials')
  assert.equal(v2.verdict, 'passed')
})

test('practice gate: vision is not gated; the set completes practice', () => {
  const g = createPracticeGate({ cfg, arm: 'vision' })
  g.add({ compliant: false, coverage: null, ws_presses: 3 })
  const v = g.closeSet()
  assert.deepStrictEqual([v.verdict, v.completed, v.passed], ['not_gated', true, null])
  assert.equal(g.summary().passed, null)
  const off = createPracticeGate({ cfg: makeConfig({ practiceGate: false }), arm: 'touch' })
  off.add(ok(0)); assert.equal(off.closeSet().verdict, 'not_gated', 'the switch turns the gate off')
})

test('time limit: counted from start(); exceeded at the limit; never before the start', () => {
  let t = 1000
  const tl = createTimeLimit({ limitMs: 5000, now: () => t })
  t += 99999
  assert.equal(tl.exceeded(), false, 'not started')
  tl.start()
  t += 4999
  assert.equal(tl.exceeded(), false)
  tl.start()   // a later call does not move the origin
  t += 1
  assert.equal(tl.exceeded(), true)
  assert.equal(tl.elapsed(), 5000)
  const none = createTimeLimit({ limitMs: null, now: () => t })
  none.start(); t += 1e12
  assert.equal(none.exceeded(), false)
})

test('moving average: touch and breath coverage over the last N assessed main trials, min over full windows', () => {
  const m = createMovingCompliance({ cfg: makeConfig({ movingWindow: 3 }), arm: 'touch' })
  const out = [0.9, 0.9, 0.9, null, 0.3, 0.3, 0.9].map(c => m.add(c === null ? NA : ok(c)))
  assert.deepStrictEqual(out.map(o => o.moving_window_n), [1, 2, 3, 3, 3, 3, 3])
  assert.ok(Math.abs(out[4].coverage_moving_avg - 0.7) < 1e-12)
  assert.ok(Math.abs(out[5].coverage_moving_avg - 0.5) < 1e-12)
  assert.ok(Math.abs(out[6].coverage_moving_avg - 0.5) < 1e-12)
  assert.equal(out[0].ws_press_moving_share, null)
  const s = m.summary()
  assert.ok(Math.abs(s.coverage_moving_avg_min - 0.5) < 1e-12)
  assert.equal(s.exclusion_flag_coverage, false, '0.5 is not below 0.5')
  m.add(ok(0.1))
  assert.equal(m.summary().exclusion_flag_coverage, true)
})

test('moving average: with no full window the flag is null, not false', () => {
  const m = createMovingCompliance({ cfg, arm: 'breath' })
  for (let i = 0; i < 9; i++) m.add(ok(0.1))
  assert.deepStrictEqual([m.summary().coverage_moving_avg_min, m.summary().exclusion_flag_coverage], [null, null])
})

test('moving average: vision records the share of trials with any W/S press, with no threshold', () => {
  const m = createMovingCompliance({ cfg: makeConfig({ movingWindow: 2 }), arm: 'vision' })
  const v = p => ({ compliant: p === 0, coverage: null, ws_presses: p })
  assert.deepStrictEqual(m.add(v(0)), { coverage_moving_avg: null, ws_press_moving_share: 0, moving_window_n: 1 })
  assert.equal(m.add(v(2)).ws_press_moving_share, 0.5)
  assert.equal(m.add(v(1)).ws_press_moving_share, 1)
  const s = m.summary()
  assert.deepStrictEqual([s.ws_press_moving_share_max, s.exclusion_flag_coverage, s.coverage_moving_avg_min], [1, null, null])
})
