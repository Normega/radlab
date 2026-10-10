// Separate external identity: surrogates look nothing like a platform id, the
// same id always maps to the same surrogate, a race resolves to one row, and a
// database error refuses rather than leaking the id elsewhere.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomSurrogate, surrogateFor } from './externalIdentity.ts'

// A fake external_identities table with supabase-js's chained-call shape.
function fakeDb({ failLookup = false, failInsertOnce = false } = {}) {
  const rows = []
  let insertFails = failInsertOnce
  const db = {
    rows,
    from(table) {
      assert.equal(table, 'external_identities')
      const filters = {}
      const q = {
        select() { return q },
        eq(col, val) { filters[col] = val; return q },
        async maybeSingle() {
          if (failLookup) return { data: null, error: { message: 'boom' } }
          const r = rows.find(x => x.study_id === filters.study_id && x.external_id === filters.external_id)
          return { data: r ?? null, error: null }
        },
        async insert(row) {
          if (insertFails) {
            insertFails = false
            // Simulate the racing request winning first.
            rows.push({ ...row, surrogate: 'P-winnerwinner' })
            return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
          }
          rows.push(row)
          return { error: null }
        },
      }
      return q
    },
  }
  return db
}

test('a surrogate is P- plus 12 unambiguous characters, and survives the auth-email slug', () => {
  for (let i = 0; i < 500; i++) {
    const s = randomSurrogate()
    assert.match(s, /^P-[abcdefghjkmnpqrstuvwxyz23456789]{12}$/)
    assert.equal(s.toLowerCase().replace(/[^a-z0-9]/g, '-'), s.toLowerCase())
    assert.doesNotMatch(s, /^[0-9a-f]{24}$/, 'never shaped like a Prolific ID')
  }
})

test('the same platform id gets the same surrogate; another id gets another', async () => {
  const db = fakeDb()
  const a1 = await surrogateFor(db, 'study-1', '5f2a9c1b7e4d3a0012345678')
  const a2 = await surrogateFor(db, 'study-1', '5f2a9c1b7e4d3a0012345678')
  const b = await surrogateFor(db, 'study-1', '60aa00bb11cc22dd33ee44ff')
  assert.equal(a1, a2)
  assert.notEqual(a1, b)
  assert.equal(db.rows.length, 2)
})

test('two studies keep separate surrogates for one person', async () => {
  const db = fakeDb()
  const s1 = await surrogateFor(db, 'study-1', 'pid')
  const s2 = await surrogateFor(db, 'study-2', 'pid')
  assert.notEqual(s1, s2)
})

test('a lost insert race returns the winner\'s surrogate', async () => {
  const db = fakeDb({ failInsertOnce: true })
  assert.equal(await surrogateFor(db, 'study-1', 'pid'), 'P-winnerwinner')
})

test('a database error refuses (null) rather than falling back to the raw id', async () => {
  const db = fakeDb({ failLookup: true })
  assert.equal(await surrogateFor(db, 'study-1', 'pid'), null)
})
