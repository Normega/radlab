import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baselineScript, mainScript, positionFor, DUR } from './breScript.js'
import { clipsFor, clipOrder, CLIP_PLAN, SEQUENCES } from './breClips.js'
import { ALL_ITEMS } from './breItems.js'
import { CLIP_ONSET } from '../../../lib/physioMarkers.js'

const positions = (ops) => ops.filter(o => o.kind === 'rating').flatMap(o => o.items.map(i => positionFor(i, o.where)))
const upsets = (ops) => positions(ops).filter(p => p.startsWith('upset_'))

test('positions are built from where the item is asked', () => {
  assert.equal(positionFor('upset', 'b1_m2'), 'upset_b1_m2')
  assert.equal(positionFor('emo_sad', 'b1'), 'emo_b1_sad')
  assert.equal(positionFor('breath_adherence_pct', 'w'), 'breath_w_adherence_pct')
  assert.equal(positionFor('strat_explore', 'practice'), 'strat_practice_explore')
})

test('16 upset ratings per session, 15 not practice, in the plan order (§6b)', () => {
  const all = [...upsets(baselineScript()), ...upsets(mainScript({ version: 'main', condition: 'sf', sequence: 1 }))]
  assert.deepEqual(all, [
    'upset_practice', 'upset_baseline',
    'upset_n1_clip', 'upset_n1_break', 'upset_n2_clip', 'upset_n2_break',
    'upset_b1_m0', 'upset_b1_m1', 'upset_b1_m2', 'upset_b1_m3',
    'upset_w_clip', 'upset_w_break',
    'upset_b2_m0', 'upset_b2_m1', 'upset_b2_m2', 'upset_b2_m3',
  ])
})

test('every rating position is unique and every item exists', () => {
  for (const version of ['main', 'neutral']) for (const condition of ['sf', 'em']) {
    const ops = [...baselineScript(), ...mainScript({ version, condition, sequence: 3 })]
    const p = positions(ops)
    assert.equal(new Set(p).size, p.length, `${version}/${condition} has a repeated position`)
    for (const o of ops.filter(o => o.kind === 'rating')) for (const i of o.items) assert.ok(ALL_ITEMS[i], i)
  }
})

test('timing: 180 s baseline, 120 s practice, 60 s breaks, 3 × 60 s recovery per block', () => {
  const b = baselineScript().filter(o => o.kind === 'segment')
  assert.deepEqual(b.map(o => o.ms), [180000])
  const m = mainScript({ version: 'main', condition: 'em', sequence: 8 }).filter(o => o.kind === 'segment')
  assert.deepEqual(m.map(o => o.ms), [DUR.practice, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000])
  assert.ok(m.every(o => o.cue))
})

test('each of the 8 sequences puts one sad and one anger block in the plan §5 order', () => {
  assert.deepEqual(clipsFor({ version: 'main', sequence: 1 }).b1, { emotion: 'sad', pair: 1, clips: CLIP_PLAN.pairs.sad[1] })
  assert.deepEqual(clipsFor({ version: 'main', sequence: 6 }).b1, { emotion: 'anger', pair: 2, clips: CLIP_PLAN.pairs.anger[2] })
  for (const s of Object.keys(SEQUENCES)) {
    const c = clipsFor({ version: 'main', sequence: s })
    assert.deepEqual([c.b1.emotion, c.b2.emotion].sort(), ['anger', 'sad'])
    const order = clipOrder(c)
    assert.equal(new Set(order).size, 7, `sequence ${s} repeats a clip`)
    for (const id of order) assert.ok(CLIP_ONSET[id], `no marker for ${id}`)
  }
})

test('the neutral version shows seven different neutral clips in the same timeline', () => {
  const c = clipsFor({ version: 'neutral' })
  const order = clipOrder(c)
  assert.equal(new Set(order).size, 7)
  assert.ok(order.every(id => id.startsWith('N') || id.startsWith('P')))
  const main = mainScript({ version: 'main', condition: 'sf', sequence: 2 }).map(o => o.id)
  const neu = mainScript({ version: 'neutral', condition: 'sf' }).map(o => o.id)
  assert.deepEqual(neu, main)
})

test('the task refuses to build on a missing or unknown assignment', () => {
  assert.throws(() => mainScript({ version: 'main', condition: 'sf', sequence: 9 }))
  assert.throws(() => mainScript({ version: 'main', condition: 'sf' }))
  assert.throws(() => mainScript({ version: 'other', condition: 'sf', sequence: 1 }))
  assert.throws(() => mainScript({ version: 'main', condition: 'xx', sequence: 1 }))
})
