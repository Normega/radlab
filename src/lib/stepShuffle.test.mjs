import test from 'node:test'
import assert from 'node:assert/strict'
import { shuffleStepGroups } from './stepShuffle.js'

const n = (id, g = null) => ({ id, shuffle_group: g })
const NODES = [n('bg'), n('sfs'), n('ffmq', 'v'), n('maia', 'v'), n('phq', 'v'), n('bidr', 'v'), n('ius', 'v'), n('debrief')]
const ids = list => list.map(x => x.id)

test('fixed steps keep their place; the group is a permutation of itself', () => {
  for (let s = 0; s < 500; s++) {
    const out = ids(shuffleStepGroups(NODES, `tok-${s}`))
    assert.deepEqual([out[0], out[1], out[7]], ['bg', 'sfs', 'debrief'])
    assert.deepEqual(out.slice(2, 7).sort(), ['bidr', 'ffmq', 'ius', 'maia', 'phq'])
  }
})

test('the same token gives the same order; tokens differ', () => {
  assert.deepEqual(ids(shuffleStepGroups(NODES, 'abc')), ids(shuffleStepGroups(NODES, 'abc')))
  const seen = new Set(Array.from({ length: 300 }, (_, s) => ids(shuffleStepGroups(NODES, `t${s}`)).join()))
  assert.ok(seen.size > 60, `only ${seen.size} distinct orders`)
})

test('every scale reaches every slot about equally often', () => {
  const count = {}
  const N = 5000
  for (let s = 0; s < N; s++) ids(shuffleStepGroups(NODES, `u${s}`)).slice(2, 7).forEach((id, k) => {
    count[`${id}@${k}`] = (count[`${id}@${k}`] ?? 0) + 1
  })
  for (const v of Object.values(count)) assert.ok(Math.abs(v / N - 0.2) < 0.03, `share ${v / N}`)
})

test('runs of one group split by a fixed step shuffle separately', () => {
  const nodes = [n('a', 'g'), n('b', 'g'), n('fixed'), n('c', 'g'), n('d', 'g')]
  for (let s = 0; s < 200; s++) {
    const out = ids(shuffleStepGroups(nodes, `s${s}`))
    assert.deepEqual(out.slice(0, 2).sort(), ['a', 'b'])
    assert.equal(out[2], 'fixed')
    assert.deepEqual(out.slice(3).sort(), ['c', 'd'])
  }
})

test('no groups, no change; the input is not mutated', () => {
  const plain = [n('x'), n('y'), n('z')]
  assert.deepEqual(shuffleStepGroups(plain, 't'), plain)
  const copy = JSON.stringify(NODES)
  shuffleStepGroups(NODES, 't')
  assert.equal(JSON.stringify(NODES), copy)
})
