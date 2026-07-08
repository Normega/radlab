// ── analyzeRecording.mjs ────────────────────────────────────────────────────
//
// Signal-quality / posture analysis for a breath recording captured on
// /dev/breath-lab. Reports, per 10 s bin: breath-signal health (SD of the
// projected value, clamp-saturation % as a motion-artifact proxy), rate, and —
// for schema-2 recordings that carry filtered axes (fx/fy/fz) + weights — the
// explained-variance ratio (EVR) and total variance, plus the live
// signalDegraded episodes. Cross-checks recomputed EVR against the live-logged
// values so detector thresholds can be re-tuned offline.
//
// Usage: node src/games/shared/breath/analyzeRecording.mjs <recording.json>

import { readFileSync } from 'node:fs'
import { createQualityTracker } from './breathFeatures.js'

const path = process.argv[2]
if (!path) { console.error('usage: node analyzeRecording.mjs <recording.json>'); process.exit(1) }
const rec = JSON.parse(readFileSync(path, 'utf8'))
const S = rec.samples.filter(s => s.value != null)
if (S.length < 2) { console.error('too few samples'); process.exit(1) }
const t0 = S[0].t
const hasAxes = S.some(s => s.fx != null) && rec.meta?.weights
const hasLiveEvr = S.some(s => s.evr != null)

console.log(`\nRecording: ${path}`)
const m = rec.meta || {}
console.log(`  schema ${m.schema}  ${m.isSimMode ? '(SIM)' : '(real belt)'}  ${m.recordedAt || ''}`)
if (m.note) console.log(`  note: "${m.note}"`)
if (m.calib) console.log(`  calib: fitR=${m.calib.fitR?.toFixed?.(2)} model=${m.calib.modelLabel}`)
console.log(`  duration ${((S[S.length-1].t - t0)/1000).toFixed(0)}s, ${S.length} samples`)
console.log(`  filtered axes: ${hasAxes ? 'yes' : 'NO (schema<2 — record again to analyze EVR)'}   live EVR logged: ${hasLiveEvr ? 'yes' : 'no'}`)

// Offline EVR recomputation (if axes + weights present)
let track = null
if (hasAxes) track = createQualityTracker(rec.meta.weights)

const std = (a) => { const m0 = a.reduce((x,y)=>x+y,0)/a.length; return Math.sqrt(a.reduce((x,y)=>x+(y-m0)**2,0)/a.length) }
const bins = Math.ceil((S[S.length-1].t - t0) / 10000)

console.log(`\n bin(s)  valSD  sat%  medBpm${hasAxes ? '   EVR(recomp)  totalVar' : ''}${hasLiveEvr ? '   liveEVR  deg' : ''}`)
for (let b = 0; b < bins; b++) {
  const lo = t0 + b*10000, hi = lo + 10000
  const w = S.filter(s => s.t >= lo && s.t < hi)
  if (!w.length) continue
  const vals = w.map(s => s.value)
  const sd = std(vals)
  const sat = 100 * w.filter(s => s.value < 0.03 || s.value > 0.97).length / w.length
  const bpms = w.map(s => s.bpm).filter(x => x != null).sort((a,c)=>a-c)
  const med = bpms.length ? bpms[Math.floor(bpms.length/2)] : null

  let evrStr = '', liveStr = ''
  if (hasAxes) {
    for (const s of w) if (s.fx != null) track.push(s.t, s.fx, s.fy, s.fz)
    const st = track.stats()
    evrStr = `   ${st.evr==null?'—':(st.evr*100).toFixed(0).padStart(3)+'%'}       ${st.totalVar==null?'—':st.totalVar.toFixed(4)}`
  }
  if (hasLiveEvr) {
    const es = w.map(s=>s.evr).filter(x=>x!=null)
    const le = es.length ? es[Math.floor(es.length/2)] : null
    const deg = w.some(s => s.degraded) ? 'YES' : '·'
    liveStr = `   ${le==null?'—':(le*100).toFixed(0).padStart(3)+'%'}   ${deg}`
  }
  console.log(`${(b*10).toString().padStart(4)}   ${sd.toFixed(3)}  ${sat.toFixed(0).padStart(3)}   ${med?med.toFixed(1):'—'}${evrStr}${liveStr}`)
}

if (hasLiveEvr) {
  // Degraded episodes (contiguous)
  const eps = []
  let start = null
  for (const s of S) {
    if (s.degraded && start == null) start = s.t
    else if (!s.degraded && start != null) { eps.push([start, s.t]); start = null }
  }
  if (start != null) eps.push([start, S[S.length-1].t])
  console.log(`\nsignalDegraded episodes (live): ${eps.length ? eps.map(([a,z]) => `${((a-t0)/1000).toFixed(0)}–${((z-t0)/1000).toFixed(0)}s`).join(', ') : 'none'}`)
}
console.log()
