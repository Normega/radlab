// Headless checks for the flow game's ladder, staircase and zones.
// Run: node --test src/games/FlowGame/levels.test.mjs
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import {
  LADDER, TOP_LEVEL, SPEEDS, SIZES, STAIRCASES, CONDITION_OFFSET,
  levelFromScore, stepScore, estimateAbility, conditionPlan, zoneOf, emptyZoneTally, zoneSummary,
} from './levels.js'

// /prototypes/flow-game.html imports a published copy (static files can't reach src/).
for (const f of ['levels.js', 'arrows.js', 'fss.js']) {
  test(`public/prototypes/flow-game/${f} is an exact copy of src/games/FlowGame/${f}`, () => {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
    const pub = readFileSync(new URL(`../../../public/prototypes/flow-game/${f}`, import.meta.url), 'utf8')
    assert.equal(pub, src, `run: cp src/games/FlowGame/${f} public/prototypes/flow-game/${f}`)
  })
}

test('every ladder level names a known speed and size', () => {
  assert.equal(TOP_LEVEL, 13)
  for (const l of LADDER) {
    assert.ok(SPEEDS[l.speed], l.speed)
    assert.ok(SIZES[l.size], l.size)
    assert.ok(l.asteroids >= 1)
  }
})

test('score maps to level like the original int(score + 0.001), clamped to the ladder', () => {
  assert.equal(levelFromScore(1), 1)
  assert.equal(levelFromScore(1.999), 2) // 1.999 + 0.001 = 2
  assert.equal(levelFromScore(4.4), 4)
  assert.equal(levelFromScore(0.2), 1)
  assert.equal(levelFromScore(99), TOP_LEVEL)
})

test('staircase steps up on a clear, down on a death, and stays on the ladder', () => {
  const s = STAIRCASES.flow
  assert.equal(stepScore(5, 'clear', s), 5.4)
  assert.equal(stepScore(5, 'death', s), 4.7)
  assert.equal(stepScore(1.1, 'death', s), 1)
  assert.ok(stepScore(TOP_LEVEL + 0.9, 'clear', s) < TOP_LEVEL + 1)
  // three flow-step clears from x.5 cross one level
  let sc = 3.5
  for (let i = 0; i < 2; i++) sc = stepScore(sc, 'clear', s)
  assert.equal(levelFromScore(sc), 4)
})

test('ability is the rounded mean level over the last 60% of calibration', () => {
  const total = 180000
  const samples = []
  for (let t = 0; t < total; t += 100) samples.push({ t, level: t < 72000 ? 1 : (t / 100) % 2 ? 6 : 7 })
  assert.equal(estimateAbility(samples, total), 7) // 6.5 rounds to 7
  const flat = samples.map(s => ({ ...s, level: s.t < 72000 ? 1 : 4 }))
  assert.equal(estimateAbility(flat, total), 4)
  assert.equal(estimateAbility([], total), 1)
})

test('low and high sit CONDITION_OFFSET from ability and flag the clamp', () => {
  assert.deepEqual(conditionPlan('flow', 6), { level: 6, adaptive: true, gap: 0, clamped: false })
  assert.deepEqual(conditionPlan('low', 6), { level: 6 - CONDITION_OFFSET, adaptive: false, gap: 3, clamped: false })
  assert.deepEqual(conditionPlan('high', 6), { level: 9, adaptive: false, gap: 3, clamped: false })
  assert.deepEqual(conditionPlan('low', 1), { level: 1, adaptive: false, gap: 0, clamped: true })
  assert.deepEqual(conditionPlan('low', 2), { level: 1, adaptive: false, gap: 1, clamped: true })
  assert.deepEqual(conditionPlan('high', 12), { level: 13, adaptive: false, gap: 1, clamped: true })
  assert.deepEqual(conditionPlan('high', 13), { level: 13, adaptive: false, gap: 0, clamped: true })
  assert.throws(() => conditionPlan('medium', 5))
})

test('zones: below at -2 or less, above at +2 or more, matched between', () => {
  assert.equal(zoneOf(3, 5), 'below')
  assert.equal(zoneOf(4, 5), 'matched')
  assert.equal(zoneOf(6, 5), 'matched')
  assert.equal(zoneOf(7, 5), 'above')
})

test('zone summary gives seconds and per-minute rates, null with no time', () => {
  const t = emptyZoneTally()
  t.matched = { ms: 120000, deaths: 4, clears: 10, crystals: 32 }
  const s = zoneSummary(t)
  assert.equal(s.matched.seconds, 120)
  assert.equal(s.matched.deathsPerMin, 2)
  assert.equal(s.matched.clearsPerMin, 5)
  assert.equal(s.below.deathsPerMin, null)
})
