// Headless sanity checks for Ember's transfer functions.
// Run: node src/games/Ember/emberMechanics.test.mjs
import assert from 'node:assert'
import {
  rateFromSignal, rateGain, regularityFactor, warmthDelta, stepWarmth,
  flameGeom, classifyRate, flameColor, emptyMetrics, accumulateMetrics, summarize,
  createWarmthEngine,
} from './emberMechanics.js'

// Feed the engine an oscillating (moving) breath at `bpm` for `ms`, from time t0.
function feedBreathing(eng, bpm, ms, t0 = 0) {
  const period = 60000 / bpm
  let t = t0
  for (; t < t0 + ms; t += 33) {
    const value = 0.5 + 0.4 * Math.sin(2 * Math.PI * t / period)
    eng.step({ t, value, lastPeriodMs: period, regularityCv: 0.05 }, 33)
  }
  return t
}

let n = 0
const ok = (name, fn) => { fn(); n++; console.log('  ok', name) }

ok('rateFromSignal prefers lastPeriodMs', () => {
  assert.equal(rateFromSignal({ lastPeriodMs: 10000, bpm: 20 }), 6)   // 10 s period = 6 bpm
  assert.equal(rateFromSignal({ bpm: 8 }), 8)
  assert.equal(rateFromSignal({}), 12)                                 // default
})

ok('rateGain hits the three anchors and clamps', () => {
  assert.equal(rateGain(6), 1)
  assert.equal(rateGain(10), 0)
  assert.equal(rateGain(14), -1)
  assert.equal(rateGain(3), 1)     // slower than resonance still clamps to +1
  assert.equal(rateGain(20), -1)   // way too fast clamps to −1
})

ok('regularityFactor: null→1, ragged→floor (CV input)', () => {
  assert.equal(regularityFactor(null), 1)
  assert.equal(regularityFactor(0), 1)
  assert.equal(regularityFactor(1.0), 0.60)     // CV far past scale → REG_MIN
  assert.ok(Math.abs(regularityFactor(0.07) - 0.8) < 1e-9)   // 1 − 0.07/0.35 = 0.8 (above floor)
  assert.equal(regularityFactor(0.35), 0.60)    // at scale → 0, clamped up to REG_MIN
})

ok('warmthDelta: slow fills (+), fast drains (−), CV gates gains only', () => {
  assert.ok(warmthDelta(6, 0, 1) > 0)
  assert.ok(warmthDelta(14, 0, 1) < 0)
  // regularity (CV) gates gains but not drains
  assert.ok(warmthDelta(6, 1.0, 1) < warmthDelta(6, 0, 1))
  assert.equal(warmthDelta(14, 1.0, 1), warmthDelta(14, 0, 1))
})

ok('stepWarmth clamps to [0,1] and converges up at resonance', () => {
  let W = 0
  for (let i = 0; i < 60; i++) W = stepWarmth(W, { lastPeriodMs: 10000 }, 1)  // 60 s @ 6 bpm
  assert.equal(W, 1)                                                          // saturated & clamped
  for (let i = 0; i < 120; i++) W = stepWarmth(W, { lastPeriodMs: 3000 }, 1)  // then 20 bpm
  assert.equal(W, 0)                                                          // fully drained & clamped
})

ok('flameGeom grows with W and flickers with value', () => {
  const lo = flameGeom(0, 0.5), hi = flameGeom(1, 0.5)
  assert.ok(hi.base > lo.base)
  assert.equal(lo.base, 0.30)                     // FLAME_BASE_MIN at W=0
  assert.equal(hi.base, 1.0)
  assert.ok(flameGeom(0.5, 1.0).flame > flameGeom(0.5, 0.0).flame)  // inhale taller than exhale
})

ok('classifyRate buckets', () => {
  assert.equal(classifyRate(5), 'resonance')
  assert.equal(classifyRate(9), 'ok')
  assert.equal(classifyRate(13), 'fast')
})

ok('flameColor ramps ember→gold', () => {
  const c0 = flameColor(0), c1 = flameColor(1)
  assert.deepEqual(c0, { r: 120, g: 30, b: 10 })
  assert.deepEqual(c1, { r: 255, g: 200, b: 70 })
  assert.ok(flameColor(0.5).g > c0.g && flameColor(0.5).g < c1.g)
})

ok('metrics accumulate and summarize', () => {
  const m = emptyMetrics(); m.startMs = 1000
  accumulateMetrics(m, { W: 0.4, rate: 6,  regularitySdMs: 200, holdMs: 0,    dtMs: 100 })
  accumulateMetrics(m, { W: 0.9, rate: 12, regularitySdMs: null, holdMs: 4000, dtMs: 100 })
  m.caughtFire = true
  const s = summarize(m, 1000 + 5000)
  assert.equal(s.maxWarmth, 0.9)
  assert.equal(s.longestHoldMs, 4000)
  assert.equal(s.timeInResonanceMs, 100)          // only the 6 bpm frame counted
  assert.equal(s.meanBpm, 9)                       // (6+12)/2
  assert.equal(s.meanRegularitySdMs, 200)          // null frame excluded
  assert.equal(s.caughtFire, true)
  assert.equal(s.durationMs, 5000)
})

ok('engine: sustained slow breathing still wins', () => {
  const eng = createWarmthEngine()
  feedBreathing(eng, 6, 90000)   // 90 s at 6 bpm, moving
  assert.ok(eng.warmth > 0.85, `90s slow should fill, got ${eng.warmth.toFixed(2)}`)
})

ok('engine: breath-hold guard blocks the frozen-rate exploit', () => {
  const eng = createWarmthEngine()
  // frozen slow rate (would fill on the raw step) but the breath value never moves
  for (let t = 0; t < 20000; t += 33) eng.step({ t, value: 0.8, lastPeriodMs: 10000, regularityCv: 0.05 }, 33)
  assert.ok(eng.warmth < 0.15, `held breath should not fill, got ${eng.warmth.toFixed(2)}`)
})

ok('engine: must sustain — brief slow burst stays modest, long one wins', () => {
  const run = (slowMs) => {
    const eng = createWarmthEngine()
    const t1 = feedBreathing(eng, 17, 4000)      // seed EMA at a fast pace (like game start)
    feedBreathing(eng, 6, slowMs, t1)            // then slow
    return eng.warmth
  }
  const short = run(10000), long = run(60000)
  assert.ok(short < 0.6, `10s slow after fast should stay modest, got ${short.toFixed(2)}`)
  assert.ok(long > 0.85, `60s sustained slow should win, got ${long.toFixed(2)}`)
  assert.ok(long - short > 0.3, 'sustained fills much more than a brief burst')
})

console.log(`\n${n} checks passed`)
