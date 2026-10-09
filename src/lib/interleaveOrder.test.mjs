// Interleaved item order: every order obeys every rule, the same seed gives the
// same order (a reload must not reshuffle a participant), and items still land
// in every position about equally often. Spec = the Sense Foraging Scale's.
import test from 'node:test'
import assert from 'node:assert/strict'
import { interleaveOrder, orderViolations, validateInterleaveSpec } from './interleaveOrder.js'

const id = n => `sfs_${String(n).padStart(2, '0')}`
const ids = ns => ns.map(id)
const CHECK = 'sfs_attn_check'

const SPEC = {
  items: [...ids(Array.from({ length: 32 }, (_, i) => i + 1)), CHECK],
  page_sizes: [9, 8, 8, 8],
  clusters: {
    action: ids([1, 6, 7, 8, 9]), practice: ids([2, 3]), drift: ids([4, 13, 14]),
    view_core: ids([5, 10, 11, 12]), view_stress: ids([16, 18]), normalizing: ids([15, 17]),
    completeness: ids([19, 20, 21]), safety: ids([22, 23, 24]), reward: ids([25, 26, 27]),
    view_openness: ids([28, 29, 30, 31, 32]),
  },
  cluster_min_gap: 3,
  cluster_max_per_page: 2,
  groups: [{ items: ids([5, 10, 11, 12, 16, 18, 28, 29, 30, 31, 32]), min_gap: 2, max_per_page: 3 }],
  pairs: [[id(4), id(13)], [id(16), id(18)], [id(1), id(9)], [id(6), id(16)]],
  pair_min_gap: 3,
  anchored: { [CHECK]: { min_position: 11, max_position: 24, not_page_edge: true } },
}
const SEEDS = 3000

test('the Sense Foraging spec is valid', () => {
  assert.deepEqual(validateInterleaveSpec(SPEC, new Set(SPEC.items)), [])
})

test('every order obeys every rule', () => {
  for (let s = 0; s < SEEDS; s++) {
    const r = interleaveOrder(SPEC, `sched-${s}`)
    assert.ok(r, `no order for seed ${s}`)
    assert.deepEqual(orderViolations(SPEC, r.order), [], `seed ${s}: ${r.order.join(' ')}`)
    assert.deepEqual(r.pages.map(p => p.length), SPEC.page_sizes)
  }
})

test('same seed, same order; different seeds, different orders', () => {
  const a = interleaveOrder(SPEC, 'sched-abc:sf-sfs')
  assert.deepEqual(interleaveOrder(SPEC, 'sched-abc:sf-sfs').order, a.order)
  const distinct = new Set(Array.from({ length: 200 }, (_, s) => interleaveOrder(SPEC, `x${s}`).order.join()))
  assert.ok(distinct.size > 195, `only ${distinct.size} distinct orders in 200`)
})

test('positions are recorded 1-indexed and match the order', () => {
  const r = interleaveOrder(SPEC, 'p')
  r.order.forEach((item, i) => assert.equal(r.positions[item], i + 1))
})

test('items land in every position about equally often', () => {
  const sum = Object.fromEntries(SPEC.items.map(i => [i, 0]))
  const first = Object.fromEntries(SPEC.items.map(i => [i, 0]))
  for (let s = 0; s < SEEDS; s++) {
    const { order } = interleaveOrder(SPEC, `bal-${s}`)
    order.forEach((item, k) => { sum[item] += k + 1 })
    first[order[0]]++
  }
  for (let n = 1; n <= 32; n++) {
    const mean = sum[id(n)] / SEEDS
    assert.ok(mean > 15 && mean < 19, `${id(n)} mean position ${mean.toFixed(2)} (balanced = 17)`)
    const share = first[id(n)] / SEEDS
    assert.ok(share > 0.015 && share < 0.06, `${id(n)} opens ${(share * 100).toFixed(1)}% of orders (balanced ≈ 3.1%)`)
  }
  const checkMean = sum[CHECK] / SEEDS
  assert.ok(checkMean >= 11 && checkMean <= 24)
})

test('the rule checker sees a clumped order (so "no violations" means something)', () => {
  const plain = [...SPEC.items.slice(0, 20), CHECK, ...SPEC.items.slice(20, 32)]
  // Written order: sfs_06..sfs_09 (all Action) sit side by side.
  assert.ok(orderViolations(SPEC, plain).length > 0)
})

test('the validator catches a broken spec', () => {
  const bad = { ...SPEC, page_sizes: [9, 8, 8], anchored: { [id(1)]: { min_position: 2 } } }
  const errors = validateInterleaveSpec(bad, new Set(SPEC.items))
  assert.ok(errors.some(e => e.includes('add up')))
  assert.ok(errors.some(e => e.includes('cannot also be in a cluster')))
})
