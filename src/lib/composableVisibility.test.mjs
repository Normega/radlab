// show_if: a gated question appears only when its condition holds, a hidden one
// is recorded as not applicable (never blank, never 'pna'), and the validator
// refuses conditions that could never be met.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NOT_APPLICABLE, conditionMet, isVisible, pageIsShown, markNotApplicable, validateShowIf,
} from './composableVisibility.js'

const gate = {
  id: 'practice', type: 'multiple_choice', allow_pna: true,
  options: [{ id: 'yes' }, { id: 'no' }],
}
const years = { id: 'years', type: 'multiple_choice', show_if: { component: 'practice', equals: 'yes' } }
const note = { id: 'note', type: 'information', show_if: { component: 'practice', equals: 'yes' } }
const pages = [{ id: 'p1', components: [gate] }, { id: 'p2', components: [note, years] }]
const collects = c => c.type !== 'information'

test('a single-choice answer opens the gate; no, pna and blank keep it shut', () => {
  assert.equal(isVisible(years, { practice: { option_id: 'yes', value: null } }), true)
  assert.equal(isVisible(years, { practice: { option_id: 'no', value: null } }), false)
  assert.equal(isVisible(years, { practice: 'pna' }), false)
  assert.equal(isVisible(years, {}), false)
})

test('select-all answers and `in` lists match any chosen option', () => {
  const multi = [{ option_id: 'yoga', value: null }, { option_id: 'other', value: 'x' }]
  assert.equal(conditionMet({ component: 'q', equals: 'other' }, { q: multi }), true)
  assert.equal(conditionMet({ component: 'q', in: ['tai_chi', 'yoga'] }, { q: multi }), true)
  assert.equal(conditionMet({ component: 'q', in: ['tai_chi'] }, { q: multi }), false)
  assert.equal(conditionMet({ component: 'q', equals: 'pna' }, { q: 'pna' }), true)
})

test('a page whose components are all hidden is skipped', () => {
  assert.equal(pageIsShown(pages[1], { practice: { option_id: 'no' } }), false)
  assert.equal(pageIsShown(pages[1], { practice: { option_id: 'yes' } }), true)
})

test('hidden questions are stored as not_applicable, even if answered before the gate changed', () => {
  const out = markNotApplicable(pages, { practice: { option_id: 'no' }, years: { option_id: 'years', value: 4 } }, collects)
  assert.equal(out.years, NOT_APPLICABLE)
  assert.deepEqual(out.practice, { option_id: 'no' })
  assert.equal('note' in out, false, 'information blocks collect nothing')
  const open = markNotApplicable(pages, { practice: { option_id: 'yes' }, years: { option_id: 'years', value: 4 } }, collects)
  assert.deepEqual(open.years, { option_id: 'years', value: 4 })
})

test('the validator refuses a forward reference and an option the gate does not have', () => {
  assert.deepEqual(validateShowIf(pages), [])
  const forward = [{ id: 'p', components: [{ id: 'a', show_if: { component: 'b', equals: 'yes' } }, { id: 'b', type: 'multiple_choice', options: [] }] }]
  assert.match(validateShowIf(forward)[0], /earlier component/)
  const typo = [{ id: 'p', components: [gate, { id: 'y', show_if: { component: 'practice', equals: 'Yes' } }] }]
  assert.match(validateShowIf(typo)[0], /not an option/)
  const pnaGate = [{ id: 'p', components: [gate, { id: 'y', show_if: { component: 'practice', equals: 'pna' } }] }]
  assert.deepEqual(validateShowIf(pnaGate), [], "'pna' is a valid condition where the gate offers it")
})
