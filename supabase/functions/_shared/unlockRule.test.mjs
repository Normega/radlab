// The rule that decides whether a freshly-created schedule row can be handed
// to a participant standing in the browser.
//
// Written after 2026-09-12, when a Zerin participant re-opened their SONA link
// ten minutes after finishing baseline: materializeSchedule created the 63
// daily rows in that request and unlocked the first of them -- the NEXT
// morning's check-in -- with a 4 h link that expired overnight. The scheduler
// only emails 'pending' rows, so the row was never sent and the timepoint was
// lost without any error anywhere.
//
// Run: node --experimental-strip-types --test supabase/functions/_shared/unlockRule.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canUnlockNow } from './materializeSchedule.ts'

const TODAY = '2026-09-12'

test('enrollment: the entry row is dated today, so it unlocks', () => {
  assert.equal(canUnlockNow(true, { status: 'pending', scheduledDate: TODAY }, TODAY), true)
})

test('re-entry: the next session belongs to a later day, so it does not', () => {
  assert.equal(canUnlockNow(true, { status: 'pending', scheduledDate: '2026-09-13' }, TODAY), false)
})

test('a row already due but not yet sent still unlocks', () => {
  assert.equal(canUnlockNow(true, { status: 'pending', scheduledDate: '2026-09-11' }, TODAY), true)
})

test('without unlockFirst nothing is ever unlocked (cron and admin paths)', () => {
  assert.equal(canUnlockNow(false, { status: 'pending', scheduledDate: TODAY }, TODAY), false)
})

test('a row waiting on a date it has not been given is never unlocked', () => {
  assert.equal(canUnlockNow(true, { status: 'awaiting_date', scheduledDate: TODAY }, TODAY), false)
})

test('no rows inserted means nothing to unlock', () => {
  assert.equal(canUnlockNow(true, undefined, TODAY), false)
})
