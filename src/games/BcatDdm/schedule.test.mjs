// Headless checks for the BCAT-DDM schedule generator.
// Run: node --test src/games/BcatDdm/schedule.test.mjs
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { DESIGNS, DEFAULTS, buildSchedule, scheduleYield, pacerAt, bumpProfile } from './schedule.js'

// The /prototypes/bcat-ddm.html page imports a published copy (static files can't reach src/).
// It must stay byte-identical, or the prototype runs a different design from the one simulated.
test('public/prototypes/bcat-ddm-schedule.js is an exact copy of this module', () => {
  const src = readFileSync(new URL('./schedule.js', import.meta.url), 'utf8')
  const pub = readFileSync(new URL('../../../public/prototypes/bcat-ddm-schedule.js', import.meta.url), 'utf8')
  assert.equal(pub, src, 'run: cp src/games/BcatDdm/schedule.js public/prototypes/bcat-ddm-schedule.js')
})

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

test('double_blip: blips are single breaths, pairs separated by the stated gap, rate never roves', () => {
  const s = buildSchedule('double_blip', { seed: 12 })
  const B = DEFAULTS.basePeriodMs
  const pairs = s.events.filter(e => e.type === 'blip_pair')
  const singles = s.events.filter(e => e.type === 'blip_single')
  assert.ok(pairs.length > 20 && singles.length > 3, `${pairs.length} pairs, ${singles.length} singles`)
  for (const e of [...pairs, ...singles]) {
    const i = e.onsetBreath
    assert.equal(s.breaths[i].periodMs, e.toPeriodMs)
    assert.equal(s.breaths[i + 1].periodMs === B || e.gap === 0, true)
    if (e.type === 'blip_pair') {
      for (let k = 1; k <= e.gap; k++) assert.equal(s.breaths[i + k].periodMs, B, `gap breath ${k}`)
      assert.equal(s.breaths[i + e.gap + 1].periodMs, e.toPeriodMs, 'second blip')
      assert.equal(s.breaths[i + e.gap + 2].periodMs, B, 'back to base after the pair')
    }
  }
  // every breath that is not a blip runs at the base rate
  for (const b of s.breaths) if (b.tag !== 'dblip') assert.equal(b.periodMs, B)
  // all gaps and both sizes occur
  assert.deepEqual([...new Set(pairs.map(e => e.gap))].sort((a, b) => a - b), DEFAULTS.blipGaps)
  assert.deepEqual([...new Set(pairs.map(e => e.sizeIdx))].sort(), [0, 1])
})

test('blip_train: random single-breath blips at about the stated rate, never two in a row', () => {
  const s = buildSchedule('blip_train', { seed: 13 })
  const tags = s.breaths.map(b => b.tag)
  for (let i = 1; i < tags.length; i++) assert.ok(!(tags[i] === 'tblip' && tags[i - 1] === 'tblip'), `consecutive blips at ${i}`)
  const rate = tags.filter(t => t === 'tblip').length / tags.length
  // P(blip) = p on breaths that may carry one (those after a non-blip): p / (1 + p) overall
  const expected = DEFAULTS.blipTrainP / (1 + DEFAULTS.blipTrainP)
  assert.ok(Math.abs(rate - expected) < 0.03, `blip rate ${rate.toFixed(3)} vs ${expected.toFixed(3)}`)
})

test('blip_combo: double blips first, then a blip train', () => {
  const s = buildSchedule('blip_combo', { seed: 14 })
  const firstT = s.breaths.findIndex(b => b.tag === 'tblip')
  const lastD = s.breaths.map(b => b.tag).lastIndexOf('dblip')
  assert.ok(firstT > 0 && lastD > 0 && lastD < firstT)
  assert.ok(s.breaths[lastD].startMs < 0.55 * DEFAULTS.minutes * 60_000)
})

test('bumpProfile: smooth, symmetric, peak 1, no breath-to-breath jump above ~0.55 of the peak', () => {
  for (const n of [3, 4]) {
    const w = bumpProfile(n)
    assert.equal(w.length, n)
    assert.ok(Math.abs(Math.max(...w) - 1) < 0.1)
    for (let i = 0; i < n; i++) assert.ok(Math.abs(w[i] - w[n - 1 - i]) < 1e-9)
    const steps = [w[0], ...w.slice(1).map((x, i) => Math.abs(x - w[i])), w[n - 1]]
    assert.ok(Math.max(...steps) <= 0.56, `n=${n} max step ${Math.max(...steps)}`)
  }
})

test('double_bump: bumps rise and return, pairs separated by the stated gap, rate otherwise at base', () => {
  const s = buildSchedule('double_bump', { seed: 21 })
  const B = DEFAULTS.basePeriodMs
  const pairs = s.events.filter(e => e.type === 'bump_pair')
  assert.ok(pairs.length > 15, `${pairs.length} pairs`)
  for (const e of pairs) {
    const i = e.onsetBreath, w = e.width
    for (let k = 0; k < w; k++) assert.notEqual(s.breaths[i + k].periodMs, B, 'bump breath')
    for (let k = 0; k < e.gap; k++) assert.equal(s.breaths[i + w + k].periodMs, B, 'gap breath')
    assert.equal(s.breaths[i + 2 * w + e.gap].periodMs, B, 'back to base after the pair')
  }
  for (const b of s.breaths) if (b.tag !== 'dbump') assert.equal(b.periodMs, B)
  assert.deepEqual([...new Set(pairs.map(e => e.gap))].sort((a, b) => a - b), DEFAULTS.bumpGaps)
  assert.deepEqual([...new Set(pairs.map(e => e.width))].sort(), DEFAULTS.bumpWidths)
})

test('roving_bump / roving_ramp_bump: blocks in order, a pause before the bump block', () => {
  for (const d of ['roving_bump', 'roving_ramp_bump']) {
    const s = buildSchedule(d, { seed: 22 })
    const types = s.events.map(e => e.type)
    const firstBump = types.findIndex(t => t.startsWith('bump'))
    assert.ok(firstBump > 0 && types.slice(0, firstBump).every(t => t === 'step'), d)
    if (d === 'roving_ramp_bump') {
      const firstRamp = types.indexOf('ramp')
      assert.ok(firstRamp > firstBump && types.slice(firstRamp).every(t => t === 'ramp' || t === 'null'), d)
    }
    const bumpOnset = s.events[firstBump].onsetBreath
    assert.ok(s.pauses.some(p => p.beforeBreath <= bumpOnset && p.beforeBreath > s.events[firstBump - 1].onsetBreath), `${d}: pause before bumps`)
  }
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
