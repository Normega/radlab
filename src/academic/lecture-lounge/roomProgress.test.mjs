import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roomProgress, nextPollDelay, PROGRESS_POLL_MIN_MS, PROGRESS_POLL_MAX_MS } from './roomProgress.js'

test('answered from the server count, total from the room', () => {
  const present = [{ user_id: 'me' }, { user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }]
  assert.deepEqual(roomProgress(present, 'me', 2), { answered: 2, total: 4 })
})

test('the viewer is in the room before their own presence arrives', () => {
  assert.deepEqual(roomProgress([{ user_id: 'a' }], 'me', 1), { answered: 1, total: 2 })
  assert.deepEqual(roomProgress([], 'me', 1), { answered: 1, total: 1 })
})

test('the viewer counts as answered before the server count includes them', () => {
  assert.deepEqual(roomProgress([{ user_id: 'me' }, { user_id: 'a' }], 'me', 0), { answered: 1, total: 2 })
})

test('answered never exceeds total: people who answered and left grow the room', () => {
  const present = [{ user_id: 'me' }, { user_id: 'a' }]
  assert.deepEqual(roomProgress(present, 'me', 5), { answered: 5, total: 5 })
})

test('an unloaded count stays null', () => {
  assert.deepEqual(roomProgress([{ user_id: 'a' }], 'me', null), { answered: null, total: 2 })
  assert.deepEqual(roomProgress([], 'me', undefined), { answered: null, total: 1 })
})

test('polling eases off while the count sits still and snaps back on a change', () => {
  let d = PROGRESS_POLL_MIN_MS
  for (let i = 0; i < 10; i++) d = nextPollDelay(d, false)
  assert.equal(d, PROGRESS_POLL_MAX_MS)
  assert.equal(nextPollDelay(d, true), PROGRESS_POLL_MIN_MS)
  assert.equal(nextPollDelay(PROGRESS_POLL_MIN_MS, false), 6000)
})
