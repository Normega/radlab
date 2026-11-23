// Headless checks for the microphone breath detector (micBreath.js), driven by
// synthetic band-energy frames — no audio hardware.
// Run: npm test   (or: node --test src/games/shared/breath/micBreath.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert'
import { createMicBreathDetector, bandFeatures, acfPeriod } from './micBreath.js'

const DT = 50

// Deterministic jitter so the floor isn't a flat line.
function rng(seed) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

// segments: [{ ms, db, centroid?, flatness? }] repeated `reps` times; db is the
// rise above a -70 dB room floor (0 = silence).
function run(segments, reps, opts = {}, seed = 1) {
  const r = rng(seed)
  const det = createMicBreathDetector({ source: 'breath', ...opts })
  let t = 0
  const lead = 8000 // let the floor settle on silence first
  for (; t < lead; t += DT) det.push(t, { breathDb: -70 + r() * 2, windDb: -80 + r(), flatness: 0.45, centroid: 800 })
  for (let k = 0; k < reps; k++) {
    for (const s of segments) {
      for (let e = 0; e < s.ms; e += DT, t += DT) {
        det.push(t, {
          breathDb: -70 + s.db + r() * 2,
          windDb: -80 + r(),
          flatness: s.flatness ?? 0.45,
          centroid: s.centroid ?? 800,
        })
      }
    }
  }
  return { det, t }
}

test('exhale-only breathing at 10 bpm reads as single bursts, ~10 bpm', () => {
  const { det, t } = run([{ ms: 2000, db: 14 }, { ms: 4000, db: 0 }], 10)
  const est = det.estimate(t)
  assert.equal(est.mode, 'single')
  assert.ok(Math.abs(est.bpm - 10) < 0.6, `bpm ${est.bpm}`)
  assert.ok(Math.abs(est.acfBpm - 10) < 1, `acf ${est.acfBpm}`)
})

test('inhale+exhale pairs are recognised and not double-counted', () => {
  // in (quieter, brighter) 1.5 s · gap 0.8 s · ex (louder, darker) 2 s · pause 1.7 s = 6 s.
  // (A shorter in→ex gap merges into one burst — which still reads the right rate.)
  const { det, t } = run([
    { ms: 1500, db: 9, centroid: 1400 }, { ms: 800, db: 0 },
    { ms: 2000, db: 16, centroid: 600 }, { ms: 1700, db: 0 },
  ], 10)
  const est = det.estimate(t)
  assert.equal(est.mode, 'pairs')
  assert.ok(Math.abs(est.bpm - 10) < 0.6, `bpm ${est.bpm}`)
  const labels = det.bursts.slice(-4).map(b => b.label)
  // The burst followed by the short gap is the inhale.
  const loud = det.bursts.slice(-4).map(b => b.peakDb > 12)
  labels.forEach((l, i) => assert.equal(l, loud[i] ? 'exhale' : 'inhale'))
})

test('forced single mode on paired breathing doubles the rate (so auto matters)', () => {
  const { det, t } = run([
    { ms: 1500, db: 9, centroid: 1400 }, { ms: 800, db: 0 },
    { ms: 2000, db: 16, centroid: 600 }, { ms: 1700, db: 0 },
  ], 10, { pairing: 'single', minPeriodMs: 1000 })
  const est = det.estimate(t)
  assert.ok(est.bpm > 15, `bpm ${est.bpm}`)
})

test('tonal sound (voice) is gated out', () => {
  const { det } = run([{ ms: 2000, db: 14, flatness: 0.05 }, { ms: 4000, db: 0 }], 6)
  assert.equal(det.bursts.length, 0)
})

test('silence produces no bursts and no rate', () => {
  const { det, t } = run([{ ms: 6000, db: 0 }], 6)
  assert.equal(det.bursts.length, 0)
  assert.equal(det.estimate(t).bpm, null)
})

test('a rate goes stale when breathing sounds stop', () => {
  const r = run([{ ms: 2000, db: 14 }, { ms: 4000, db: 0 }], 8)
  let t = r.t
  for (let e = 0; e < 20000; e += DT, t += DT) r.det.push(t, { breathDb: -70, windDb: -80, flatness: 0.45, centroid: 800 })
  assert.equal(r.det.estimate(t).bpm, null)
})

test('bandFeatures: white noise is flat, a tone is not', () => {
  const n = 1024, sr = 48000, fft = 2048
  const r = rng(7)
  // single-frame periodogram of white noise: exponential-distributed bin power
  const noise = Float32Array.from({ length: n }, () => 10 * Math.log10(-Math.log(1 - r() * 0.999999)))
  const tone = Float32Array.from({ length: n }, (_, i) => (i === 40 ? 0 : -100))
  const fn = bandFeatures(noise, sr, fft, [250, 2500])
  const ft = bandFeatures(tone, sr, fft, [250, 2500])
  assert.ok(fn.flatness > 0.4, `noise ${fn.flatness}`)
  assert.ok(ft.flatness < 0.05, `tone ${ft.flatness}`)
})

test('acfPeriod finds a 5 s period, not its multiple', () => {
  const x = Array.from({ length: 600 }, (_, i) => Math.max(0, Math.sin(2 * Math.PI * i * DT / 5000)))
  const { periodMs } = acfPeriod(x, DT, 2000, 15000)
  assert.ok(Math.abs(periodMs - 5000) < 200, `period ${periodMs}`)
})
