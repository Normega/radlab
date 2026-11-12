// Headless checks for the BCAT threshold key log: recording, Kite's parsing rule, scoring against the pacer.
// Run: node --test src/games/BcatThreshold/keyLog.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createKeyLog, createKeyTracker, roleOf, pairPresses, controlSegments, normalizeSegments, parseKeyLog, scoreHolds,
  MIN_HOLD_MS, MERGE_GAP_MS, keyId,
} from './keyLog.js'
import * as Kite from '../Kite/breathShapes.js'
import { buildTimeline, halfPulses } from './pacerClock.js'
import { makeConfig } from './config.js'
import { mulberry32 } from '../BcatDdm/schedule.js'

const KEYS = makeConfig().keys
const W = { key: 'w', code: 'KeyW' }, S = { key: 's', code: 'KeyS' }, LEFT = { key: 'ArrowLeft', code: 'ArrowLeft' }

// A trial log from a script of [t, 'down'|'up'|'blur', key] steps.
function logOf(steps, { endMs = 20000, heldAtStart = [], heldAtEnd, tracker = createKeyTracker() } = {}) {
  const log = createKeyLog(KEYS)
  for (const h of heldAtStart) tracker.keydown(h)
  log.begin(0, tracker.held())
  for (const [t, kind, k] of steps) {
    if (kind === 'down') { log.keydown({ ...k, t }); tracker.keydown(k) } else if (kind === 'up') { log.keyup({ ...k, t }); tracker.keyup(k) } else {
      log.blur({ t, tracker })
    }
  }
  log.end(endMs, heldAtEnd ?? tracker.held())
  return log
}
const holdsOf = (steps, opts) => parseKeyLog(logOf(steps, opts).events, { endMs: opts?.endMs ?? 20000 }).holds
  .map(h => [h.phase, h.t0, h.t1])

test('the thresholds are Kite\'s', () => {
  assert.equal(MIN_HOLD_MS, Kite.MIN_HOLD_MS)
  assert.equal(MERGE_GAP_MS, Kite.MERGE_GAP_MS)
  const c = makeConfig().keyLog
  assert.equal(c.min_hold_ms, MIN_HOLD_MS)
  assert.equal(c.merge_gap_ms, MERGE_GAP_MS)
})

test('normalizeSegments is Kite\'s normalizeSegments (random logs, grow = in, shrink = out)', () => {
  const rand = mulberry32(31)
  const toKite = segs => segs.map(s => ({ ...s, phase: s.phase === 'grow' ? 'in' : s.phase === 'shrink' ? 'out' : s.phase }))
  for (let n = 0; n < 3000; n++) {
    const segs = []
    let t = 0
    const len = 1 + Math.floor(rand() * 14)
    for (let i = 0; i < len; i++) {
      const phase = ['grow', 'shrink', 'pause'][Math.floor(rand() * 3)]
      const d = rand() < 0.5 ? Math.floor(rand() * 600) : Math.floor(rand() * 3000)   // many near the 300-ms thresholds
      segs.push({ phase, t0: t, t1: t + d })
      t += d
    }
    assert.deepStrictEqual(toKite(normalizeSegments(segs)), Kite.normalizeSegments(toKite(segs)), JSON.stringify(segs))
  }
})

test('roles: by the character typed, by the physical key only when the browser gives none', () => {
  assert.equal(roleOf('w', 'KeyW', KEYS), 'grow')
  assert.equal(roleOf('W', 'KeyW', KEYS), 'grow')          // shift or caps lock
  assert.equal(roleOf('s', 'KeyS', KEYS), 'shrink')
  assert.equal(roleOf('Unidentified', 'KeyW', KEYS), 'grow')
  assert.equal(roleOf('', 'KeyS', KEYS), 'shrink')
  assert.equal(roleOf('w', 'KeyZ', KEYS), 'grow')          // AZERTY: the key labelled W
  assert.equal(roleOf('z', 'KeyW', KEYS), 'other')         // AZERTY: the key in QWERTY's W position types z
  assert.equal(roleOf('ArrowLeft', 'ArrowLeft', KEYS), 'other')
})

test('recording: raw events in arrival order, repeats counted not logged, keys held at onset and offset', () => {
  const log = createKeyLog(KEYS)
  assert.equal(log.keydown({ ...W, t: -5 }), false, 'nothing is logged before begin()')
  log.begin(0, [{ ...S }])
  log.keydown({ ...W, t: 2000, tHandler: 2001.5 })
  log.keydown({ ...W, t: 2030, repeat: true })
  log.keydown({ ...W, t: 2060, repeat: true })
  log.keyup({ ...S, t: 2100 })
  log.keyup({ ...W, t: 3500 })
  log.keydown({ ...LEFT, t: 4000 })
  const out = log.end(5000, [{ ...LEFT }])
  assert.equal(out.repeats, 2)
  assert.deepStrictEqual(out.events.map(e => [e.i, e.type, e.key, e.role, e.t]), [
    [0, 'held_at_onset', 's', 'shrink', 0], [1, 'keydown', 'w', 'grow', 2000], [2, 'keyup', 's', 'shrink', 2100],
    [3, 'keyup', 'w', 'grow', 3500], [4, 'keydown', 'ArrowLeft', 'other', 4000], [5, 'held_at_offset', 'ArrowLeft', 'other', 5000]])
  assert.equal(out.events[1].t_handler, 2001.5)
  assert.equal(log.keydown({ ...W, t: 6000 }), false, 'nothing is logged after end()')
  assert.throws(() => log.end(7000))
  assert.throws(() => createKeyLog(KEYS).end(1))
})

test('pairing: every key-down is in exactly one press; nothing is dropped', () => {
  const steps = [[1500, 'down', W], [1600, 'up', W], [1700, 'down', W], [3400, 'up', W], [3500, 'down', S],
    [3520, 'down', W], [3600, 'up', W], [5500, 'up', S], [6000, 'down', LEFT], [6100, 'up', LEFT], [9000, 'down', W]]
  const log = logOf(steps, { endMs: 10000 })
  const presses = pairPresses(log.events, { endMs: 10000 })
  const downs = log.events.filter(e => e.type === 'keydown' || e.type === 'held_at_onset').map(e => e.i)
  assert.deepStrictEqual(presses.map(p => p.downEvent).sort((a, b) => a - b), downs)
  assert.equal(presses.length, downs.length)
  const last = presses[presses.length - 1]
  assert.deepStrictEqual([last.role, last.t0, last.t1, last.heldAtEnd], ['grow', 9000, 10000, true])
  // the parse keeps the raw events untouched
  const parsed = parseKeyLog(log.events, { endMs: 10000 })
  assert.equal(parsed.events, log.events)
  assert.equal(parsed.presses.length, downs.length)
})

test('pairing: a lost key-up, a key-up without a logged press, a key still down at the end', () => {
  const ev = [
    { i: 0, type: 'keydown', key: 'w', code: 'KeyW', role: 'grow', t: 1000 },
    { i: 1, type: 'keydown', key: 'w', code: 'KeyW', role: 'grow', t: 2500 },   // no key-up between: focus was lost
    { i: 2, type: 'keyup', key: 'w', code: 'KeyW', role: 'grow', t: 3000 },
    { i: 3, type: 'keyup', key: 's', code: 'KeyS', role: 'shrink', t: 400 },    // pressed before the log began
    { i: 4, type: 'keydown', key: 's', code: 'KeyS', role: 'shrink', t: 4000 },
  ]
  const p = pairPresses(ev, { endMs: 6000 })
  assert.deepStrictEqual(p.map(x => [x.role, x.t0, x.t1, x.missingKeyup, x.inferredStart, x.heldAtStart, x.heldAtEnd]), [
    ['shrink', 0, 400, false, true, true, false],
    ['grow', 1000, 2500, true, false, false, false],
    ['grow', 2500, 3000, false, false, false, false],
    ['shrink', 4000, 6000, false, false, false, true]])
  assert.throws(() => pairPresses(ev, {}), /endMs/)
})

test('Kite rule 1: a release under 300 ms between two holds of the same key is merged', () => {
  assert.deepStrictEqual(holdsOf([[1000, 'down', W], [2000, 'up', W], [2200, 'down', W], [3000, 'up', W]]), [['grow', 1000, 3000]])
  assert.deepStrictEqual(holdsOf([[1000, 'down', W], [2000, 'up', W], [2300, 'down', W], [3000, 'up', W]]),
    [['grow', 1000, 2000], ['grow', 2300, 3000]], 'a 300-ms gap is a real pause')
})

test('Kite rule 2: a hold under 300 ms is a slip — flagged, kept, and in no hold', () => {
  const log = logOf([[1000, 'down', W], [1150, 'up', W], [3000, 'down', S], [3299, 'up', S], [5000, 'down', S], [5300, 'up', S]])
  const parsed = parseKeyLog(log.events, { endMs: 20000 })
  assert.deepStrictEqual(parsed.holds.map(h => [h.phase, h.t0, h.t1]), [['shrink', 5000, 5300]])
  assert.deepStrictEqual(parsed.presses.map(p => [p.role, p.durationMs, p.slip]), [['grow', 150, true], ['shrink', 299, true], ['shrink', 300, false]])
  assert.equal(log.events.length, 6)
})

test('Kite rule 3: rapid tapping becomes one hold; a slip of the other key inside a hold is stitched over', () => {
  const taps = []
  for (let i = 0; i < 5; i++) taps.push([1000 + 200 * i, 'down', W], [1100 + 200 * i, 'up', W])
  const parsed = parseKeyLog(logOf(taps).events, { endMs: 20000 })
  assert.deepStrictEqual(parsed.holds.map(h => [h.phase, h.t0, h.t1]), [['grow', 1000, 1900]])
  assert.ok(parsed.presses.every(p => !p.slip), 'merged taps are not slips')
  // S held 1000-4000 with a 100-ms W slip inside: one shrink hold, the W press a slip
  const p2 = parseKeyLog(logOf([[1000, 'down', S], [2000, 'down', W], [2100, 'up', W], [4000, 'up', S]]).events, { endMs: 20000 })
  assert.deepStrictEqual(p2.holds.map(h => [h.phase, h.t0, h.t1]), [['shrink', 1000, 4000]])
  assert.deepStrictEqual(p2.presses.map(p => [p.role, p.slip]), [['shrink', false], ['grow', true]])
})

test('overlap: the most recently pressed key that is still held wins (Kite\'s control)', () => {
  // W 1000-3100, S pressed at 3000 before W is released: shrink from 3000
  const segs = controlSegments(pairPresses(logOf([[1000, 'down', W], [3000, 'down', S], [3100, 'up', W], [5000, 'up', S]]).events,
    { endMs: 6000 }), { endMs: 6000 })
  assert.deepStrictEqual(segs, [{ phase: 'pause', t0: 0, t1: 1000 }, { phase: 'grow', t0: 1000, t1: 3000 },
    { phase: 'shrink', t0: 3000, t1: 5000 }, { phase: 'pause', t0: 5000, t1: 6000 }])
  // and back: S released while W is still held returns control to W
  const segs2 = controlSegments(pairPresses(logOf([[1000, 'down', W], [2000, 'down', S], [3000, 'up', S], [4000, 'up', W]]).events,
    { endMs: 5000 }), { endMs: 5000 })
  assert.deepStrictEqual(segs2.map(s => [s.phase, s.t0, s.t1]), [['pause', 0, 1000], ['grow', 1000, 2000], ['shrink', 2000, 3000],
    ['grow', 3000, 4000], ['pause', 4000, 5000]])
  // answer keys never enter the control timeline
  const segs3 = controlSegments(pairPresses(logOf([[1000, 'down', LEFT], [3000, 'up', LEFT]]).events, { endMs: 5000 }), { endMs: 5000 })
  assert.deepStrictEqual(segs3, [{ phase: 'pause', t0: 0, t1: 5000 }])
})

// ── scoring against the pacer ────────────────────────────────────────────
// a timeline with a lead-in pulse (the scoring does not depend on it; the approved config now has none)
const tl = buildTimeline([4, 4, 4, 2.6, 2.6], { fixationMs: 1500, nLeadIn: 1, changeIndex: 3 })
const HALVES = halfPulses(tl)

function tracker(lagMs, timeline = tl) {
  // hold the right key from each half's start + lag to the next half's start + lag (a hand-over at each boundary)
  const steps = []
  halfPulses(timeline).forEach(h => {
    const k = h.phase === 'grow' ? W : S
    steps.push([h.startMs + lagMs, 'down', k])
    if (h.endMs + lagMs < timeline.totalMs) steps.push([h.endMs + lagMs, 'up', k])
  })
  return logOf(steps.sort((a, b) => a[0] - b[0] || (a[1] === 'up' ? -1 : 1)), { endMs: timeline.totalMs })
}

test('the approved trial (no lead-in, 4 pulses): all eight halves scored from the first grow, the last four changed', () => {
  const cfg = makeConfig()
  const t4 = buildTimeline([4, 4, 2.6, 2.6], { fixationMs: cfg.timing.fixation_ms, nLeadIn: cfg.engine.stimulus.n_lead_in_pulses, changeIndex: 2 })
  const h4 = halfPulses(t4)
  const sc = scoreHolds(parseKeyLog(tracker(250, t4).events, { endMs: t4.totalMs }), h4)
  assert.equal(sc.summary.n_halves, 8)
  assert.equal(sc.summary.n_matched, 8)
  assert.equal(sc.summary.median_onset_lag_ms, 250)
  assert.deepStrictEqual(sc.halves.map(r => r.leadIn), Array(8).fill(false))
  assert.deepStrictEqual(sc.halves.filter(r => r.changed).map(r => r.half), [4, 5, 6, 7])
  assert.equal(sc.halves[0].plannedStartMs, 1500, 'the first scored half starts when fixation ends')
})

test('a tracker 250 ms behind the pacer: every half matched, onset and offset lag 250 ms', () => {
  const parsed = parseKeyLog(tracker(250).events, { endMs: tl.totalMs })
  const sc = scoreHolds(parsed, HALVES)
  assert.equal(sc.summary.n_matched, 10)
  assert.equal(sc.summary.n_unmatched_holds, 0)
  assert.equal(sc.summary.n_slips, 0)
  assert.equal(sc.summary.median_onset_lag_ms, 250)
  sc.halves.forEach((r, i) => {
    assert.equal(r.hold, i)
    assert.equal(r.onsetLagMs, 250)
    if (i < 9) {
      assert.equal(r.offsetLagMs, 250)
      assert.ok(Math.abs(r.holdMs - r.plannedMs) < 1e-9)
    } else {
      assert.equal(r.offsetLagMs, null, 'the last hold is still down when the trial ends')
      assert.equal(r.holdMs, null)
    }
    assert.ok(Math.abs(r.coverage - (r.plannedMs - 250) / r.plannedMs) < 1e-9)
  })
  // the changed halves are the fast ones
  assert.deepStrictEqual(sc.halves.filter(r => r.changed).map(r => r.plannedMs), [1300, 1300, 1300, 1300])
  assert.deepStrictEqual(sc.holds.map(h => h.half), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
})

test('anticipation is scored too (negative lag), and a hold far from any boundary is left unmatched', () => {
  const sc = scoreHolds(parseKeyLog(tracker(-200).events, { endMs: tl.totalMs }), HALVES)
  assert.equal(sc.summary.median_onset_lag_ms, -200)
  // a lone grow hold at the middle of a shrink half matches nothing
  const lone = parseKeyLog(logOf([[4000, 'down', W], [4400, 'up', W]], { endMs: tl.totalMs }).events, { endMs: tl.totalMs })
  const s2 = scoreHolds(lone, HALVES)
  assert.equal(s2.summary.n_matched, 0)
  assert.equal(s2.summary.n_unmatched_holds, 1)
  assert.ok(s2.halves[2].coverage === 0 && s2.halves[0].coverage === 0)
  assert.equal(s2.halves[1].coverage, 0)
})

test('a key already down at the trial start has no onset to score; one still down at the end has no offset', () => {
  const log = logOf([[800, 'up', W], [1600, 'down', W], [3500, 'up', W], [17500, 'down', S]], { heldAtStart: [W], endMs: tl.totalMs })
  assert.equal(log.events[0].type, 'held_at_onset')
  assert.equal(log.events[log.events.length - 1].type, 'held_at_offset')
  const parsed = parseKeyLog(log.events, { endMs: tl.totalMs })
  const first = parsed.holds[0]
  assert.deepStrictEqual([first.phase, first.t0, first.t1, first.censoredStart], ['grow', 0, 800, true])
  const lastHold = parsed.holds[parsed.holds.length - 1]
  assert.deepStrictEqual([lastHold.phase, lastHold.t1, lastHold.censoredEnd], ['shrink', tl.totalMs, true])
  const sc = scoreHolds(parsed, HALVES)
  assert.equal(sc.holds[0].half, null, 'the held-over key does not count as the lead-in\'s grow')
  assert.equal(sc.halves[0].onsetLagMs, 100)
  assert.equal(sc.halves[9].onsetLagMs, 17500 - HALVES[9].startMs)
  assert.equal(sc.halves[9].offsetLagMs, null)
})

test('the vision arm (no keys): nothing matched, coverage 0, no error', () => {
  const sc = scoreHolds(parseKeyLog(logOf([]).events, { endMs: tl.totalMs }), HALVES)
  assert.deepStrictEqual([sc.summary.n_holds, sc.summary.n_matched, sc.summary.mean_coverage, sc.summary.median_onset_lag_ms], [0, 0, 0, null])
})

// ── focus loss, delivery races, keys without a code ──────────────────────
test('blur: every open press is closed at the blur and marked; the blur is in the raw log; no phantom hold next trial', () => {
  const tracker = createKeyTracker()
  const A = { key: 'a', code: 'KeyA' }
  // W and S down, then the window loses focus with both still held; after focus returns W's key-up arrives,
  // A (pressed while away) is released, and W is pressed again
  const log = logOf([[1000, 'down', W], [1500, 'down', S], [2000, 'blur'], [2600, 'up', W], [2700, 'up', A],
    [3000, 'down', W], [4000, 'up', W]], { endMs: 5000, tracker })
  assert.deepStrictEqual(tracker.held(), [], 'the blur let go of every key')
  const types = log.events.map(e => e.type)
  assert.deepStrictEqual(types, ['keydown', 'keydown', 'blur', 'keyup', 'keyup', 'keydown', 'keyup'], 'every raw event kept, none added at the end')
  assert.deepStrictEqual([log.events[2].t, log.events[2].role, log.blurs], [2000, null, 1])
  const parsed = parseKeyLog(log.events, { endMs: 5000 })
  assert.equal(parsed.blurred, true)
  assert.deepStrictEqual(parsed.focusLost, [{ t0: 2000, t1: 3000 }])
  assert.deepStrictEqual(parsed.presses.map(p => [p.role, p.t0, p.t1, p.closedBy, p.keyupAfterBlur]), [
    ['grow', 1000, 2000, 'blur', 3], ['shrink', 1500, 2000, 'blur', null], ['grow', 3000, 4000, 'keyup', null]])
  assert.ok(parsed.presses.every(p => !p.heldAtEnd), 'nothing looks held to the end')
  assert.deepStrictEqual(parsed.unpairedKeyups, [4], 'the key-up of a key pressed while away: kept, in no press')
  assert.deepStrictEqual(parsed.holds.map(h => [h.phase, h.t0, h.t1, h.closedByBlur]),
    [['grow', 1000, 1500, true], ['shrink', 1500, 2000, true], ['grow', 3000, 4000, false]])
  // the next trial: the tracker no longer reports W or S as held
  const next = createKeyLog(KEYS)
  next.begin(0, tracker.held())
  assert.equal(next.events.length, 0, 'no phantom held_at_onset')
  // a blur between trials (no log open) still clears the tracker
  tracker.keydown(W)
  assert.equal(createKeyLog(KEYS).blur({ t: 0, tracker }), false)
  assert.deepStrictEqual(tracker.held(), [])
  tracker.keydown(S); tracker.releaseAll()
  assert.deepStrictEqual(tracker.held(), [])
})

test('blur: a hold closed by a blur is left out of onset lag and coverage; the summary says the trial was blurred', () => {
  // the 250-ms tracker, with focus lost 600 ms into the fifth hold and back at the sixth key-down
  const steps = []
  HALVES.forEach(h => {
    const k = h.phase === 'grow' ? W : S
    steps.push([h.startMs + 250, 'down', k])
    if (h.endMs + 250 < tl.totalMs) steps.push([h.endMs + 250, 'up', k])
  })
  const blurT = HALVES[4].startMs + 250 + 600
  steps.push([blurT, 'blur'])
  const order = { up: 0, blur: 1, down: 2 }
  const log = logOf(steps.sort((a, b) => a[0] - b[0] || order[a[1]] - order[b[1]]), { endMs: tl.totalMs })
  const parsed = parseKeyLog(log.events, { endMs: tl.totalMs })
  const sc = scoreHolds(parsed, HALVES)
  assert.equal(sc.summary.blurred, true)
  assert.equal(sc.summary.n_blur_closed_holds, 1)
  assert.deepStrictEqual(sc.holds.map(h => h.closedByBlur), [false, false, false, false, true, false, false, false, false, false])
  assert.equal(sc.holds[4].half, null)
  assert.deepStrictEqual([sc.halves[4].hold, sc.halves[4].onsetLagMs, sc.halves[4].coverage, sc.halves[4].blurred], [null, null, null, true])
  // the sixth half overlaps the time away (focus is known to be back only at its key-down): no coverage, onset scored
  assert.deepStrictEqual([sc.halves[5].onsetLagMs, sc.halves[5].coverage, sc.halves[5].blurred], [250, null, true])
  assert.equal(sc.summary.n_blurred_halves, 2)
  assert.equal(sc.summary.n_matched, 9)
  const others = sc.halves.filter(r => !r.blurred)
  assert.ok(Math.abs(sc.summary.mean_coverage - others.reduce((a, r) => a + r.coverage, 0) / others.length) < 1e-12)
  // offline comparison: the same log scored as if nothing happened
  const raw = scoreHolds(parsed, HALVES, { excludeBlurred: false })
  assert.equal(raw.summary.n_matched, 10)
  assert.ok(raw.halves.every(r => r.coverage !== null))
  // a trial without a blur says so
  assert.equal(scoreHolds(parseKeyLog(tracker(250).events, { endMs: tl.totalMs }), HALVES).summary.blurred, false)
})

test('race at trial start: a key-up stamped before the start but delivered after begin() closes the onset press at 0', () => {
  const log = createKeyLog(KEYS)
  log.begin(0, [{ ...W }])
  log.keyup({ ...W, t: -5 })   // stamped before begin(), delivered after it
  log.keydown({ ...W, t: 1000 })
  log.keyup({ ...W, t: 2000 })
  log.end(5000, [])
  assert.deepStrictEqual(log.events.map(e => [e.type, e.t]), [['held_at_onset', 0], ['keyup', -5], ['keydown', 1000], ['keyup', 2000]],
    'the raw key-up keeps its own timestamp')
  const parsed = parseKeyLog(log.events, { endMs: 5000 })
  assert.deepStrictEqual(parsed.presses.map(p => [p.role, p.t0, p.t1, p.durationMs, p.heldAtStart, p.heldAtEnd, p.upClamped, p.upEvent]), [
    ['grow', 0, 0, 0, true, false, true, 1], ['grow', 1000, 2000, 1000, false, false, false, 3]])
  assert.ok(parsed.presses.every(p => p.durationMs >= 0))
  assert.deepStrictEqual(parsed.holds.map(h => [h.phase, h.t0, h.t1]), [['grow', 1000, 2000]])
  // the same key-up with no held_at_onset (the tracker had not seen the key go down): a press of length 0, flagged
  const p2 = pairPresses([{ i: 0, type: 'keyup', key: 'w', code: 'KeyW', role: 'grow', t: -5 }], { endMs: 5000 })
  assert.deepStrictEqual(p2.map(p => [p.t0, p.t1, p.durationMs, p.inferredStart, p.upClamped]), [[0, 0, 0, true, true]])
  // a key-down stamped before the start counts as down from the start; a key-up stamped before its own key-down
  const p3 = pairPresses([
    { i: 0, type: 'keydown', key: 's', code: 'KeyS', role: 'shrink', t: -20 },
    { i: 1, type: 'keyup', key: 's', code: 'KeyS', role: 'shrink', t: 800 },
    { i: 2, type: 'keydown', key: 'w', code: 'KeyW', role: 'grow', t: 1000 },
    { i: 3, type: 'keyup', key: 'w', code: 'KeyW', role: 'grow', t: 999 },
  ], { endMs: 5000 })
  assert.deepStrictEqual(p3.map(p => [p.role, p.t0, p.t1, p.heldAtStart, p.downClamped, p.upClamped]), [
    ['shrink', 0, 800, true, true, false], ['grow', 1000, 1000, false, false, true]])
})

test('keys without a code (code \'\') are told apart by their character', () => {
  const W0 = { key: 'w', code: '' }, S0 = { key: 's', code: '' }
  const tracker = createKeyTracker()
  const log = logOf([[1000, 'down', W0], [2000, 'down', S0], [3000, 'up', W0], [4000, 'up', S0]], { endMs: 5000, tracker })
  const presses = pairPresses(log.events, { endMs: 5000 })
  assert.deepStrictEqual(presses.map(p => [p.role, p.t0, p.t1, p.missingKeyup, p.inferredStart]), [
    ['grow', 1000, 3000, false, false], ['shrink', 2000, 4000, false, false]])
  tracker.keydown(W0); tracker.keydown(S0)
  assert.equal(tracker.held().length, 2)
  tracker.keyup(W0)
  assert.deepStrictEqual(tracker.held().map(k => k.key), ['s'])
  assert.equal(keyId('w', ''), 'w')
  assert.equal(keyId('w', 'KeyW'), 'KeyW')
})

test('the tracker across trials knows which keys are down', () => {
  const t = createKeyTracker()
  t.keydown(W); t.keydown({ ...W, repeat: true }); t.keydown(S)
  assert.deepStrictEqual(t.held().map(k => k.code), ['KeyW', 'KeyS'])
  t.keyup(W)
  assert.ok(!t.isDown('KeyW') && t.isDown('KeyS'))
  t.clear()
  assert.deepStrictEqual(t.held(), [])
})
