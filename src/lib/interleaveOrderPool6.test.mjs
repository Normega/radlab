// Sense Foraging Study 1 on item pool 6: 48 items (14 reverse-keyed) and two
// attention checks. Every seeded order must obey the engine's rules, and the
// reversal rules are re-checked here directly, not through orderViolations, so a
// bug in the engine's own checker cannot hide a broken order.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { interleaveOrder, orderViolations, validateInterleaveSpec } from './interleaveOrder.js'

const DEF = JSON.parse(fs.readFileSync(new URL('../../scripts/sense_foraging/study1/sf-pool6.json', import.meta.url), 'utf8'))
const SPEC = DEF.interleave
const REV = new Set(SPEC.groups[0].items)
const CHECKS = Object.keys(SPEC.anchored)
const SEEDS = 3000

const pagesOf = order => {
  const out = []
  let i = 0
  for (const n of SPEC.page_sizes) { out.push(order.slice(i, i + n)); i += n }
  return out
}

test('the pool 6 spec is valid and covers every component', () => {
  const ids = new Set(DEF.pages.flatMap(p => p.components.map(c => c.id)))
  assert.deepEqual(validateInterleaveSpec(SPEC, ids), [])
  assert.equal(SPEC.items.length, 50)
  assert.equal(REV.size, 14)
  assert.deepEqual(orderViolations(SPEC, DEF.pages.flatMap(p => p.components.map(c => c.id))), [],
    'the written fallback pages are themselves a valid order')
})

test('every order obeys every rule, checked directly', () => {
  for (let s = 0; s < SEEDS; s++) {
    const r = interleaveOrder(SPEC, `sched-${s}:sf-pool6`)
    assert.ok(r, `no order for seed ${s}`)
    const o = r.order
    assert.deepEqual(orderViolations(SPEC, o), [], `seed ${s}`)
    const pages = pagesOf(o)
    for (const p of pages) {
      const k = p.filter(id => REV.has(id)).length
      assert.ok(k >= 2 && k <= 3, `seed ${s}: ${k} reversals on a page`)
    }
    for (const [a, b] of SPEC.apart_pages) {
      assert.ok(!pages.some(p => p.includes(a) && p.includes(b)), `seed ${s}: ${a} and ${b} share a page`)
    }
    let run = 0
    o.forEach((id, i) => {
      if (REV.has(id)) {
        assert.ok(i > 0, `seed ${s}: a reversal is first`)
        assert.ok(!REV.has(o[i - 1]), `seed ${s}: adjacent reversals at ${i}`)
        assert.ok(!CHECKS.includes(o[i - 1]) && !CHECKS.includes(o[i + 1]), `seed ${s}: reversal beside a check`)
        run = 0
      } else {
        run++
        assert.ok(run <= 5, `seed ${s}: ${run} positively keyed in a row`)
      }
    })
    assert.ok(o.indexOf('sf6_attn_disagree') < 26 && o.indexOf('sf6_attn_agree') >= 26, `seed ${s}: checks in their halves`)
  }
})

test('orders differ between participants and repeat for the same one', () => {
  const a = interleaveOrder(SPEC, 'sched-abc:sf-pool6')
  assert.deepEqual(interleaveOrder(SPEC, 'sched-abc:sf-pool6').order, a.order)
  const distinct = new Set(Array.from({ length: 200 }, (_, s) => interleaveOrder(SPEC, `x${s}`).order.join()))
  assert.equal(distinct.size, 200)
})

test('every item reaches every page', () => {
  const seen = Object.fromEntries(SPEC.items.map(id => [id, new Set()]))
  for (let s = 0; s < 1500; s++) pagesOf(interleaveOrder(SPEC, `spread-${s}`).order).forEach((p, k) => p.forEach(id => seen[id].add(k)))
  for (const id of SPEC.items) {
    if (CHECKS.includes(id)) continue
    assert.equal(seen[id].size, SPEC.page_sizes.length, `${id} only on pages ${[...seen[id]].join(',')}`)
  }
})
