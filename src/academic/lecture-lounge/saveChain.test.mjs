// Saves of one test question must reach the server in the order they were made,
// and the last one sent must carry the final answer.
//
// Run: node --test src/academic/lecture-lounge/saveChain.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSaveChain } from './saveChain.js'

const tick = (ms) => new Promise((r) => setTimeout(r, ms))

test('a slow first save cannot land after a fast second one', async () => {
  const chain = createSaveChain()
  const server = []                      // commit order, as the server would see it
  const latest = { q1: 'B' }
  const send = (delay) => async () => {
    const value = latest.q1              // read at send time, like ClassTest
    await tick(delay)
    server.push(value)
    return true
  }
  const first = chain.run('q1', send(40))   // B goes out, slowly
  await tick(5)                              // the student taps C while B is in flight
  latest.q1 = 'C'
  const second = chain.run('q1', send(1))   // C would be fast, but waits
  await Promise.all([first, second])
  assert.deepEqual(server, ['B', 'C'], 'C commits last, so C is what is graded')
})

test('different questions do not wait for each other', async () => {
  const chain = createSaveChain()
  const order = []
  const slow = chain.run('q1', async () => { await tick(30); order.push('q1') })
  const fast = chain.run('q2', async () => { await tick(1); order.push('q2') })
  await Promise.all([slow, fast])
  assert.deepEqual(order, ['q2', 'q1'])
})

test('a failed save does not block the next one, and its result is reported', async () => {
  const chain = createSaveChain()
  const a = chain.run('q1', async () => false)
  const b = chain.run('q1', async () => { throw new Error('network') })
  const c = chain.run('q1', async () => true)
  assert.equal(await a, false)
  await assert.rejects(b)
  assert.equal(await c, true)
})

test('the chain cleans up after itself', async () => {
  const chain = createSaveChain()
  await chain.run('q1', async () => true)
  await tick(0)
  assert.equal(chain.size, 0)
})
