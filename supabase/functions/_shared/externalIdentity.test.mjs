// Separate external identity: surrogates look nothing like a platform id, the
// same id always maps to the same surrogate, a lost race is retried, a database
// error refuses rather than leaking the id elsewhere, and the id only ever
// travels in an RPC body (never a URL, which the API gateway logs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomSurrogate, surrogateFor } from './externalIdentity.ts'

// A fake of the external_identity_surrogate RPC (find-or-create).
function fakeDb({ fail = false, emptyOnce = false } = {}) {
  const rows = new Map()
  let empty = emptyOnce
  const calls = []
  return {
    rows, calls,
    // Proves the shape: only .rpc is offered, so any .from().eq() GET would throw.
    async rpc(fn, args) {
      calls.push({ fn, args })
      assert.equal(fn, 'external_identity_surrogate')
      if (fail) return { data: null, error: { code: '42501', message: 'permission denied' } }
      const key = `${args.p_study_id}|${args.p_external_id}`
      if (!rows.has(key)) rows.set(key, args.p_candidate)
      if (empty) { empty = false; return { data: null, error: null } }
      return { data: rows.get(key), error: null }
    },
  }
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
  assert.equal(db.rows.size, 2)
})

test('two studies keep separate surrogates for one person', async () => {
  const db = fakeDb()
  assert.notEqual(await surrogateFor(db, 'study-1', 'pid'), await surrogateFor(db, 'study-2', 'pid'))
})

test('a lost race (nothing returned) is retried once and resolves', async () => {
  const db = fakeDb({ emptyOnce: true })
  const s = await surrogateFor(db, 'study-1', 'pid')
  assert.match(s, /^P-/)
  assert.equal(db.calls.length, 2)
})

test('a database error refuses (null) rather than falling back to the raw id', async () => {
  assert.equal(await surrogateFor(fakeDb({ fail: true }), 'study-1', 'pid'), null)
})

test('the platform id goes only in the RPC body', async () => {
  const db = fakeDb()
  await surrogateFor(db, 'study-1', '5f2a9c1b7e4d3a0012345678')
  assert.deepEqual(Object.keys(db.calls[0].args).sort(), ['p_candidate', 'p_external_id', 'p_study_id'])
})
