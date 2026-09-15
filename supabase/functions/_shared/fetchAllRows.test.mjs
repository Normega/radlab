// fetchAllRows must return every matching row no matter how the server caps a
// response. Written after check_schedule silently lost ~760 of 1,758 schedule
// rows per tick to PostgREST's 1000-row cap (2026-09-15).
//
// Run: node --experimental-strip-types --test supabase/functions/_shared/fetchAllRows.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllRows } from './fetchAllRows.ts'

/** A fake ordered table that, like PostgREST, never returns more than `cap` rows. */
function cappedTable(n, cap) {
  const table = Array.from({ length: n }, (_, i) => ({ id: i }))
  let calls = 0
  const fetchPage = async (from, to) => {
    calls++
    return { data: table.slice(from, Math.min(to + 1, from + cap)), error: null }
  }
  return { fetchPage, calls: () => calls }
}

test('more rows than the cap: every row, in order, none repeated', async () => {
  const { fetchPage } = cappedTable(2500, 1000)
  const rows = await fetchAllRows(fetchPage)
  assert.equal(rows.length, 2500)
  assert.deepEqual(rows.map((r) => r.id), Array.from({ length: 2500 }, (_, i) => i))
})

test('a server cap smaller than the page size still reads everything', async () => {
  const { fetchPage } = cappedTable(2500, 7)
  const rows = await fetchAllRows(fetchPage, 1000)
  assert.equal(rows.length, 2500)
  assert.equal(new Set(rows.map((r) => r.id)).size, 2500)
})

test('exactly one full page is not mistaken for more, and does not loop', async () => {
  const t = cappedTable(1000, 1000)
  const rows = await fetchAllRows(t.fetchPage)
  assert.equal(rows.length, 1000)
  assert.equal(t.calls(), 2) // the full page, then the empty page that ends it
})

test('an empty result is an empty array', async () => {
  const { fetchPage } = cappedTable(0, 1000)
  assert.deepEqual(await fetchAllRows(fetchPage), [])
})

test('an error on a later page is thrown, not returned as a partial result', async () => {
  let call = 0
  const fetchPage = async (from, to) => {
    call++
    if (call === 2) return { data: null, error: { message: 'boom' } }
    return { data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i })), error: null }
  }
  await assert.rejects(fetchAllRows(fetchPage), /boom/)
})

test('a query that ignores its range cannot loop forever', async () => {
  const fetchPage = async () => ({ data: [{ id: 1 }], error: null })
  await assert.rejects(fetchAllRows(fetchPage, 1000, 50), /gave up after 50 pages/)
})
