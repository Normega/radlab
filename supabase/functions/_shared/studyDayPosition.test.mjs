// The number a participant is told they are on. Run against Liliana Study 3's
// real compiled day map and a real counterbalance draw, because the whole point
// of counting the participant's own rows is that it must agree with the order
// materializeSchedule actually handed them — not with the protocol's.
//
// Run: node supabase/functions/_shared/studyDayPosition.test.mjs
// On Node < 22.18 (type stripping not yet on by default), add the flag:
//   node --experimental-strip-types supabase/functions/_shared/studyDayPosition.test.mjs
import assert from 'node:assert'
import { test } from 'node:test'
import { scheduleRank, studyDayPosition } from './studyDayPosition.ts'

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Liliana Study 3's compiled day_numbers, exactly as they sit in study_sessions:
 * baseline 1, Phase 1's three counterbalanced blocks 2-13, midpoint 14, then
 * Phase 2 17-28 three times over (one per randomize arm) and final 29.
 * 27 distinct values — note the gap at 15-16 and the treble at 17-28, which is
 * why the denominator counts distinct values rather than rows.
 */
function lilianaDayNumbers() {
  const days = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  for (const d of [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]) days.push(d, d, d)
  days.push(29)
  return days
}

/** A participant's Phase 1 schedule: baseline, then blocks in the drawn order. */
function phase1Schedule(blockOrder) {
  const blocks = { nr: [2, 3, 4, 5], ra: [6, 7, 8, 9], sc: [10, 11, 12, 13] }
  const dayNumbers = [1, ...blockOrder.flatMap(b => blocks[b])]
  return dayNumbers.map((dayNumber, i) => ({
    id: `row-${i}`,
    scheduled_date: `2026-08-${String(23 + i).padStart(2, '0')}`,
    send_time: '06:00:00',
    dayNumber,
  }))
}

/** What the emails for a whole schedule would say, in the order they go out. */
function renderedSequence(rows, studyDayNumbers = lilianaDayNumbers()) {
  return rows.map(r => studyDayPosition({
    studyDayNumbers,
    position: scheduleRank(rows, r.id),
    sessionDayNumber: r.dayNumber,
  }))
}

// ─── The regression this module exists for ───────────────────────────────────

test('a counterbalanced draw is numbered by the participant\'s own order', () => {
  // Saba's actual draw (2026-08-23): self-compassion, reappraisal, then
  // non-reactivity. Under the day_number rank her first email read "Day 10 of
  // 27" and the number later ran backwards to 2.
  const rows = phase1Schedule(['sc', 'ra', 'nr'])
  const seq = renderedSequence(rows)

  assert.deepStrictEqual(seq.map(s => s.ordinal), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  assert.deepStrictEqual(seq.map(s => s.total), Array(13).fill(27))
})

test('every counterbalance draw yields the same sequence', () => {
  const orders = [
    ['nr', 'ra', 'sc'], ['nr', 'sc', 'ra'], ['ra', 'nr', 'sc'],
    ['ra', 'sc', 'nr'], ['sc', 'nr', 'ra'], ['sc', 'ra', 'nr'],
  ]
  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  for (const order of orders) {
    const seq = renderedSequence(phase1Schedule(order))
    assert.deepStrictEqual(seq.map(s => s.ordinal), expected, `draw ${order.join('-')}`)
  }
})

test('canonical order is unchanged from the old day_number rank', () => {
  // The participants who looked correct must keep looking correct: in canonical
  // order, position and day_number rank agree at every row.
  const rows = phase1Schedule(['nr', 'ra', 'sc'])
  for (const r of rows) {
    const days = [...new Set(lilianaDayNumbers())].sort((a, b) => a - b)
    const oldRank = days.indexOf(r.dayNumber) + 1
    assert.strictEqual(scheduleRank(rows, r.id), oldRank)
  }
})

test('the number never runs backwards or repeats', () => {
  const seq = renderedSequence(phase1Schedule(['sc', 'nr', 'ra'])).map(s => s.ordinal)
  for (let i = 1; i < seq.length; i++) {
    assert.strictEqual(seq[i], seq[i - 1] + 1, `position ${i} follows ${i - 1}`)
  }
})

// ─── Ordering ────────────────────────────────────────────────────────────────

test('rank follows date then send time, not the order rows arrive', () => {
  const rows = [
    { id: 'c', scheduled_date: '2026-08-24', send_time: '06:00:00' },
    { id: 'a', scheduled_date: '2026-08-23', send_time: '06:00:00' },
    { id: 'b', scheduled_date: '2026-08-23', send_time: '20:00:00' },
  ]
  assert.strictEqual(scheduleRank(rows, 'a'), 1)
  assert.strictEqual(scheduleRank(rows, 'b'), 2)
  assert.strictEqual(scheduleRank(rows, 'c'), 3)
})

test('ties break on id, so the answer is stable across queries', () => {
  const rows = [
    { id: 'zzz', scheduled_date: '2026-08-23', send_time: null },
    { id: 'aaa', scheduled_date: '2026-08-23', send_time: null },
  ]
  assert.strictEqual(scheduleRank(rows, 'aaa'), 1)
  assert.strictEqual(scheduleRank([...rows].reverse(), 'aaa'), 1)
})

test('a missed row keeps its slot, so later sessions are not renumbered', () => {
  // Rows stay in participant_schedule with status 'missed'; the participant was
  // handed that session, and the emails after it must not shift down by one.
  const rows = phase1Schedule(['nr', 'ra', 'sc'])
  assert.strictEqual(scheduleRank(rows, 'row-5'), 6)
})

test('an unknown row id yields no position', () => {
  assert.strictEqual(scheduleRank(phase1Schedule(['nr', 'ra', 'sc']), 'nope'), null)
})

// ─── Degradation ─────────────────────────────────────────────────────────────

test('no compiled day map: position stands, no total claimed', () => {
  const got = studyDayPosition({ studyDayNumbers: [], position: 1, sessionDayNumber: null })
  assert.deepStrictEqual(got, { ordinal: 1, total: null })
})

test('unreadable schedule falls back to the canonical rank', () => {
  const got = studyDayPosition({
    studyDayNumbers: lilianaDayNumbers(),
    position: null,
    sessionDayNumber: 10,
  })
  assert.deepStrictEqual(got, { ordinal: 10, total: 27 })
})

test('unreadable schedule and an uncompiled session yields no number', () => {
  const got = studyDayPosition({
    studyDayNumbers: lilianaDayNumbers(),
    position: null,
    sessionDayNumber: null,
  })
  assert.deepStrictEqual(got, { ordinal: null, total: null })
})

test('a position past the day map drops the "of M" rather than lying', () => {
  const got = studyDayPosition({
    studyDayNumbers: lilianaDayNumbers(),
    position: 30,
    sessionDayNumber: 29,
  })
  assert.deepStrictEqual(got, { ordinal: 30, total: null })
})

test('the last session is N of N, not N of N+something', () => {
  const got = studyDayPosition({
    studyDayNumbers: lilianaDayNumbers(),
    position: 27,
    sessionDayNumber: 29,
  })
  assert.deepStrictEqual(got, { ordinal: 27, total: 27 })
})
