// Headless checks for the Flow Short Scale definition and scoring.
// Run: node --test src/games/FlowGame/fss.test.mjs
import { test } from 'node:test'
import assert from 'node:assert'
import { FSS_ITEMS, FSS_VERIFIED, fssPages, scoreFss } from './fss.js'

test('16 items: 10 flow, 3 worry, 3 fit, numbered in order', () => {
  assert.equal(FSS_ITEMS.length, 16)
  FSS_ITEMS.forEach((it, i) => assert.equal(it.n, i + 1))
  const n = sub => FSS_ITEMS.filter(i => i.sub === sub).length
  assert.deepEqual([n('flow'), n('worry'), n('fit')], [10, 3, 3])
})

test('pages break at 7 items and where the scale changes', () => {
  assert.deepEqual(fssPages().map(p => p.map(i => i.n)), [
    [1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13], [14, 15, 16],
  ])
})

test('Fluency and Absorption split the 10 flow items as the manual does', () => {
  const f = name => FSS_ITEMS.filter(i => i.factor === name).map(i => i.n)
  assert.deepEqual(f('fluency'), [2, 4, 5, 7, 8, 9])
  assert.deepEqual(f('absorption'), [1, 3, 6, 10])
})

test('items 1-13 are checked against the manual; 14-16 are not yet', () => {
  assert.deepEqual(FSS_ITEMS.filter(i => !i.verified).map(i => i.n), [14, 15, 16])
  assert.equal(FSS_VERIFIED, false)
})

test('totals are sums over a complete scale, as the manual scores them', () => {
  const answers = {}
  for (let n = 1; n <= 13; n++) answers[n] = n <= 10 ? 7 : 1
  const s = scoreFss(answers)
  assert.equal(s.flow.total, 70)
  assert.equal(s.fluency.total, 42)
  assert.equal(s.absorption.total, 28)
  assert.equal(s.worry.total, 3)
  assert.equal(s.flow.mean, 7)
  const low = {}
  for (let n = 1; n <= 13; n++) low[n] = 1
  assert.equal(scoreFss(low).flow.total, 10)
})

test('a skipped item leaves the total missing; means use the answered items', () => {
  const answers = { 1: 7, 2: 5, 3: null, 11: 2, 12: 4, 16: 5 }
  const s = scoreFss(answers)
  assert.equal(s.flow.total, null)
  assert.equal(s.flow.mean, 6)
  assert.equal(s.flow.answered, 2)
  assert.equal(s.flow.of, 10)
  assert.equal(s.worry.total, null)
  assert.equal(s.worry.mean, 3)
  assert.equal(s.demands, 5)
  assert.equal(s.difficulty, null)
  assert.equal(scoreFss({}).flow.mean, null)
})
