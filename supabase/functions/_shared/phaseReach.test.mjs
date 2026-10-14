// phaseOutOfReach: when a missed-session email may no longer say "nothing to
// make up". Every uncertain case must return null (keep the ordinary copy);
// only a rule that is enforced, fully scheduled and arithmetically lost may
// change the wording.
//
// Run: node --experimental-strip-types supabase/functions/_shared/phaseReach.test.mjs
import assert from 'node:assert'
import { test } from 'node:test'
import { phaseOutOfReach, formatPhaseEnd } from './phaseReach.ts'

const P1 = { min_required: 10, of_total: 12, on_fail: 'withdraw' }

// Twelve phase days from 2026-10-02; the first `missed` are missed, the next
// `done` completed, the rest still pending.
function rows(missed, done = 0, total = 12) {
  return Array.from({ length: total }, (_, i) => ({
    status: i < missed ? 'missed' : i < missed + done ? 'completed' : 'pending',
    scheduled_date: `2026-10-${String(2 + i).padStart(2, '0')}`,
  }))
}

test('two misses: 10 of 12 is still reachable -- ordinary copy', () => {
  assert.equal(phaseOutOfReach({ check: P1, completed: 0, phaseRows: rows(2) }), null)
})

test('three misses with nothing completed: out of reach, ends on the last phase day', () => {
  assert.deepEqual(
    phaseOutOfReach({ check: P1, completed: 0, phaseRows: rows(3) }),
    { minRequired: 10, ofTotal: 12, endDate: '2026-10-13', assessFirst: false },
  )
})

test("assess_then_withdraw: still out of reach, and flagged so the copy promises the midpoint", () => {
  const check = { ...P1, on_fail: 'assess_then_withdraw' }
  assert.equal(phaseOutOfReach({ check, completed: 0, phaseRows: rows(3) })?.assessFirst, true)
})

test("Liliana's test enrollment, 2026-10-13: 11 missed, 1 left -- out of reach", () => {
  const r = rows(11)
  r[11].status = 'link_sent'
  assert.ok(phaseOutOfReach({ check: P1, completed: 0, phaseRows: r }))
})

test('the count is the enforcement count, not the schedule status', () => {
  // Schedule says 2 completed + 7 pending = 9 at most, but the counter the gate
  // uses already has 3 (e.g. a completion the schedule row lags): 3 + 7 = 10.
  const r = rows(3, 2)
  assert.equal(phaseOutOfReach({ check: P1, completed: 3, phaseRows: r }), null)
})

test("a 'continue' check never changes the copy -- falling short ends nothing", () => {
  const check = { ...P1, on_fail: 'continue' }
  assert.equal(phaseOutOfReach({ check, completed: 0, phaseRows: rows(11) }), null)
})

test('on_fail unset means withdraw, the materializer default', () => {
  const check = { min_required: 10, of_total: 12 }
  assert.ok(phaseOutOfReach({ check, completed: 0, phaseRows: rows(5) }))
})

test('phase not fully scheduled yet: unknowable -- ordinary copy', () => {
  assert.equal(phaseOutOfReach({ check: P1, completed: 0, phaseRows: rows(5, 0, 8) }), null)
})

test('no adherence check for this phase: ordinary copy', () => {
  assert.equal(phaseOutOfReach({ check: null, completed: 0, phaseRows: rows(11) }), null)
})

test('blocked and skipped rows cannot be completed and do not count as open', () => {
  const r = rows(1)
  r[1].status = 'blocked'
  r[2].status = 'skipped'
  // 9 pending left: 0 + 9 < 10
  assert.ok(phaseOutOfReach({ check: P1, completed: 0, phaseRows: r }))
})

test('end date reads as a weekday and date', () => {
  assert.equal(formatPhaseEnd('2026-10-23'), 'Friday, October 23')
})
