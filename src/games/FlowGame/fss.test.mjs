// Headless checks for the Flow Short Scale definition and scoring.
// Run: node --test src/games/FlowGame/fss.test.mjs
import { test } from 'node:test'
import assert from 'node:assert'
import { FSS_ITEMS, fssPages, scoreFss } from './fss.js'

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

test('subscale means use answered items; skipped items stay missing', () => {
  const answers = { 1: 7, 2: 5, 3: null, 11: 2, 12: 4, 16: 5 }
  const s = scoreFss(answers)
  assert.equal(s.flow, 6)
  assert.equal(s.flowAnswered, 2)
  assert.equal(s.worry, 3)
  assert.equal(s.demands, 5)
  assert.equal(s.difficulty, null)
  assert.equal(scoreFss({}).flow, null)
})
