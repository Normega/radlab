import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lazySlotsOf, upfrontSlotsOf, assignmentAction } from './lazySlots.js'

const study = {
  assignment_slots: { version: ['main', 'neutral'], cell_main: [{}, {}], cell_neutral: [{}, {}], other: ['a', 'b'] },
  assignment_slot_rules: {
    version: { assign: 'rule', draw_if: null },
    cell_main: { assign: 'node', draw_if: { slot: 'version', in: ['main'] } },
    cell_neutral: { assign: 'node', draw_if: { slot: 'version', in: ['neutral'] } },
  },
}

test('lazy slots are excluded from the up-front draw; others still drawn', () => {
  assert.deepEqual(lazySlotsOf(study).sort(), ['cell_main', 'cell_neutral', 'version'])
  assert.deepEqual(upfrontSlotsOf(study), ['other'])
})

test('a study without rules draws every slot up front, exactly as before', () => {
  const plain = { assignment_slots: { a: ['x', 'y'], b: ['p', 'q'] } }
  assert.deepEqual(lazySlotsOf(plain), [])
  assert.deepEqual(upfrontSlotsOf(plain), ['a', 'b'])
  assert.deepEqual(upfrontSlotsOf({ assignment_slots: null, assignment_slot_rules: null }), [])
})

test('a rule slot routes; a node slot draws only when draw_if is met', () => {
  const r = study.assignment_slot_rules
  assert.deepEqual(assignmentAction(r.version, {}), { action: 'route' })
  assert.deepEqual(assignmentAction(r.cell_main, { version: 'main' }), { action: 'draw' })
  assert.deepEqual(assignmentAction(r.cell_main, { version: 'neutral' }), { action: 'skip' })
  assert.deepEqual(assignmentAction(r.cell_neutral, { version: 'neutral' }), { action: 'draw' })
  assert.deepEqual(assignmentAction({ assign: 'node' }, {}), { action: 'draw' })
})

test('not knowing the slot draw_if depends on fails closed, never skips', () => {
  assert.equal(assignmentAction(study.assignment_slot_rules.cell_main, {}).action, 'error')
  assert.equal(assignmentAction(undefined, {}).action, 'error')
  assert.equal(assignmentAction({ assign: 'nonsense' }, {}).action, 'error')
  assert.equal(assignmentAction({ assign: 'node', draw_if: { slot: 'version' } }, { version: 'main' }).action, 'error')
})
