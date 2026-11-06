import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandAssignments, isStructuredArms } from './assignmentSlots.js'

test('a crossed slot hands each of its parts to the steps', () => {
  const got = expandAssignments({ condition: { relaxation_arm: 'reading', valley_order: 'thick_first' } })
  assert.equal(got.relaxation_arm, 'reading')
  assert.equal(got.valley_order, 'thick_first')
  assert.deepEqual(got.condition, { relaxation_arm: 'reading', valley_order: 'thick_first' })
})

test('plain and counterbalance slots are unchanged', () => {
  const drawn = { arm: 'control', order: ['b2', 'b1'] }
  assert.deepEqual(expandAssignments(drawn), drawn)
  assert.deepEqual(expandAssignments({}), {})
  assert.deepEqual(expandAssignments(null), {})
})

test('a slot drawn under the same name keeps its own value', () => {
  const got = expandAssignments({ relaxation_arm: 'breathing', condition: { relaxation_arm: 'reading' } })
  assert.equal(got.relaxation_arm, 'breathing')
})

test('structured arms are recognised, string arms are not', () => {
  assert.equal(isStructuredArms([{ a: 1 }, { a: 2 }]), true)
  assert.equal(isStructuredArms(['x', 'y']), false)
  assert.equal(isStructuredArms([['b1', 'b2']]), false)
  assert.equal(isStructuredArms(null), false)
})
