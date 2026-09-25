// fetchAllRows must read past the 1,000-row cap, order its pages, and never
// count a row twice. Run by `npm test`.
import assert from 'node:assert'
import { fetchAllRows } from './fetchAllRows.js'

/** A stand-in query builder over `rows`, recording what was asked of it. */
function table(rows, log = []) {
  return () => {
    const q = { orderedBy: null }
    return {
      order(col) { q.orderedBy = col; return this },
      range(from, to) {
        log.push({ from, to, orderedBy: q.orderedBy })
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
      },
    }
  }
}

const make = n => Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(5, '0')}` }))

// 1. The CHM135 case: 1,237 rows come back as 1,237, not 1,000.
{
  const log = []
  const rows = await fetchAllRows(table(make(1237), log))
  assert.equal(rows.length, 1237)
  assert.equal(log.length, 2, 'two pages')
  assert.ok(log.every(p => p.orderedBy === 'id'), 'every page ordered by id')
}

// 2. Exactly one full page still asks once more, and stops on the empty page.
{
  const log = []
  assert.equal((await fetchAllRows(table(make(1000), log))).length, 1000)
  assert.equal(log.length, 2)
}

// 3. Small reads are one request.
{
  const log = []
  assert.equal((await fetchAllRows(table(make(12), log))).length, 12)
  assert.equal(log.length, 1)
}

// 4. A row repeated across a page boundary is kept once.
{
  const rows = make(1005)
  rows.splice(1000, 0, rows[999])   // row 999 appears again at the top of page 2
  assert.equal((await fetchAllRows(table(rows))).length, 1005)
}

// 5. Errors surface rather than returning a short, plausible list.
{
  const failing = () => ({ order() { return this }, range: () => Promise.resolve({ data: null, error: new Error('boom') }) })
  await assert.rejects(fetchAllRows(failing), /boom/)
}

console.log('fetchAllRows: 5/5 checks passed')
