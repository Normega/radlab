// The screener draft must survive the move to a new tab (open recruitment:
// consent happens from an emailed link), be flushed at most once, and expire.
//
// Run: node --test src/lib/screenerDraft.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeScreenerDraft, takeScreenerDraft, draftKey, DRAFT_TTL_MS } from './screenerDraft.js'

function memStore() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    size: () => m.size,
  }
}

const NOW = Date.parse('2026-10-03T15:00:00Z')
const draft = (completedAt = new Date(NOW - 60_000).toISOString()) => ({
  completedAt, carryForward: true,
  questionnaires: [{ slug: 'phq-8', responses: { q1: 2 } }],
})

test('a draft written in one tab is found from a new tab of the same browser', () => {
  const local = memStore()
  const firstTab = { session: memStore(), local }
  const emailedTab = { session: memStore(), local } // new tab: fresh sessionStorage, shared localStorage
  assert.equal(writeScreenerDraft('s1', 'p1', draft(), firstTab), true)
  const got = takeScreenerDraft('s1', 'p1', emailedTab, NOW)
  assert.equal(got?.questionnaires[0].slug, 'phq-8')
})

test('taking the draft removes it everywhere, so it can never flush twice', () => {
  const tab = { session: memStore(), local: memStore() }
  writeScreenerDraft('s1', 'p1', draft(), tab)
  assert.ok(takeScreenerDraft('s1', 'p1', tab, NOW))
  assert.equal(takeScreenerDraft('s1', 'p1', tab, NOW), null)
  assert.equal(tab.session.size() + tab.local.size(), 0)
})

test('the same-tab route (SONA) still works from sessionStorage alone', () => {
  const tab = { session: memStore(), local: null }
  writeScreenerDraft('s1', 'p1', draft(), tab)
  assert.ok(takeScreenerDraft('s1', 'p1', tab, NOW))
})

test('a draft older than the TTL is discarded, and still removed', () => {
  const tab = { session: null, local: memStore() }
  writeScreenerDraft('s1', 'p1', draft(new Date(NOW - DRAFT_TTL_MS - 1000).toISOString()), tab)
  assert.equal(takeScreenerDraft('s1', 'p1', tab, NOW), null)
  assert.equal(tab.local.size(), 0)
})

test('drafts are keyed per study and participant', () => {
  const tab = { session: memStore(), local: memStore() }
  writeScreenerDraft('s1', 'p1', draft(), tab)
  assert.equal(takeScreenerDraft('s1', 'p2', tab, NOW), null)
  assert.equal(takeScreenerDraft('s2', 'p1', tab, NOW), null)
  assert.equal(draftKey('s1', 'p1'), 'screener_draft_s1_p1')
})

test('a store that throws (private mode) does not break the other', () => {
  const broken = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') }, removeItem() { throw new Error('denied') } }
  const tab = { session: broken, local: memStore() }
  assert.equal(writeScreenerDraft('s1', 'p1', draft(), tab), true)
  assert.ok(takeScreenerDraft('s1', 'p1', tab, NOW))
})
