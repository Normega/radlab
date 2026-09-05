// Headless checks for the Free Breathing segment parser.
// Run: npm test   (or: node --test src/games/FreeBreath/breathShapes.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert'
import { parseBreaths, meanBreath, maxDuration, normalizeSegments } from './breathShapes.js'

// Build a contiguous segment log from [phase, durationMs] pairs.
function log(...pairs) {
  let t = 1000
  return pairs.map(([phase, dur]) => {
    const s = { phase, t0: t, t1: t + dur }
    t += dur
    return s
  })
}

function close(a, b, msg) {
  assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} !== ${b}`)
}

test('one clean breath parses into its four durations', () => {
  const breaths = parseBreaths(log(['in', 2000], ['pause', 500], ['out', 3000], ['pause', 1000]))
  assert.equal(breaths.length, 1)
  close(breaths[0].inh, 2.0, 'inh')
  close(breaths[0].hold, 0.5, 'hold')
  close(breaths[0].exh, 3.0, 'exh')
  close(breaths[0].rest, 1.0, 'rest')
})

test('a breath closes when the next inhale begins', () => {
  const breaths = parseBreaths(log(
    ['in', 2000], ['out', 2000], ['pause', 800],
    ['in', 1500], ['out', 2500],
  ))
  assert.equal(breaths.length, 2)
  close(breaths[0].rest, 0.8, 'first rest')
  close(breaths[1].inh, 1.5, 'second inh')
})

test('an accidental raise mid-inhale merges into the inhale, not the hold', () => {
  const breaths = parseBreaths(log(
    ['in', 1000], ['pause', 150], ['in', 800],
    ['out', 2000],
  ))
  assert.equal(breaths.length, 1)
  close(breaths[0].inh, 1.95, 'inh includes the slip gap')
  close(breaths[0].hold, 0, 'hold empty')
})

test('a real pause between two inhale holds still counts as hold', () => {
  const breaths = parseBreaths(log(
    ['in', 1000], ['pause', 500], ['in', 800],
    ['out', 2000],
  ))
  assert.equal(breaths.length, 1)
  close(breaths[0].inh, 1.8, 'inh')
  close(breaths[0].hold, 0.5, 'hold keeps the real pause')
})

test('rapid in/out flicker mints no breaths', () => {
  const breaths = parseBreaths(log(
    ['in', 150], ['out', 140], ['in', 120], ['out', 130], ['pause', 400],
  ))
  assert.equal(breaths.length, 0)
})

test('rapid same-key tapping still adds up to one hold', () => {
  const breaths = parseBreaths(log(
    ['in', 100], ['pause', 80], ['in', 120], ['pause', 90], ['in', 110],
    ['out', 2000],
  ))
  assert.equal(breaths.length, 1)
  close(breaths[0].inh, 0.5, 'taps and gaps fuse into the inhale')
})

test('a sub-300ms opposite-phase blip mid-exhale is absorbed into the exhale', () => {
  const breaths = parseBreaths(log(
    ['in', 2000],
    ['out', 1500], ['in', 100], ['out', 1200],
    ['pause', 400],
  ))
  assert.equal(breaths.length, 1)
  close(breaths[0].exh, 2.8, 'exh spans the blip')
  close(breaths[0].rest, 0.4, 'rest')
})

test('a leading blip does not start a breath', () => {
  const breaths = parseBreaths(log(
    ['in', 100], ['pause', 500],
    ['in', 2000], ['out', 1000],
  ))
  assert.equal(breaths.length, 1)
  close(breaths[0].inh, 2.0, 'inh is the real inhale only')
  close(breaths[0].hold, 0, 'hold')
})

test('an inhale never followed by an exhale is dropped', () => {
  const breaths = parseBreaths(log(['in', 2000], ['pause', 3000]))
  assert.equal(breaths.length, 0)
})

test('normalizeSegments leaves distinct genuine phases alone', () => {
  const segs = normalizeSegments(log(['in', 2000], ['pause', 500], ['out', 3000]))
  assert.deepEqual(segs.map(s => s.phase), ['in', 'pause', 'out'])
})

test('meanBreath and maxDuration', () => {
  const breaths = [
    { inh: 2, hold: 1, exh: 4, rest: 1 },
    { inh: 4, hold: 0, exh: 6, rest: 3 },
  ]
  const m = meanBreath(breaths)
  close(m.inh, 3, 'mean inh')
  close(m.exh, 5, 'mean exh')
  close(maxDuration(breaths), 6, 'max')
  close(meanBreath([]).inh, 0, 'empty mean')
})
