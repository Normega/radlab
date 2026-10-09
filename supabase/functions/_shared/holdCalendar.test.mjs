// Run: node supabase/functions/_shared/holdCalendar.test.mjs
// (On Node < 22.18 add --experimental-strip-types.)
import assert from 'node:assert'
import { test } from 'node:test'
import { holdCalendar } from './holdCalendar.ts'
import { renderEmail } from './emailTemplate.ts'

const FIXED = { nodes: [
  { type: 'timepoint', day_offset: 0 },
  { type: 'timepoint', timing: 'fixed', fixed_date: '2026-11-14' },
  { type: 'timepoint', timing: 'fixed', fixed_date: '2026-10-17' },
] }

test('no fixed date: null, so other studies keep their copy', () => {
  assert.equal(holdCalendar({ nodes: [{ type: 'timepoint', day_offset: 0 }] }, '2026-10-20'), null)
  assert.equal(holdCalendar(null, '2026-10-20'), null)
})

test('the earliest fixed date is day 1, named in words', () => {
  assert.deepEqual(holdCalendar(FIXED, '2026-10-14'), { starts: 'Saturday, October 17', days_passed: 0 })
})

test('days passed counts the days before today, never negative', () => {
  assert.equal(holdCalendar(FIXED, '2026-10-17').days_passed, 0)   // day 1 itself is still to come today
  assert.equal(holdCalendar(FIXED, '2026-10-18').days_passed, 1)
  assert.equal(holdCalendar(FIXED, '2026-10-23').days_passed, 6)
})

const BASE = {
  first_name: 'Ada', study_day: 1, link_url: 'https://radlab.zone/s/t', expires_hours: 24,
  custom_subject: null, custom_body: null, unsubscribe_url: null, baseline_hold: 'repeat',
}

test('a fixed calendar, before day 1: says when it starts, not "the day after you complete it"', () => {
  const { text } = renderEmail({ ...BASE, hold_calendar: { starts: 'Saturday, October 17', days_passed: 0 } })
  assert.match(text, /starts on Saturday, October 17 for everyone/)
  assert.doesNotMatch(text, /day after you complete it/)
})

test('a fixed calendar, after day 1: says how many days have been missed', () => {
  assert.match(renderEmail({ ...BASE, hold_calendar: { starts: 'Saturday, October 17', days_passed: 3 } }).text, /you've missed 3 days so far/)
  assert.match(renderEmail({ ...BASE, hold_calendar: { starts: 'Saturday, October 17', days_passed: 1 } }).text, /you've missed 1 day so far/)
})

test('no calendar: the original repeat copy, unchanged', () => {
  assert.match(renderEmail(BASE).text, /begins the day after you complete it/)
})
