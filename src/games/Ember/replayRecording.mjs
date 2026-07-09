// ── replayRecording.mjs ─────────────────────────────────────────────────────
//
// Feeds a real belt recording (captured on /dev/breath-lab → "Record a session")
// through Ember's warmth mechanics offline — deterministically, with no belt and
// none of the tab-throttling that makes live headless observation unreliable.
// Reports the warmth trajectory, time-to-catch, and rate/regularity distribution
// so the constants in constants.js can be tuned against real breathing.
//
// Usage:
//   node src/games/Ember/replayRecording.mjs <path-to-recording.json>
//
// The recording's `samples` are 50 Hz snapshots of the exact signal the game
// saw ({ t, value, bpm, lastPeriodMs, regularitySdMs, ... }), so replaying is
// just: for each frame, stepWarmth(W, sample, dt). This reproduces what the fire
// would have done during that session.

import { readFileSync } from 'node:fs'
import { createWarmthEngine, rateFromSignal } from './emberMechanics.js'
import { WIN_WARMTH, HOLD_MS } from './constants.js'

const path = process.argv[2]
if (!path) { console.error('usage: node replayRecording.mjs <recording.json>'); process.exit(1) }

const rec = JSON.parse(readFileSync(path, 'utf8'))
const samples = rec.samples ?? []
if (samples.length < 2) { console.error('recording has too few samples'); process.exit(1) }

// Backfill regularityCv for recordings captured before that field existed:
// CV ≈ SD / mean-period, and mean period ≈ 60000/bpm. Without this, legacy
// recordings would replay with the regularity gate disabled (CV undefined → 1).
let backfilled = 0
for (const s of samples) {
  if (s.regularityCv == null && s.regularitySdMs != null && s.bpm) {
    s.regularityCv = s.regularitySdMs / (60000 / s.bpm)
    backfilled++
  }
}

// ── Replay warmth frame by frame using the recorded inter-sample dt ──────────
let W = 0
let holdStart = null
let caughtAtS = null
let maxW = 0
let timeInResonanceMs = 0
const rates = []
const warmthTrace = []   // [{ tS, W, rate }] thinned for a compact printout

const t0 = samples[0].t
let prevT = samples[0].t
const engine = createWarmthEngine()   // same sustained-rate + breath-hold guard as the game

for (const s of samples) {
  const dtMs = Math.max(0, s.t - prevT)
  prevT = s.t

  const r = engine.step(s, dtMs)
  W = r.W
  const rate = r.rate   // engine's smoothed rate (what the fill actually sees)
  rates.push(rate)
  if (rate <= 7) timeInResonanceMs += dtMs

  if (W >= WIN_WARMTH) {
    if (holdStart == null) holdStart = s.t
    if (caughtAtS == null && s.t - holdStart >= HOLD_MS) caughtAtS = (s.t - t0) / 1000
  } else {
    holdStart = null
  }

  maxW = Math.max(maxW, W)
  const tS = (s.t - t0) / 1000
  if (warmthTrace.length === 0 || tS - warmthTrace[warmthTrace.length - 1].tS >= 2) {
    warmthTrace.push({ tS, W, rate })
  }
}

// ── Rate distribution ────────────────────────────────────────────────────────
const valid = rates.filter(r => isFinite(r))
valid.sort((a, b) => a - b)
const pct = (p) => valid.length ? valid[Math.floor((valid.length - 1) * p)] : NaN
const durS = (samples[samples.length - 1].t - t0) / 1000

// ── Report ────────────────────────────────────────────────────────────────
const bar = (w) => '█'.repeat(Math.round(w * 30)).padEnd(30, '·')
console.log(`\nRecording: ${path}`)
if (rec.meta) {
  console.log(`  recorded ${rec.meta.recordedAt}  ${rec.meta.isSimMode ? '(SIM)' : '(real belt)'}`)
  if (rec.meta.note) console.log(`  note: "${rec.meta.note}"`)
  if (rec.meta.calib) console.log(`  calib: fitR=${rec.meta.calib.fitR?.toFixed?.(2)} lag=${rec.meta.calib.lagMs}ms model=${rec.meta.calib.modelLabel}`)
}
console.log(`  duration ${durS.toFixed(0)}s, ${samples.length} samples${backfilled ? ` (regularityCv backfilled for ${backfilled})` : ''}`)

console.log(`\nRate (bpm):  p10 ${pct(0.1).toFixed(1)}   median ${pct(0.5).toFixed(1)}   p90 ${pct(0.9).toFixed(1)}`)
console.log(`Time in resonance zone (≤7 bpm): ${(timeInResonanceMs / 1000).toFixed(0)}s (${(timeInResonanceMs / (durS * 10)).toFixed(0)}%)`)

console.log(`\nWarmth trajectory (every ~2s):`)
for (const p of warmthTrace) {
  console.log(`  ${p.tS.toFixed(0).padStart(4)}s  ${bar(p.W)} ${(p.W * 100).toFixed(0).padStart(3)}%   ${isFinite(p.rate) ? p.rate.toFixed(1) + ' bpm' : ''}`)
}

console.log(`\nPeak warmth: ${(maxW * 100).toFixed(0)}%`)
console.log(caughtAtS != null
  ? `Fire CAUGHT at ${caughtAtS.toFixed(0)}s (held ≥${WIN_WARMTH * 100}% for ${HOLD_MS / 1000}s)`
  : `Fire never caught (needs ${WIN_WARMTH * 100}% held ${HOLD_MS / 1000}s). Peak was ${(maxW * 100).toFixed(0)}%.`)
console.log()
