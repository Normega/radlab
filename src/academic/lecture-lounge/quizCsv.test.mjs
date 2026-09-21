import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quizResponsesCsv } from './quizCsv.js'

const items = [{ id: 'q_a' }, { id: 'q_b' }, { id: 'q_c' }]

test('columns follow config order, named item1..itemN, values as stored', () => {
  const csv = quizResponsesCsv(items, [{ q_c: 6, q_a: 0, q_b: 3 }], () => 0)
  assert.equal(csv, 'item1,item2,item3\n0,3,6\n')
})

test('carries no identifiers — only the answer values', () => {
  const csv = quizResponsesCsv(items, [{ q_a: 1, q_b: 2, q_c: 3, profile_id: 'abc' }])
  assert.doesNotMatch(csv, /abc|profile/)
})

test('rows are shuffled, not in arrival order', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ q_a: i, q_b: i, q_c: i }))
  let k = 0
  const seq = [0.1, 0.9, 0.4, 0.7, 0.2]
  const csv = quizResponsesCsv(items, rows, () => seq[k++ % seq.length])
  const firstCol = csv.trim().split('\n').slice(1).map((l) => l.split(',')[0])
  assert.notDeepEqual(firstCol, ['0', '1', '2', '3', '4', '5'])
  assert.deepEqual([...firstCol].sort(), ['0', '1', '2', '3', '4', '5'])
})

test('a missing answer is an empty cell, not a shifted row', () => {
  const csv = quizResponsesCsv(items, [{ q_a: 2, q_c: 5 }], () => 0)
  assert.equal(csv, 'item1,item2,item3\n2,,5\n')
})
