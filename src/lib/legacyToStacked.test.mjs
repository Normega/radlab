// v2 layout conversion: a legacy one-item-per-screen definition becomes labelled
// cards with the same item ids and options, published order, near-equal pages, a
// new page at every scale change; anything it cannot show faithfully stays v1.
import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyToStacked, pageSizes, effectiveLabels } from './legacyToStacked.js'

const agree7 = [
  { value: 1, label: 'Strongly disagree', image: null }, { value: 2, label: 'Disagree', image: null },
  { value: 3, label: 'Slightly disagree', image: null }, { value: 4, label: 'Neither agree nor disagree', image: null },
  { value: 5, label: 'Slightly agree', image: null }, { value: 6, label: 'Agree', image: null },
  { value: 7, label: 'Strongly agree', image: null },
]
const items = n => Array.from({ length: n }, (_, i) => ({ id: `q_${i + 1}`, text: `Item ${i + 1}`, type: 'likert' }))
const def = (n, extra = {}) => ({ slug: 'x', name: 'X', instructions: 'Rate each.', scale_labels: agree7, items: items(n), ...extra })
const cards = q => q.pages.flatMap(p => p.components.filter(c => c.type === 'likert'))

test('page sizes are near-equal, never a stray last item', () => {
  assert.deepEqual(pageSizes(34), [7, 7, 7, 7, 6])
  assert.deepEqual(pageSizes(15), [8, 7])
  assert.deepEqual(pageSizes(8), [8])
  assert.deepEqual(pageSizes(9), [5, 4])
  assert.deepEqual(pageSizes(4), [4])
})

test('same item ids, same order, same options, one card each', () => {
  const q = legacyToStacked(def(34))
  assert.equal(q.questionnaire_type, 'composable')
  assert.deepEqual(cards(q).map(c => c.id), items(34).map(i => i.id))
  for (const c of cards(q)) {
    assert.deepEqual(c.scale.map(o => o.value), [1, 2, 3, 4, 5, 6, 7])
    assert.equal(c.scale[3].label, 'Neither agree nor disagree')
    assert.equal(c.required, true)
  }
  assert.deepEqual(q.pages.map(p => p.components.filter(c => c.type === 'likert').length), [7, 7, 7, 7, 6])
})

test('the instructions open every page, as the legacy frame pinned them above every item', () => {
  const q = legacyToStacked(def(15))
  for (const p of q.pages) {
    assert.equal(p.components[0].type, 'information')
    assert.equal(p.components[0].body, 'Rate each.')
  }
  assert.equal(q.instructions, 'Rate each.')
})

test('a label that is only the number is not shown twice; endpoint text is kept', () => {
  const mpod = [{ value: 1, label: 'Strongly Disagree' }, ...[2, 3, 4, 5, 6].map(v => ({ value: v, label: String(v) })), { value: 7, label: 'Strongly Agree' }]
  const q = legacyToStacked(def(3, { scale_labels: mpod }))
  assert.deepEqual(cards(q)[0].scale.map(o => o.label), ['Strongly Disagree', '', '', '', '', '', 'Strongly Agree'])
})

test('zero-based scales keep their values (SMM-8 is 0–4)', () => {
  const smm = ['Strongly Disagree', 'Disagree', 'Neither', 'Agree', 'Strongly Agree'].map((label, value) => ({ value, label }))
  const q = legacyToStacked(def(8, { scale_labels: smm }))
  assert.deepEqual(cards(q)[0].scale.map(o => o.value), [0, 1, 2, 3, 4])
})

test('a change of response scale starts a new page', () => {
  const five = [1, 2, 3, 4, 5].map(v => ({ value: v, label: `L${v}` }))
  const d = def(6)
  d.items[3].scale_labels_override = five
  d.items[4].scale_labels_override = five
  const q = legacyToStacked(d)
  assert.deepEqual(q.pages.map(p => p.components.filter(c => c.type === 'likert').map(c => c.id)),
    [['q_1', 'q_2', 'q_3'], ['q_4', 'q_5'], ['q_6']])
})

test('what cannot be shown faithfully stays one item per screen (null)', () => {
  assert.equal(legacyToStacked(def(4, { questionnaire_type: 'checklist' })), null)
  assert.equal(legacyToStacked({ ...def(2), scale_labels: agree7.map(l => ({ ...l, image: 'face.png' })) }), null)
  const mixed = def(2); mixed.items[1].type = 'text'
  assert.equal(legacyToStacked(mixed), null)
  assert.equal(legacyToStacked({ questionnaire_type: 'composable', pages: [] }), null)
  assert.equal(legacyToStacked(def(0)), null)
})

test('effectiveLabels matches the legacy rule on ranges and the numeric fallback', () => {
  assert.deepEqual(effectiveLabels({ scale_min: 2, scale_max: 4 }, { scale_labels: agree7 }).map(l => l.value), [2, 3, 4])
  assert.deepEqual(effectiveLabels({ scale_min: 1, scale_max: 3 }, {}).map(l => l.label), ['1', '2', '3'])
})
