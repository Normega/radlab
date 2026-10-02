// withRateLimitRetry must wait out a RateLimitError while the run's budget
// allows, and hand the error back (row left for the next tick) when it doesn't.
// Written after check_schedule's sends to send_message were capped at ~30 per
// tick, making 43 of 73 Zerin links 15-30 minutes late (2026-10-01).
//
// Run: node --experimental-strip-types --test supabase/functions/_shared/rateLimitRetry.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withRateLimitRetry, isRateLimitError } from './rateLimitRetry.ts'

function rateLimitError(retryAfterMs) {
  const e = new Error('Rate limit exceeded for trace x')
  e.name = 'RateLimitError'
  e.retryAfterMs = retryAfterMs
  return e
}

/** A fake clock whose sleep advances time instead of waiting. */
function fakeClock(start = 0) {
  let t = start
  const sleeps = []
  return {
    now: () => t,
    sleep: async (ms) => { sleeps.push(ms); t += ms },
    sleeps,
  }
}

test('succeeds first time without sleeping', async () => {
  const c = fakeClock()
  const out = await withRateLimitRetry(async () => 'ok', { deadline: 100_000, ...c })
  assert.equal(out, 'ok')
  assert.deepEqual(c.sleeps, [])
})

test('waits the time the platform asks, then retries and succeeds', async () => {
  const c = fakeClock()
  let calls = 0
  const out = await withRateLimitRetry(async () => {
    calls++
    if (calls === 1) throw rateLimitError(30_000)
    return 'sent'
  }, { deadline: 100_000, ...c })
  assert.equal(out, 'sent')
  assert.equal(calls, 2)
  assert.equal(c.sleeps.length, 1)
  assert.ok(c.sleeps[0] >= 30_000, 'never retries before the window the platform named')
})

test('retries more than once while the budget lasts', async () => {
  const c = fakeClock()
  let calls = 0
  await withRateLimitRetry(async () => {
    if (++calls < 3) throw rateLimitError(20_000)
    return 'sent'
  }, { deadline: 100_000, ...c })
  assert.equal(calls, 3)
})

test('gives the RateLimitError back when waiting would pass the deadline', async () => {
  const c = fakeClock(90_000)
  let calls = 0
  await assert.rejects(
    withRateLimitRetry(async () => { calls++; throw rateLimitError(30_000) }, { deadline: 110_000, ...c }),
    (e) => isRateLimitError(e),
  )
  assert.equal(calls, 1, 'no retry it cannot afford')
  assert.deepEqual(c.sleeps, [], 'no sleep past the deadline')
})

test('a missing retryAfterMs falls back to a full wait, not an instant retry', async () => {
  const c = fakeClock()
  let calls = 0
  await withRateLimitRetry(async () => {
    if (++calls === 1) throw rateLimitError(undefined)
    return 'sent'
  }, { deadline: 100_000, ...c })
  assert.ok(c.sleeps[0] >= 30_000)
})

test('any other error is rethrown at once, untouched', async () => {
  const c = fakeClock()
  const boom = new TypeError('network down')
  await assert.rejects(
    withRateLimitRetry(async () => { throw boom }, { deadline: 100_000, ...c }),
    (e) => e === boom,
  )
  assert.deepEqual(c.sleeps, [])
})
