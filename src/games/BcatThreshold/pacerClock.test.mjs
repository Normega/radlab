// Headless checks for the BCAT threshold pacer clock.
// Run: node --test src/games/BcatThreshold/pacerClock.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTimeline, timelineForTrial, halfPulses, circleAt, fillAt } from './pacerClock.js'
import { fillAt as breathFillAt } from '../../components/study/practiceTask/breathTiming.js'
import { makeConfig } from './config.js'
import { practiceTrials } from './trialPlan.js'
import { pulseSchedule } from './engine/adaptive.js'

const cfg = makeConfig()
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol
// a speeding change trial: lead-in, two baseline pulses, two pulses at 2.6 s
const DURS = [4, 4, 4, 2.6, 2.6]
const tl = buildTimeline(DURS, { fixationMs: 1500, nLeadIn: 1, changeIndex: 3, minScale: 0.1, maxScale: 0.3 })

test('pulse boundaries are fixed from one trial start: fixation, lead-in, then the four test pulses', () => {
  assert.deepStrictEqual(tl.pulses.map(p => p.startMs), [1500, 5500, 9500, 13500, 16100])
  assert.equal(tl.totalMs, 18700)
  assert.deepStrictEqual(tl.pulses.map(p => p.leadIn), [true, false, false, false, false])
  assert.deepStrictEqual(tl.pulses.map(p => p.changed), [false, false, false, true, true])
  for (const p of tl.pulses) assert.equal(p.midMs - p.startMs, p.endMs - p.midMs, `pulse ${p.index}: equal halves`)
})

test('the exact boundary instants', () => {
  const at = t => circleAt(tl, t)
  // fixation: still at the smallest size
  for (const t of [-100, 0, 750, 1499.999]) {
    const c = at(t)
    assert.deepStrictEqual([c.segment, c.phase, c.fill, c.scale, c.pulseIndex], ['fixation', 'still', 0, 0.1, null], `t=${t}`)
  }
  // lead-in starts growing from the smallest size
  let c = at(1500)
  assert.deepStrictEqual([c.segment, c.pulseIndex, c.testPulse, c.phase, c.fill, c.tInPulse], ['leadin', 1, null, 'grow', 0, 0])
  // the midpoint is the largest size and the start of the shrink half
  c = at(3500)
  assert.deepStrictEqual([c.pulseIndex, c.phase, c.fill, c.scale, c.tInHalf], [1, 'shrink', 1, 0.3, 0])
  // just before a boundary: still shrinking in the old pulse; at it: growing in the new one
  c = at(5499.999)
  assert.deepStrictEqual([c.pulseIndex, c.phase], [1, 'shrink'])
  assert.ok(c.fill < 1e-6)
  c = at(5500)
  assert.deepStrictEqual([c.segment, c.pulseIndex, c.testPulse, c.phase, c.fill], ['pulse', 2, 1, 'grow', 0])
  // the changed pulses: abrupt switch to 2.6 s at 13500
  c = at(13500)
  assert.deepStrictEqual([c.pulseIndex, c.testPulse, c.changed, c.phase, c.fill], [4, 3, true, 'grow', 0])
  c = at(13500 + 1300)
  assert.deepStrictEqual([c.phase, c.fill], ['shrink', 1])
  // the end of the last pulse is 'done', never the start of a sixth pulse
  c = at(18699.999)
  assert.deepStrictEqual([c.pulseIndex, c.phase], [5, 'shrink'])
  for (const t of [18700, 18700.0001, 25000, 1e9, Infinity]) {
    c = at(t)
    assert.deepStrictEqual([c.segment, c.phase, c.fill, c.scale, c.pulseIndex, c.tInPulse], ['done', 'still', 0, 0.1, null, null], `t=${t}`)
  }
  assert.throws(() => at(NaN))
  assert.throws(() => at('5'))
})

test('sampled every 0.25 ms: no extra pulse, no jump, the circle at its smallest at every boundary', () => {
  let prev = null, maxStep = 0
  const seen = new Set()
  for (let t = 0; t <= tl.totalMs + 3000; t += 0.25) {
    const c = circleAt(tl, t)
    if (c.pulseIndex !== null) seen.add(c.pulseIndex)
    assert.ok(c.fill >= 0 && c.fill <= 1)
    if (t >= tl.totalMs) assert.equal(c.segment, 'done')
    if (prev) maxStep = Math.max(maxStep, Math.abs(c.fill - prev.fill))
    prev = c
  }
  assert.deepStrictEqual([...seen].sort(), [1, 2, 3, 4, 5])
  // the steepest change is pi/2 of the fill per half (1.3 s at the fastest here) per ms: no discontinuity anywhere
  assert.ok(maxStep <= (Math.PI / 2) / 1300 * 0.25 + 1e-9, `max step ${maxStep}`)
  for (const p of tl.pulses) {
    assert.equal(circleAt(tl, p.startMs).fill, 0)
    assert.equal(circleAt(tl, p.midMs).fill, 1)
  }
})

test('symmetric motion: grow and shrink halves mirror each other, with the cosine of breathTiming.js "symmetric"', () => {
  for (let x = 0; x <= 1.0000001; x += 0.01) {
    assert.ok(near(fillAt('grow', x), breathFillAt('in', x, 'symmetric')))
    assert.ok(near(fillAt('shrink', x), breathFillAt('out', x, 'symmetric')))
    assert.ok(near(fillAt('grow', x), fillAt('shrink', 1 - x)))
  }
  for (const p of tl.pulses) {
    const half = p.durationMs / 2
    for (const d of [0, 100, 333, half / 2, half - 1]) {
      assert.ok(near(circleAt(tl, p.startMs + d).fill, circleAt(tl, p.endMs - d).fill), `pulse ${p.index}, ${d} ms from each end`)
    }
  }
  assert.ok(near(circleAt(tl, 1500 + 1000).fill, 0.5), 'a quarter of the way through a pulse is half size')
})

test('half-pulse boundaries: ten halves, contiguous, alternating, from the end of fixation to the end of the trial', () => {
  const h = halfPulses(tl)
  assert.equal(h.length, 10)
  assert.equal(h[0].startMs, 1500)
  assert.equal(h[9].endMs, tl.totalMs)
  h.forEach((x, i) => {
    assert.equal(x.half, i)
    assert.equal(x.phase, i % 2 ? 'shrink' : 'grow')
    assert.equal(x.pulseIndex, (i >> 1) + 1)
    if (i) assert.equal(x.startMs, h[i - 1].endMs)
    assert.equal(x.durationMs, x.endMs - x.startMs)
    // the clock agrees with the plan at each half's start
    assert.equal(circleAt(tl, x.startMs).phase, x.phase)
    assert.equal(circleAt(tl, x.startMs).pulseIndex, x.pulseIndex)
  })
  assert.deepStrictEqual(h.filter(x => x.changed).map(x => x.half), [6, 7, 8, 9])
  assert.deepStrictEqual(h.filter(x => x.leadIn).map(x => x.half), [0, 1])
})

test('the baseline prefix does not move when the changed pulses are filled in', () => {
  // the next trial can start before its level is known: its first three pulses are always at 4 s
  const prefix = buildTimeline([4, 4, 4], { fixationMs: 1500 })
  for (const lr of [-Math.log(2), -0.3, 0, 0.1, Math.log(2)]) {
    const full = buildTimeline(pulseSchedule(cfg.engine.stimulus, lr), { fixationMs: 1500 })
    prefix.pulses.forEach((p, i) => {
      assert.equal(full.pulses[i].startMs, p.startMs)
      assert.equal(full.pulses[i].endMs, p.endMs)
    })
    for (let t = 0; t < prefix.totalMs; t += 7) assert.deepStrictEqual(circleAt(full, t), circleAt(prefix, t), `lr ${lr}, t ${t}`)
  }
})

test('the 2-8 s bounds: the largest changes give 2-s and 8-s pulses', () => {
  const [fast, slow, same] = practiceTrials(cfg)
  const a = timelineForTrial(fast, cfg), b = timelineForTrial(slow, cfg), n = timelineForTrial(same, cfg)
  assert.ok(near(a.pulses[3].durationMs, 2000) && near(a.pulses[4].durationMs, 2000))
  assert.ok(near(b.pulses[3].durationMs, 8000) && near(b.pulses[4].durationMs, 8000))
  assert.deepStrictEqual(n.pulses.map(p => p.durationMs), [4000, 4000, 4000, 4000, 4000])
  assert.deepStrictEqual(n.pulses.map(p => p.changed), [false, false, false, false, false])
  assert.deepStrictEqual(a.pulses.map(p => p.changed), [false, false, false, true, true])
  assert.equal(a.fixationMs, 1500)
  assert.equal(a.minScale, cfg.display.circle_min_size)
  assert.equal(a.maxScale, cfg.display.circle_max_size)
})

test('a configurable fixation, including none', () => {
  const t0 = buildTimeline([4, 4], { fixationMs: 0 })
  assert.equal(circleAt(t0, 0).segment, 'leadin')
  const t3 = buildTimeline([4, 4], { fixationMs: 3000 })
  assert.equal(circleAt(t3, 2999).segment, 'fixation')
  assert.equal(circleAt(t3, 3000).segment, 'leadin')
  assert.equal(t3.totalMs, 11000)
})

test('bad schedules are refused', () => {
  assert.throws(() => buildTimeline([]))
  assert.throws(() => buildTimeline([4, 0]))
  assert.throws(() => buildTimeline([4, -1]))
  assert.throws(() => buildTimeline([4, NaN]))
  assert.throws(() => buildTimeline([4], { fixationMs: -1 }))
})
