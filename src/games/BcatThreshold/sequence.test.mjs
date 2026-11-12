// Headless checks for the interruption rule (flag, withhold, repeat once).
// Run: node --test src/games/BcatThreshold/sequence.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INTERRUPTION_POLICY, wasInterrupted, createTrialSequence } from './sequence.js'

const spec = i => ({ trial_index: i, cell: 'speeding', placement: 'infogain', magnitude: 0.2 })

test('the default policy is flag, withhold from the engine, and repeat once', () => {
  assert.deepStrictEqual({ ...INTERRUPTION_POLICY }, { repeatOnce: true, withholdFromEngine: true })
  assert.ok(Object.isFrozen(INTERRUPTION_POLICY))
})

test('an uninterrupted trial goes to the engine as answered and is not repeated', () => {
  const s = createTrialSequence()
  assert.deepStrictEqual(s.mainAnswered({ spec: spec(1), response: 'same', interrupted: false }),
    { engineResponse: 'same', withheld: false, repeatQueued: false })
  assert.equal(s.takeRepeat(), null)
})

test('an interrupted trial is withheld (null) and queued once; the repeat is never queued again', () => {
  const s = createTrialSequence()
  const d = s.mainAnswered({ spec: spec(4), response: 'sped_up', interrupted: true })
  assert.deepStrictEqual(d, { engineResponse: null, withheld: true, repeatQueued: true })
  // the same engine trial cannot be queued twice
  assert.equal(s.mainAnswered({ spec: spec(4), response: 'same', interrupted: true }).repeatQueued, false)
  s.mainAnswered({ spec: spec(7), response: 'slowed', interrupted: true })
  assert.equal(s.pendingRepeats, 2)
  const r1 = s.takeRepeat(), r2 = s.takeRepeat()
  assert.deepStrictEqual([r1.repeatOf, r2.repeatOf], [4, 7], 'repeats come back in the order they were interrupted')
  assert.equal(r1.spec.trial_index, 4)
  assert.equal(s.takeRepeat(), null)
  assert.equal(s.pendingRepeats, 0)
})

test('an unanswered interrupted trial is not counted as withheld', () => {
  const s = createTrialSequence()
  assert.deepStrictEqual(s.mainAnswered({ spec: spec(2), response: null, interrupted: true }),
    { engineResponse: null, withheld: false, repeatQueued: true })
})

test('each switch works on its own', () => {
  const flagOnly = createTrialSequence({ repeatOnce: false, withholdFromEngine: false })
  assert.deepStrictEqual(flagOnly.mainAnswered({ spec: spec(1), response: 'slowed', interrupted: true }),
    { engineResponse: 'slowed', withheld: false, repeatQueued: false })
  const repeatButSend = createTrialSequence({ repeatOnce: true, withholdFromEngine: false })
  assert.deepStrictEqual(repeatButSend.mainAnswered({ spec: spec(1), response: 'slowed', interrupted: true }),
    { engineResponse: 'slowed', withheld: false, repeatQueued: true })
  const withholdOnly = createTrialSequence({ repeatOnce: false })
  assert.deepStrictEqual(withholdOnly.mainAnswered({ spec: spec(1), response: 'slowed', interrupted: true }),
    { engineResponse: null, withheld: true, repeatQueued: false })
})

test('seq numbers everything shown, in order', () => {
  const s = createTrialSequence()
  assert.deepStrictEqual([s.nextSeq(), s.nextSeq(), s.nextSeq()], [1, 2, 3])
  assert.equal(s.seq, 3)
})

test('mainAnswered refuses a missing response or spec', () => {
  const s = createTrialSequence()
  assert.throws(() => s.mainAnswered({ spec: spec(1), interrupted: false }), /response is required/)
  assert.throws(() => s.mainAnswered({ spec: {}, response: 'same', interrupted: false }), /trial_index/)
})

test('wasInterrupted: a blur or hide during the circle counts; before, after, or a focus alone does not', () => {
  const span = { startMs: 0, endMs: 18700 }
  assert.equal(wasInterrupted([], span), false)
  assert.equal(wasInterrupted([{ type: 'blur', t: 5000 }, { type: 'focus', t: 6000 }], span), true)
  assert.equal(wasInterrupted([{ type: 'hidden', t: 0 }], span), true)
  assert.equal(wasInterrupted([{ type: 'hidden', t: 18700 }], span), true, 'the last frame is still the circle')
  assert.equal(wasInterrupted([{ type: 'blur', t: 18701 }], span), false, 'leaving at the question is allowed')
  assert.equal(wasInterrupted([{ type: 'blur', t: -3 }], span), false)
  assert.equal(wasInterrupted([{ type: 'focus', t: 100 }, { type: 'visible', t: 200 }], span), false)
  assert.equal(wasInterrupted([], { ...span, hiddenAtStart: true }), true)
  assert.throws(() => wasInterrupted([], {}), /endMs/)
})
