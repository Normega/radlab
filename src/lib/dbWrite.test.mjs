// Run directly:  node src/lib/dbWrite.test.mjs
//
// Covers the three outcomes dbWrite exists to distinguish, plus the retry rule.
// The zero-rows case is the one worth pinning: it is NOT an error, which is
// exactly why it went unnoticed in the ripples settings bug.

import { dbWrite, onWriteFailure } from './dbWrite.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

// A stand-in for a supabase query builder: thenable, and counts awaits so the
// retry behaviour is observable.
function fakeQuery(results) {
  const seq = Array.isArray(results) ? [...results] : [results]
  const q = {
    awaits: 0,
    then(resolve, reject) {
      q.awaits++
      const next = seq.length > 1 ? seq.shift() : seq[0]
      return Promise.resolve(next).then(resolve, reject)
    },
  }
  return q
}

const quiet = { error: console.error, warn: console.warn }
console.error = () => {}
console.warn = () => {}

// 1. Success
{
  const r = await dbWrite(fakeQuery({ data: [{ id: 'x' }], error: null }), 'ok.case')
  check('success → ok', r.ok === true)
  check('success → no reason', r.reason === null)
}

// 2. Hard error, non-transient: no retry
{
  const q = fakeQuery({ data: null, error: { message: 'permission denied', code: '42501' } })
  const r = await dbWrite(q, 'rls.case')
  check('error → not ok', r.ok === false)
  check('error → reason=error', r.reason === 'error')
  check('non-transient is not retried', q.awaits === 1)
}

// 3. Zero rows affected, no error — the silent no-op
{
  const r = await dbWrite(fakeQuery({ data: [], error: null }), 'norows.case', { expectRows: true })
  check('zero rows → not ok', r.ok === false)
  check('zero rows → reason=no_rows', r.reason === 'no_rows')
  check('zero rows → error stays null', r.error === null)
}

// 3b. Same response, but caller did not ask for row checking
{
  const r = await dbWrite(fakeQuery({ data: [], error: null }), 'norows.unchecked')
  check('zero rows without expectRows → ok (opt-in)', r.ok === true)
}

// 4. Transient error retried, then succeeds
{
  const q = fakeQuery([
    { data: null, error: { message: 'Failed to fetch' } },
    { data: [{ id: 'x' }], error: null },
  ])
  const r = await dbWrite(q, 'transient.case')
  check('transient retried → ok', r.ok === true)
  check('transient retried exactly once', q.awaits === 2)
}

// 5. Listener fires for both failure kinds, not for success
{
  const seen = []
  const off = onWriteFailure(f => seen.push(f.reason))
  await dbWrite(fakeQuery({ data: [{ id: 1 }], error: null }), 'listener.ok')
  await dbWrite(fakeQuery({ data: null, error: { message: 'boom', code: '23505' } }), 'listener.err')
  await dbWrite(fakeQuery({ data: [], error: null }), 'listener.norows', { expectRows: true })
  off()
  await dbWrite(fakeQuery({ data: null, error: { message: 'boom' } }), 'listener.after-off')
  check('listener saw exactly the two failures', seen.join(',') === 'error,no_rows')
}

console.error = quiet.error
console.warn = quiet.warn
console.log(`dbWrite: ${pass}/${pass + fail} checks passed`)
process.exit(fail === 0 ? 0 : 1)
