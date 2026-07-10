// Headless checks for the Mirror calibration primitives.
//   node src/games/shared/breath/mirrorCalibration.test.mjs
//
// Synthesizes 25 Hz belt-like signals for a set of scenarios and asserts that
// the confidence composite, its sub-factors, the coaching router, and the live
// amplitude ranger behave. Thresholds here are the module defaults; these tests
// guard the *behavior* (clean > noisy, off-axis tanks clarity, etc.), not exact
// numbers — those get dialed on real belt data.

import {
  createAmplitudeRanger, createCalibrationMonitor, createCalibrationSession,
} from './mirrorCalibration.js'

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok', msg) } else { fail++; console.log('  ✗ FAIL', msg) } }

const DT = 40                 // 25 Hz
const PERIOD = 5000           // 12 bpm
const pacerAt = (t) => (1 - Math.cos(2 * Math.PI * t / PERIOD)) / 2   // 0..1

// Build a scenario: axis = breath direction (unit-ish), depth = excursion,
// noise = per-axis white noise sd, follow = how well the person tracks the pacer
// (1 = perfect, phaseJitter shifts them), motionAt = [start,end] injects a spike.
function synth({ durMs = 24000, axis = [1, 0, 0], depth = 1, noise = 0.02,
                 rate = PERIOD, drift = 0, hold = false } = {}) {
  const rand = mulberry32(42)
  const rows = []
  for (let t = 0; t <= durMs; t += DT) {
    const r = rate * (1 + drift * (t / durMs))          // optional rate drift
    const breath = hold ? 0.5 : (1 - Math.cos(2 * Math.PI * t / r)) / 2   // 0..1
    const amp = depth * (breath - 0.5)                  // centered excursion
    const fx = axis[0] * amp + noise * (rand() - 0.5)
    const fy = axis[1] * amp + noise * (rand() - 0.5)
    const fz = axis[2] * amp + noise * (rand() - 0.5)
    // proj = projection onto the TRUE axis (what a good fit would recover)
    const proj = fx * axis[0] + fy * axis[1] + fz * axis[2] + 0.5
    rows.push({ t, fx, fy, fz, proj, pacer: pacerAt(t) })
  }
  return rows
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function runMonitor(rows) {
  const mon = createCalibrationMonitor()
  let last = null
  for (const row of rows) {
    mon.push(row.t, row)
    // assess ~4×/s like the live path will
    if (row.t % 250 === 0) last = mon.assess(row.t)
  }
  return last ?? mon.assess(rows[rows.length - 1].t)
}

console.log('\nMirror calibration primitives\n')

// ── clean, well-followed calibration → high confidence, no coaching ──
{
  const a = runMonitor(synth({ noise: 0.015, depth: 1 }))
  ok(a.ready, 'clean: assess is ready')
  ok(a.confidence > 0.8, `clean: confidence high (${a.confidence.toFixed(2)})`)
  ok(a.coach == null, 'clean: no coaching prompt when confident')
  ok(a.sub.tracking > 0.7 && a.sub.clarity > 0.7 && a.sub.strength > 0.7, 'clean: all core factors strong')
  ok(a.gates.rhythm && a.gates.motion, 'clean: both gates pass')
}

// ── weak signal (loose/rattling belt): heavy jitter on the breath axis, little
// real breath. EVR stays high (variance is on one axis) but absolute SNR tanks,
// so strength — not clarity — is the diagnosis → "check the strap". ──
{
  const rand = mulberry32(7)
  const rows = []
  for (let t = 0; t <= 24000; t += DT) {
    const breath = 0.5 + 0.04 * Math.sin(2 * Math.PI * t / PERIOD)   // barely-there breath
    const jitter = 0.10 * (rand() - 0.5)                             // rattle on the SAME axis
    const fx = (breath - 0.5) + jitter
    const proj = fx + 0.5
    rows.push({ t, fx, fy: 0.001 * (rand() - 0.5), fz: 0.001 * (rand() - 0.5), proj, pacer: pacerAt(t) })
  }
  const a = runMonitor(rows)
  ok(a.confidence < 0.6, `weak: confidence suppressed (${a.confidence.toFixed(2)})`)
  ok(a.sub.strength < 0.55, `weak: strength factor is low (${a.sub.strength.toFixed(2)})`)
  ok(a.weakest === 'strength', `weak: routes to strength coaching (got ${a.weakest})`)
  ok(/strap|electrode/i.test(a.coach || ''), 'weak: coach mentions strap/electrodes')
}

// ── off-axis / smeared breathing: energy split across axes → clarity drops ──
// Compare EVR of a clean single-axis breath vs one whose motion is spread with
// large independent per-axis noise of the same scale as the breath.
{
  const clean = runMonitor(synth({ axis: [1, 0, 0], depth: 1, noise: 0.02 }))
  const smear = runMonitor(synth({ axis: [1, 0, 0], depth: 0.5, noise: 0.5 }))
  ok(smear.sub.clarity < clean.sub.clarity, `smeared: clarity drops (${smear.sub.clarity.toFixed(2)} < ${clean.sub.clarity.toFixed(2)})`)
}

// ── breath-hold: no oscillation → rhythm gate fails, confidence gated down ──
{
  const a = runMonitor(synth({ hold: true, noise: 0.02 }))
  ok(!a.gates.rhythm, 'hold: rhythm gate fails (no periodic peaks)')
  ok(a.confidence < 0.6, `hold: confidence gated down (${a.confidence.toFixed(2)})`)
}

// ── not following the pacer (opposite phase) → tracking drops ──
// Person breathes at the right rate but 180° out of phase with the avatar.
{
  const rows = synth({ noise: 0.015 }).map(r => ({ ...r, pacer: 1 - r.pacer }))
  const a = runMonitor(rows)
  const inphase = runMonitor(synth({ noise: 0.015 }))
  // abs(pearson) makes anti-phase still correlate; use a phase-shifted (quarter) case instead:
  const quarter = synth({ noise: 0.015 }).map((r, i, arr) => ({ ...r, pacer: arr[(i + Math.round(arr.length / 4)) % arr.length]?.pacer ?? r.pacer }))
  const aq = runMonitor(quarter)
  ok(aq.sub.tracking < inphase.sub.tracking, `off-pace: tracking drops vs in-phase (${aq.sub.tracking.toFixed(2)} < ${inphase.sub.tracking.toFixed(2)})`)
  void a
}

// ── amplitude ranger: recovers full 0..1 range from a compressed projection ──
{
  const ranger = createAmplitudeRanger({ minCount: 20 })
  // raw projection only spans 0.40..0.60 (shallow, off-center) — a frozen gain
  // would render this as a barely-moving pulse.
  for (let t = 0; t <= 30000; t += DT) {
    const raw = 0.5 + 0.10 * Math.sin(2 * Math.PI * t / PERIOD)
    ranger.push(t, raw)
  }
  ranger.recompute()
  ok(ranger.ready, 'ranger: ready after enough samples')
  const top = ranger.normalize(0.60), bot = ranger.normalize(0.40), midp = ranger.normalize(0.50)
  ok(top > 0.9, `ranger: peak maps near 1 (${top.toFixed(2)})`)
  ok(bot < 0.1, `ranger: trough maps near 0 (${bot.toFixed(2)})`)
  ok(Math.abs(midp - 0.5) < 0.1, `ranger: centre maps near 0.5 (${midp.toFixed(2)})`)
  ok(ranger.normalize(0.80) === 1 && ranger.normalize(0.20) === 0, 'ranger: clamps beyond the band')
}

// ── ranger passes through until it has data ──
{
  const ranger = createAmplitudeRanger({ minCount: 40 })
  ok(ranger.normalize(0.7) === 0.7, 'ranger: passes value through before ranging')
}

// ── adaptive session: a good follower converges to 'ready' after the minimum ──
{
  const startMs = 100000
  const sess = createCalibrationSession({ periodMs: PERIOD, startMs, minMs: 20000, maxMs: 60000 })
  const rand = mulberry32(3)
  let last = null, readyAt = null
  for (let t = startMs; t <= startMs + 60000; t += DT) {
    const breath = (1 - Math.cos(2 * Math.PI * (t - startMs) / PERIOD)) / 2   // follows the pacer
    const amp = (breath - 0.5)
    sess.ingest(t, { fx: amp + 0.02 * (rand() - 0.5), fy: 0.01 * (rand() - 0.5), fz: 0.01 * (rand() - 0.5) })
    if (t % 250 === 0) { last = sess.assess(t); if (last.status === 'ready' && readyAt == null) readyAt = last.elapsedMs }
  }
  ok(readyAt != null, 'session: a good follower reaches ready')
  ok(readyAt >= 20000, `session: never accepts before the 20 s minimum (readyAt=${readyAt})`)
  ok(readyAt < 45000, `session: converges well before the ceiling (readyAt=${(readyAt/1000).toFixed(0)}s)`)
}

// ── adaptive session: a breath-holder never converges → timeout + coaching ──
{
  const startMs = 200000
  const sess = createCalibrationSession({ periodMs: PERIOD, startMs, minMs: 20000, maxMs: 40000 })
  const rand = mulberry32(9)
  let last = null
  for (let t = startMs; t <= startMs + 42000; t += DT) {
    // barely moving — a held breath / not engaging
    sess.ingest(t, { fx: 0.01 * (rand() - 0.5), fy: 0.01 * (rand() - 0.5), fz: 0.01 * (rand() - 0.5) })
    if (t % 250 === 0) last = sess.assess(t)
  }
  ok(last.status === 'timeout', `session: holder times out (status=${last.status})`)
  ok(last.confidence < 0.6, `session: holder confidence stays low (${last.confidence.toFixed(2)})`)
  ok(typeof last.coach === 'string' && last.coach.length > 0, 'session: timeout surfaces a coaching prompt')
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
