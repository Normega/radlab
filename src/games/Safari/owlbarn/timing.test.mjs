import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  summariseCalibration, makeSchedule, nextWinnum, optimalChoice, resolveWindow, applySteps,
  theoreticalMinimumMs, tierFor, summariseWindows, median, WINNUM_MAX,
} from './timing.js'

test('median ignores non-finite values', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(median([NaN, 5]), 5)
  assert.equal(median([]), null)
})

test('calibration clamps to the spec ranges', () => {
  assert.deepEqual(summariseCalibration([520, 480, 500], [1400, 1300, 1350]),
    { safeMs: 500, riskyMs: 1350, raw3: 500, raw8: 1350 })
  // a very fast 3-tap floors at 300; an 8-tap no slower than the 3-tap is lifted to safe+100
  const fast = summariseCalibration([120], [250])
  assert.equal(fast.safeMs, 300); assert.equal(fast.riskyMs, 400)
  // a very slow player caps at 1000 / 2500
  const slow = summariseCalibration([1800], [4000])
  assert.equal(slow.safeMs, 1000); assert.equal(slow.riskyMs, 2500)
  assert.equal(summariseCalibration([], [1000]), null)
})

test('schedule reproduces RiskFlex: window 1 = safe, window 10 = risky + 300', () => {
  const s = makeSchedule({ safeMs: 500, riskyMs: 1800 })
  assert.equal(s.stepMs, 178)                      // round((1800 + 300 - 500) / 9)
  assert.equal(s.windowMs(1), 500)
  assert.equal(s.windowMs(WINNUM_MAX), 500 + 9 * 178)
  assert.ok(Math.abs(s.windowMs(WINNUM_MAX) - 2100) <= 5)
})

test('triangle wave starts high, bounces at 1 and 10', () => {
  let st = { winnum: 10, dir: -1 }; const seq = [10]
  for (let i = 0; i < 20; i++) { st = nextWinnum(st.winnum, st.dir); seq.push(st.winnum) }
  assert.deepEqual(seq.slice(0, 12), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3])
  assert.equal(seq[18], 10); assert.equal(seq[19], 9)
})

test('"long" means the window can hold the measured 8 taps - not its position on the wave', () => {
  const s = makeSchedule({ safeMs: 500, riskyMs: 1800 })
  // window 6 is 1390 ms: shorter than this player's 8-tap time, so 3 taps is optimal
  assert.equal(optimalChoice(s.windowMs(6), s.riskyMs), '3tap')
  assert.equal(optimalChoice(s.windowMs(9), s.riskyMs), '8tap')     // 1924 ms
  assert.equal(optimalChoice(1800, 1800), '8tap')
})

test('window outcomes: wrong count swoops back two', () => {
  assert.deepEqual(resolveWindow(0), { choice: 'no_input', outcome: 'no_input', delta: 0 })
  assert.equal(resolveWindow(3).delta, 1)
  assert.equal(resolveWindow(8).delta, 2)
  assert.deepEqual(resolveWindow(5), { choice: '5tap', outcome: 'wrong_count', delta: -2 })
})

test('steps: floor 0 in corridor 1, the doorway is a checkpoint, cap at 20', () => {
  assert.equal(applySteps(1, -2), 0)
  assert.equal(applySteps(9, 2), 11)
  assert.equal(applySteps(11, -2), 10)            // cannot be carried back into corridor 1
  assert.equal(applySteps(10, -2), 10)
  assert.equal(applySteps(19, 2), 20)
})

test('theoretical minimum and tiers', () => {
  const s = makeSchedule({ safeMs: 500, riskyMs: 1800 })
  const t = theoreticalMinimumMs(s, 4000)
  // every window costs at least a hoot; 20 steps at most 2 per window -> at least 10 windows
  assert.ok(t >= 10 * 4000 && t < 20 * (4000 + 2200), `t=${t}`)
  assert.equal(tierFor(1.1).name, 'Master of Silence')
  assert.equal(tierFor(2.0).name, 'Adequately Stealthy')
  assert.equal(tierFor(9).name, 'Lucky Mouse')
})

test('window summary excludes lockout windows and counts hoot taps separately', () => {
  const w = [
    { kind: 'silence', optimal: '8tap', choice: '8tap', outcome: 'success', tapCount: 8 },
    { kind: 'silence', optimal: '3tap', choice: '3tap', outcome: 'success', tapCount: 3 },
    { kind: 'silence', optimal: '3tap', choice: '5tap', outcome: 'wrong_count', tapCount: 5 },
    { kind: 'silence', optimal: '3tap', choice: 'no_input', outcome: 'no_input', tapCount: 0, locked: true },
    { kind: 'hoot_tap' },
  ]
  const s = summariseWindows(w)
  assert.equal(s.windows, 3)
  assert.equal(s.efficiency, +(2 / 3).toFixed(3))
  assert.equal(s.long_window_8tap_rate, 1)
  assert.equal(s.short_window_3tap_rate, 0.5)
  assert.equal(s.short_window_8tap_attempt_rate, 0.5)
  assert.equal(s.hoot_taps, 1)
})
