// Headless checks for the BCAT-DDM pre-run.
// Run: node --test src/games/BcatDdm/prerun.test.mjs
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { DEFAULTS, mulberry32, pacerAt } from './schedule.js'
import { PRERUN_DEFAULTS, createPrerun, createQuest } from './prerun.js'

// The prototype imports a published copy, which must stay byte-identical (as schedule.js).
test('public/prototypes/bcat-ddm/prerun.js is an exact copy of this module', () => {
  const src = readFileSync(new URL('./prerun.js', import.meta.url), 'utf8')
  const pub = readFileSync(new URL('../../../public/prototypes/bcat-ddm/prerun.js', import.meta.url), 'utf8')
  assert.equal(pub, src, 'run: cp src/games/BcatDdm/prerun.js public/prototypes/bcat-ddm/prerun.js')
})

// A simulated participant who obeys the grid's own model: noticing a change of size m in
// direction d with probability logistic((ln m − ln mu_d) / slope), pressing 1–3 breaths in;
// false alarms at faPerMin. Drives the pre-run in 100 ms ticks, as the page's clock does.
function run({ muFast, muSlow, faPerMin = 0.3, seed = 1, ...opts }) {
  const pr = createPrerun({ seed, ...opts })
  const r = mulberry32(seed * 7919 + 13)
  const planned = []
  let seen = 0
  let ms = 0
  while (!pr.done && ms < 60 * 60_000) {
    pr.advanceTo(ms)
    const ev = pr.schedule.events
    for (; seen < ev.length; seen++) {
      const e = ev[seen]
      const mu = e.dir > 0 ? muSlow : muFast
      const F = 1 / (1 + Math.exp(-(Math.log(e.mag) - Math.log(mu)) / PRERUN_DEFAULTS.slope))
      if (r() < F) planned.push(e.onsetMs + (1 + 2 * r()) * e.toPeriodMs)
    }
    if (r() < (faPerMin / 60) * 0.1) planned.push(ms)
    for (let i = planned.length - 1; i >= 0; i--) if (planned[i] <= ms) { pr.press(planned[i]); planned.splice(i, 1) }
    ms += 100
  }
  return pr
}

test('the stream is contiguous, in bounds, and every change opens a 5-breath window', () => {
  const pr = run({ muFast: 0.15, muSlow: 0.3 })
  const { breaths, events } = pr.schedule
  const lo = DEFAULTS.basePeriodMs * DEFAULTS.minRatio
  const hi = DEFAULTS.basePeriodMs * DEFAULTS.maxRatio
  for (let i = 1; i < breaths.length; i++) {
    assert.equal(breaths[i].startMs, breaths[i - 1].startMs + breaths[i - 1].periodMs)
    assert.ok(breaths[i].periodMs >= lo - 1 && breaths[i].periodMs <= hi + 1)
  }
  assert.equal(events.length, PRERUN_DEFAULTS.nChanges)
  assert.deepEqual(breaths.slice(0, 4).map(b => b.tag), ['lead', 'lead', 'lead', 'lead'])
  for (const e of events) {
    const w = breaths.slice(e.onsetBreath, e.onsetBreath + 5)
    assert.equal(breaths[e.onsetBreath].startMs, e.onsetMs)
    assert.ok(w.every(b => b.tag === 'window' && b.periodMs === e.toPeriodMs))
    assert.equal(e.windowEndMs, w[4].startMs + w[4].periodMs)
    assert.ok(Math.abs(e.toPeriodMs - e.fromPeriodMs * (1 + e.dir * e.mag)) <= 1)
    assert.ok(e.hit === true || e.hit === false)
  }
  // 1–3 steady breaths between one window and the next change
  for (let k = 1; k < events.length; k++) {
    const n = events[k].onsetBreath - (events[k - 1].onsetBreath + 5)
    assert.ok(n >= 1 && n <= 3, `gap of ${n} breaths before change ${k}`)
  }
  assert.ok(pacerAt(pr.schedule, events[3].onsetMs + 10).breath === events[3].onsetBreath)
})

test('each size is the grid\'s request for its direction unless the bounds forced a smaller one', () => {
  const pr = run({ muFast: 0.25, muSlow: 0.25, seed: 3 })
  for (const e of pr.schedule.events) assert.ok(e.mag <= e.asked + 1e-12)
  const asked = pr.schedule.events.filter(e => Math.abs(e.mag - e.asked) < 1e-12).length
  assert.ok(asked >= pr.schedule.events.length - 3)
})

test('the same seed and the same presses give the same stream', () => {
  const a = run({ muFast: 0.2, muSlow: 0.2, seed: 11 })
  const b = run({ muFast: 0.2, muSlow: 0.2, seed: 11 })
  assert.deepEqual(a.schedule.breaths, b.schedule.breaths)
  assert.deepEqual(a.result(), b.result())
})

test('a participant who obeys the model is measured with an RMSE under 0.3 log units per direction', () => {
  // Their 50%-hit size in a window (what m50Hat means) is mu with FA guessing added.
  const errs = []
  let asym = 0
  for (let seed = 1; seed <= 12; seed++) {
    const muFast = 0.12 * Math.exp(0.3 * Math.sin(seed))
    const muSlow = 0.12 * Math.exp(0.3 * Math.sin(seed)) * (seed % 2 ? 2.2 : 1)
    const res = run({ muFast, muSlow, seed, nChanges: 40 }).result()
    // 0.3/min false alarms over a 21 s window move the 50% point down by about 5%; ignore it here
    errs.push(Math.log(res.m50Faster / muFast), Math.log(res.m50Slower / muSlow))
    if ((res.m50Slower > res.m50Faster) === (seed % 2 === 1)) asym++
  }
  const rmse = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length)
  assert.ok(rmse < 0.3, `rmse ${rmse.toFixed(2)}`)
  assert.ok(asym >= 10, `asymmetry direction right in ${asym} of 12`)
})

test('stopping early drops a change whose window is still open', () => {
  const pr = createPrerun({ seed: 5 })
  pr.advanceTo(0)
  const first = () => pr.schedule.events[0]
  let ms = 0
  while (!first()) pr.advanceTo(ms += 100)
  pr.press(first().onsetMs + 2000)
  pr.stop(first().onsetMs + 3000)
  assert.ok(pr.done)
  assert.equal(pr.result().nChanges, 0)
  assert.equal(first().hit, null)
})

test('the shared grid ignores direction; the separate grid keeps them apart', () => {
  const sep = createQuest({}, true)
  const one = createQuest({}, false)
  for (let k = 0; k < 6; k++) for (const q of [sep, one]) {
    q.updateChange(-1, 0.1, 21, true)   // speeding: small changes noticed
    q.updateChange(1, 0.3, 21, false)   // slowing: large changes missed
  }
  assert.ok(sep.muHat(-1) < sep.muHat(1) - 1)
  assert.equal(one.muHat(-1), one.muHat(1))
  assert.ok(one.muHat(-1) > sep.muHat(-1) && one.muHat(1) < sep.muHat(1))
})
