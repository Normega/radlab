// Headless checks for the frame loop, on a fake frame clock.
// Run: node --test src/games/BcatThreshold/trialLoop.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { presentCircle, plannedBoundaries, provisionalTimeline, knownPrefix } from './trialLoop.js'
import { makeConfig } from './config.js'
import { practiceTrials } from './trialPlan.js'
import { timelineForTrial } from './pacerClock.js'

const cfg = makeConfig()
const [speeding, slowing] = practiceTrials(cfg)
const P = 1000 / 60

// A frame clock: raf() queues a callback, run() fires frames at the given times until the loop stops.
function frameClock({ start = 1000, period = P, gaps = {} } = {}) {
  let t = start, queued = null, n = 0
  const c = {
    now: () => t,
    raf: cb => { queued = cb },
    async run(promise) {
      let done = false, out
      promise.then(v => { done = true; out = v }, e => { done = true; out = e })
      const tick = () => new Promise(r => setImmediate(r))   // lets timers and promise callbacks run between frames
      for (let guard = 0; !done; guard++) {
        if (guard > 100000) throw new Error('frame clock: the loop never ended')
        const cb = queued; queued = null
        if (!cb) { await tick(); continue }
        n += 1
        t += gaps[n] ?? period
        cb(t)
        await tick()
      }
      return out
    },
  }
  return c
}

test('the planned boundaries are fixation onset, each pulse start and the end', () => {
  const tl = timelineForTrial(speeding, cfg)
  assert.deepStrictEqual(plannedBoundaries(tl), [0, 1500, 5500, 9500, 13500, 13500 + 2000, 13500 + 4000])
  assert.equal(knownPrefix(cfg), 3)
  const prov = provisionalTimeline(cfg)
  assert.deepStrictEqual(plannedBoundaries(prov).slice(0, 5), plannedBoundaries(tl).slice(0, 5), 'the provisional schedule matches up to the first changed pulse')
})

test('at 60 Hz every boundary is delivered within half a frame, and nothing is dropped', async () => {
  const clk = frameClock()
  const scales = []
  let started = null, ended = null
  const rec = await clk.run(presentCircle({ cfg, spec: slowing, raf: clk.raf, now: clk.now, framePeriodMs: P,
    render: s => scales.push(s), onStart: t0 => { started = t0 }, onEnd: ts => { ended = ts } }))
  assert.equal(rec.t0, started)
  assert.equal(rec.t0 + rec.t_end, ended)
  assert.deepStrictEqual(rec.planned_boundaries_ms, [0, 1500, 5500, 9500, 13500, 21500, 29500])
  assert.equal(rec.delivered_boundaries_ms.length, 7)
  for (const e of rec.boundary_error_ms) assert.ok(Math.abs(e) <= P / 2 + 1e-9, `error ${e}`)
  assert.equal(rec.dropped_frames, 0)
  assert.ok(Math.abs(rec.max_frame_gap_ms - P) < 1e-6)
  assert.deepStrictEqual(rec.planned_pulses_ms, [4000, 4000, 4000, 8000, 8000])
  rec.delivered_pulses_ms.forEach((d, i) => assert.ok(Math.abs(d - rec.planned_pulses_ms[i]) <= P + 1e-9, `pulse ${i + 1}: ${d}`))
  assert.equal(rec.level_wait_ms, 0)
  assert.equal(scales[0], 0.1, 'fixation: smallest size')
  assert.ok(Math.max(...scales) > 0.299, 'reaches the largest size')
  assert.equal(scales[scales.length - 1], 0.1, 'ends still at the smallest size')
})

test('a late frame is counted and does not shift later boundaries', async () => {
  const clk = frameClock({ gaps: { 200: 250 } })   // one 250 ms stall, about 3.3 s in
  const rec = await clk.run(presentCircle({ cfg, spec: speeding, raf: clk.raf, now: clk.now, framePeriodMs: P, render: () => {} }))
  assert.equal(rec.max_frame_gap_ms, 250)
  assert.equal(rec.dropped_frames, Math.round(250 / P) - 1)
  // the stall falls inside the lead-in; every boundary after it is still on time
  for (const e of rec.boundary_error_ms.slice(2)) assert.ok(Math.abs(e) <= P / 2 + 1e-9, `error ${e}`)
  assert.ok(Math.abs(rec.t_end - 17500) <= P, `ends on time: ${rec.t_end}`)
})

test('a trial can start before its level is known; it arrives during the lead-in', async () => {
  const clk = frameClock()
  let give
  const specPromise = new Promise(r => { give = r })
  setTimeout(() => give(slowing), 0)
  const rec = await clk.run(presentCircle({ cfg, specPromise, raf: clk.raf, now: clk.now, framePeriodMs: P, render: () => {} }))
  assert.equal(rec.spec, slowing)
  assert.equal(rec.level_wait_ms, 0)
  assert.ok(rec.level_ready_ms !== null && rec.level_ready_ms < 1500)
  assert.deepStrictEqual(rec.planned_boundaries_ms, [0, 1500, 5500, 9500, 13500, 21500, 29500])
})

test('a level that comes after the first changed pulse is due holds the circle still, and is recorded', async () => {
  const clk = frameClock()
  let give
  const specPromise = new Promise(r => { give = r })
  const holdFor = 30   // frames
  const scales = []
  let frames = 0, heldSince = null
  const p = presentCircle({ cfg, specPromise, raf: clk.raf, now: clk.now, framePeriodMs: P, render: (s) => {
    scales.push(s); frames += 1
    if (heldSince === null && clk.now() - 1000 >= 13500) heldSince = frames
    if (heldSince !== null && frames === heldSince + holdFor) give(speeding)
  } })
  const rec = await clk.run(p)
  assert.ok(rec.level_wait_ms > (holdFor - 2) * P, `held ${rec.level_wait_ms} ms`)
  const shift = rec.level_wait_ms
  assert.equal(rec.planned_boundaries_ms[4], 13500 + shift, 'the first changed pulse starts after the hold')
  assert.equal(rec.planned_boundaries_ms[6], 17500 + shift)
  for (const e of rec.boundary_error_ms) assert.ok(Math.abs(e) <= P / 2 + 1e-9, `error ${e}`)
})

test('no trial, an engine failure and a cancel each end the loop', async () => {
  let clk = frameClock()
  let r = await clk.run(presentCircle({ cfg, specPromise: Promise.resolve(null), raf: clk.raf, now: clk.now, framePeriodMs: P, render: () => {} }))
  assert.equal(r.no_trial, true)
  clk = frameClock()
  r = await clk.run(presentCircle({ cfg, specPromise: Promise.reject(new Error('boom')), raf: clk.raf, now: clk.now, framePeriodMs: P, render: () => {} }))
  assert.ok(r instanceof Error && /boom/.test(r.message))
  clk = frameClock()
  let n = 0
  r = await clk.run(presentCircle({ cfg, spec: speeding, raf: clk.raf, now: clk.now, framePeriodMs: P, render: () => { n += 1 }, isCancelled: () => n > 10 }))
  assert.equal(r.cancelled, true)
  assert.throws(() => presentCircle({ cfg, raf: () => {}, now: () => 0, render: () => {} }), /spec or specPromise/)
})
