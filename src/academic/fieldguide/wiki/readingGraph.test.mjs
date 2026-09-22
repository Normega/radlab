// Run directly:  node src/academic/fieldguide/wiki/readingGraph.test.mjs
//
// The ranking decides which 6–10 of up to ~60 neighbours a student sees in
// the graph, so the properties under test are the ones that would quietly
// mislead: a two-way link must outrank a passing mention, a page the reader
// cannot see must never be drawn, and a source record is not a reading.

import test from 'node:test'
import assert from 'node:assert/strict'
import { rankNeighbours, visitBand, wrapLabel, isSourcePage } from './readingGraph.js'

const page = (id, title, extra = {}) => ({ id, slug: id, title, type: 'concept', status: 'published', ...extra })
const bySlug = (...ps) => new Map(ps.map(p => [p.slug, p]))

test('link kinds and ranking', () => {
  const pages = bySlug(page('self', 'Self'), page('a', 'Alpha'), page('b', 'Beta'),
                       page('c', 'Gamma'), page('d', 'Delta'))
  const r = rankNeighbours({
    selfId: 'self', pagesBySlug: pages,
    outIds: ['a', 'b', 'self'], inIds: ['a', 'c'], relatedSlugs: ['d', 'nope'],
  })
  assert.deepEqual(r.map(n => [n.slug, n.kind]),
    [['a', 'both'], ['b', 'out'], ['d', 'related'], ['c', 'in']])
})

test('same lecture lifts a backlink above an outbound link', () => {
  const pages = bySlug(page('self', 'Self'), page('a', 'Alpha'), page('b', 'Beta'))
  const lecturesOf = new Map([['self', new Set([3])], ['b', new Set([3, 4])], ['a', new Set([5])]])
  const r = rankNeighbours({ selfId: 'self', pagesBySlug: pages, outIds: ['a'], inIds: ['b'], lecturesOf })
  assert.deepEqual(r.map(n => n.slug), ['b', 'a'])
  assert.equal(r[0].sameLecture, true)
})

test('unreadable targets and source records are never drawn', () => {
  const pages = bySlug(page('self', 'Self'), page('s', 'A study', { type: 'study' }),
                       page('fundamentals-psychological-disorders-module-3', 'Module 3'))
  const r = rankNeighbours({
    selfId: 'self', pagesBySlug: pages,
    outIds: ['ghost', 's', 'fundamentals-psychological-disorders-module-3'],
  })
  assert.equal(r.length, 0)
  assert.equal(isSourcePage({ slug: 'x', type: 'disorder' }), false)
})

test('visits come through per neighbour', () => {
  const pages = bySlug(page('self', 'Self'), page('a', 'Alpha'))
  const r = rankNeighbours({ selfId: 'self', pagesBySlug: pages, outIds: ['a'], visits: new Map([['a', 4]]) })
  assert.equal(r[0].visits, 4)
})

test('visit bands', () => {
  assert.deepEqual([0, 1, 2, 3, 40, undefined].map(visitBand),
    ['none', 'some', 'some', 'often', 'often', 'none'])
})

test('label wrapping', () => {
  assert.deepEqual(wrapLabel('Panic Disorder', 14), ['Panic Disorder'])
  assert.deepEqual(wrapLabel('Generalized Anxiety Disorder', 14), ['Generalized', 'Anxiety…'])
  assert.deepEqual(wrapLabel('Attention-Deficit/Hyperactivity Disorder', 18),
    ['Attention-Deficit/', 'Hyperactivity…'])
  // a single over-long word is cut, never allowed to overflow
  for (const line of wrapLabel('Supercalifragilisticexpialidocious', 10)) assert.ok(line.length <= 10)
})
