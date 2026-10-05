// Headless checks for the BCAT-DDM schedule generator.
// Run: node --test src/games/BcatDdm/schedule.test.mjs
import { test } from 'node:test'
import assert from 'node:assert'
import { DESIGNS, DEFAULTS, buildSchedule, scheduleYield, pacerAt } from './schedule.js'

const lo = DEFAULTS.basePeriodMs * DEFAULTS.minRatio
const hi = DEFAULTS.basePeriodMs * DEFAULTS.maxRatio

for (const design of DESIGNS) {
  test(`${design}: breaths are contiguous except across pauses`, () => {
    const s = buildSchedule(design, { seed: 7 })
    const pauseAt = new Map(s.pauses.map(p => [p.beforeBreath, p]))
    for (let i = 1; i < s.breaths.length; i++) {
      const prevEnd = s.breaths[i - 1].startMs + s.breaths[i - 1].periodMs
      const p = pauseAt.get(i)
      const expected = p ? p.endMs : prevEnd
      assert.ok(Math.abs(s.breaths[i].startMs - expected) <= 1, `breath ${i} starts at ${s.breaths[i].startMs}, expected ${expected}`)
    }
  })

  test(`${design}: fits the time budget and periods stay in bounds`, () => {
    const s = buildSchedule(design, { seed: 3 })
    assert.ok(s.durationMs <= DEFAULTS.minutes * 60_000)
    assert.ok(s.durationMs > DEFAULTS.minutes * 60_000 * 0.9, `only ${s.durationMs} ms used`)
    for (const b of s.breaths) assert.ok(b.periodMs >= lo - 1 && b.periodMs <= hi + 1, `period ${b.periodMs}`)
  })

  test(`${design}: every event onset is a breath start`, () => {
    const s = buildSchedule(design, { seed: 11 })
    for (const e of s.events) {
      assert.equal(s.breaths[e.onsetBreath].startMs, Math.round(e.onsetMs))
      assert.ok(e.windowEndMs > e.onsetMs)
    }
  })

  test(`${design}: same seed, same schedule; different seed, different schedule`, () => {
    const a = JSON.stringify(buildSchedule(design, { seed: 5 }).events)
    assert.equal(a, JSON.stringify(buildSchedule(design, { seed: 5 }).events))
    assert.notEqual(a, JSON.stringify(buildSchedule(design, { seed: 6 }).events))
  })
}

test('step events change the period by the stated magnitude', () => {
  for (const design of ['brief', 'roving', 'trials']) {
    const s = buildSchedule(design, { seed: 2 })
    for (const e of s.events.filter(e => e.type === 'step')) {
      const before = s.breaths[e.onsetBreath - 1].periodMs
      const after = s.breaths[e.onsetBreath].periodMs
      assert.equal(after, e.toPeriodMs)
      if (design !== 'trials' || e.onsetBreath > 0) {
        assert.ok(Math.abs(after / before - (1 + e.dir * e.mag)) < 0.002, `${design}: ${before}→${after} vs ${e.dir}·${e.mag}`)
      }
    }
  }
})

test('roving has no returns; brief returns after every step', () => {
  const r = scheduleYield(buildSchedule('roving', { seed: 1 }))
  const b = scheduleYield(buildSchedule('brief', { seed: 1 }))
  assert.equal(r.returns, 0)
  assert.equal(b.returns, b.steps)
})

test('ramp periods grow monotonically away from baseline', () => {
  const s = buildSchedule('ramp', { seed: 4 })
  for (const e of s.events.filter(e => e.type === 'ramp')) {
    let prevDev = 0
    for (let i = e.onsetBreath; s.breaths[i] && s.breaths[i].startMs < e.windowEndMs; i++) {
      const dev = Math.abs(s.breaths[i].periodMs / DEFAULTS.basePeriodMs - 1)
      assert.ok(dev >= prevDev - 1e-3)
      prevDev = dev
    }
  }
})

test('roving_mixed interleaves steps and ramps that reach the same new rate', () => {
  const s = buildSchedule('roving_mixed', { seed: 8 })
  const steps = s.events.filter(e => e.type === 'step')
  const ramps = s.events.filter(e => e.type === 'ramp')
  assert.ok(steps.length > 10 && ramps.length > 10, `${steps.length} steps, ${ramps.length} ramps`)
  for (const e of ramps) {
    const first = s.breaths[e.onsetBreath].periodMs
    const last = s.breaths[e.onsetBreath + e.rampBreaths - 1].periodMs
    assert.ok(Math.abs(last - e.toPeriodMs) <= 1, `ramp ends at ${last}, expected ${e.toPeriodMs}`)
    // first ramp breath carries only 1/n of the change (log scale)
    const frac = Math.log(first / e.fromPeriodMs) / Math.log(e.toPeriodMs / e.fromPeriodMs)
    assert.ok(Math.abs(frac - 1 / e.rampBreaths) < 0.02, `first-breath fraction ${frac}`)
  }
  // magnitudes come from the same distribution for both kinds of change
  const med = (xs) => xs.map(e => e.mag).sort((a, b) => a - b)[xs.length >> 1]
  assert.ok(Math.abs(Math.log(med(steps) / med(ramps))) < 0.5)
})

test('roving yields more changes per minute than the brief design', () => {
  const r = scheduleYield(buildSchedule('roving', { seed: 1 }))
  const b = scheduleYield(buildSchedule('brief', { seed: 1 }))
  assert.ok(r.changesPerMin > 1.5 * b.changesPerMin, `${r.changesPerMin} vs ${b.changesPerMin}`)
})

test('pacerAt: phase runs 0→1 within a breath and is null in pauses', () => {
  const s = buildSchedule('trials', { seed: 9 })
  const b = s.breaths[5]
  assert.equal(pacerAt(s, b.startMs).phase, 0)
  assert.ok(Math.abs(pacerAt(s, b.startMs + b.periodMs / 2).phase - 0.5) < 1e-9)
  const p = s.pauses[1]
  assert.equal(pacerAt(s, p.startMs + 10), null)
})
