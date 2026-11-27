// Headless checks for Belt Scope's signal code.
//   node src/games/shared/breath/beltScopeSignal.test.mjs
// (also picked up by `npm test`, which runs every src/**/*.test.mjs)
//
// Synthetic H10 streams at 203.4 Hz in mg, with gravity on -x, are pushed
// through the same processor the page uses. The CSV checks compare against the
// study's own writer functions, read out of useBeltSession.js at test time, so
// a change to the study's format fails here instead of silently diverging.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  H10_ACC_HZ, ACC_MS_PER_SAMPLE, SCOPE_HZ, createBeltScopeProcessor, topEigen3, covariance3,
  rhythmAcf, resampleLinear, rateZeroCrossBpm, breathSizeMg, mgToTiltDeg, tiltFromVerticalDeg,
  isUpsideDown, createRawRecorder, buildAccelCsv, buildHrCsv, buildLabelsCsv, sanitizeName,
  fileStamp, parsePmdAccFrame, parseHrRaw, packetSampleTimes, createBandpass, createBeltSim,
  MG_PER_DEG,
} from './beltScopeSignal.js'

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok', msg) } else { fail++; console.log('  ✗ FAIL', msg) } }
const near = (a, b, tol) => Math.abs(a - b) <= tol

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gaussFrom = (rand) => () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())

const unit = (v) => { const n = Math.hypot(...v); return v.map(c => c / n) }
const rot = (v, axis, deg) => {
  const k = unit(axis), a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  const kxv = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
  const kd = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
  return [0, 1, 2].map(i => v[i] * c + kxv[i] * s + k[i] * kd * (1 - c))
}

// Run a synthetic stream through the processor. axisAt(t) gives the breathing
// direction (unit), ampMg the PEAK amplitude, noiseMg white noise per axis.
function run({ durS = 60, ampMg = 4, bpm = 15, axisAt = () => [0, 0, 1], g = [-1000, 0, 0],
               noiseMg = 0, seed = 1, rateJitter = 0, onDecimated = null, source = null } = {}) {
  const p = createBeltScopeProcessor()
  const rand = mulberry32(seed), gauss = gaussFrom(rand)
  let ph = 0
  const n = Math.round(durS * H10_ACC_HZ)
  for (let i = 0; i < n; i++) {
    const t = i * ACC_MS_PER_SAMPLE
    const f = (bpm / 60) * (1 + rateJitter * Math.sin(2 * Math.PI * t / 23000))
    ph += 2 * Math.PI * f / H10_ACC_HZ
    const b = source ? source(t, ph) : ampMg * Math.sin(ph)
    const u = axisAt(t)
    p.pushRaw(t, g[0] + b * u[0] + noiseMg * gauss(), g[1] + b * u[1] + noiseMg * gauss(), g[2] + b * u[2] + noiseMg * gauss())
    if (onDecimated && i % 8 === 7) onDecimated(p, t, b)
  }
  return p
}

// ── 1. A 4 mg sinusoid on one axis: amplitude and rate ──────────────────────
{
  const p = run({ ampMg: 4, bpm: 15, axisAt: () => [0, 0, 1] })
  const s = p.stats()
  ok(near(s.sizeMg, 4, 0.4), `4 mg peak on z reads ${s.sizeMg.toFixed(2)} mg (within 10%)`)
  ok(near(s.rateAcfBpm, 15, 0.5), `rate (autocorrelation) ${s.rateAcfBpm.toFixed(2)} bpm for 15`)
  ok(near(s.rateBpm, 15, 0.5), `rate (zero crossings) ${s.rateBpm.toFixed(2)} bpm for 15`)
  ok(near(s.sizeTiltDeg, 4 / MG_PER_DEG, 0.03), `size as tilt ${s.sizeTiltDeg.toFixed(3)}° (4 mg ≈ 0.23°)`)
  ok(s.share > 0.99, `share on the breath axis ${(s.share * 100).toFixed(1)}%`)
  ok(near(Math.abs(p.direction[2]), 1, 0.01), `direction finds z (${p.direction.map(v => v.toFixed(3)).join(', ')})`)
}

// ── 2. The same breathing rotated 30° onto other axes ───────────────────────
{
  const axis = unit(rot([0, 0, 1], [1, 1, 0], 30))
  const p = run({ ampMg: 4, bpm: 15, axisAt: () => axis })
  const s = p.stats()
  ok(near(s.sizeMg, 4, 0.4), `rotated 30°: ${s.sizeMg.toFixed(2)} mg, same amplitude`)
  ok(s.share > 0.98, `rotated 30°: share ${(s.share * 100).toFixed(1)}% near 100`)
  ok(Math.abs(p.direction[0] * axis[0] + p.direction[1] * axis[1] + p.direction[2] * axis[2]) > 0.999, 'rotated 30°: direction matches the breathing axis')
  // with noise the share drops but stays well above the noise floor
  const pn = run({ ampMg: 4, bpm: 15, axisAt: () => axis, noiseMg: 2, seed: 3 })
  const sn = pn.stats()
  ok(near(sn.sizeMg, 4, 0.4), `rotated + 2 mg raw noise: ${sn.sizeMg.toFixed(2)} mg`)
  ok(sn.share > 0.9, `rotated + noise: share ${(sn.share * 100).toFixed(1)}%`)
}

// ── 3. Direction updates never flip the sign ────────────────────────────────
{
  // Steady signal: after warm-up, every 2 s block of the combined output must
  // correlate positively with the source (a flip would turn one negative).
  // Slowly rotating axis (90° over 3 min) makes the direction move a lot.
  const blocks = []
  let cur = { c: [], s: [] }
  const lag = 0.5 * 1000 // ignore filter lag by comparing against a delayed source
  const srcHist = []
  run({
    durS: 180, ampMg: 6, bpm: 12, noiseMg: 1, seed: 5,
    axisAt: (t) => unit(rot([0, 0, 1], [0, 1, 0], 90 * t / 180000)),
    onDecimated: (p, t, b) => {
      srcHist.push({ t, b })
      if (t < 25000) return
      const h = p.history(100)
      cur.c.push(h.c[h.c.length - 1])
      const tgt = t - lag
      let k = srcHist.length - 1
      while (k > 0 && srcHist[k].t > tgt) k--
      cur.s.push(srcHist[k].b)
      if (cur.c.length >= Math.round(5 * SCOPE_HZ)) { blocks.push(cur); cur = { c: [], s: [] } }
    },
  })
  const corr = (a, b) => {
    const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n
    let sab = 0, saa = 0, sbb = 0
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 }
    return sab / Math.sqrt(saa * sbb)
  }
  const rs = blocks.map(bk => corr(bk.c, bk.s))
  const sign0 = Math.sign(rs[0])
  ok(rs.every(r => Math.sign(r) === sign0 && Math.abs(r) > 0.5), `rotating axis: ${rs.length} blocks, sign never flips (min |r| ${Math.min(...rs.map(Math.abs)).toFixed(2)})`)

  // topEigen3 itself: a direction opposite to the previous one is turned round.
  const C = covariance3([1, -1, 2, -2], [0, 0, 0, 0], [0.1, -0.1, 0.2, -0.2])
  const a = topEigen3(C, [1, 0, 0]), b = topEigen3(C, [-1, 0, 0])
  ok(a.dir[0] > 0 && b.dir[0] < 0, 'topEigen3 keeps the sign of the previous direction')
  // a seed orthogonal to the answer does not trap the iteration
  const c = topEigen3(C, [0, 1, 0])
  ok(Math.abs(c.dir[0]) > 0.99, 'topEigen3 escapes an orthogonal seed')
}

// ── 4. Rhythm: white noise low, sinusoid high ───────────────────────────────
{
  const sine = run({ ampMg: 8, bpm: 12, noiseMg: 1, seed: 11 }).stats()
  ok(sine.rhythm > 0.8, `sinusoid rhythm ${sine.rhythm.toFixed(2)} (> 0.8)`)
  // white noise only, through the same band-pass and projection
  const noise = run({ ampMg: 0, noiseMg: 3, seed: 12, source: () => 0 }).stats()
  ok(noise.rhythm < 0.35, `white noise rhythm ${noise.rhythm.toFixed(2)} (< 0.35)`)
  // and a few more noise seeds, to be sure it was not luck
  const more = [21, 22, 23, 24].map(seed => run({ ampMg: 0, noiseMg: 3, seed, source: () => 0 }).stats().rhythm)
  ok(more.every(r => r < 0.4), `noise rhythm over 4 more seeds: ${more.map(r => r.toFixed(2)).join(', ')}`)
  // rhythmAcf directly: pure 5 Hz sinusoid, period 4 s
  const x = Array.from({ length: 150 }, (_, i) => Math.sin(2 * Math.PI * i / 20))
  const r = rhythmAcf(x)
  ok(near(r.periodS, 4, 0.05) && r.rhythm > 0.8, `rhythmAcf on a pure sine: ${r.rhythm.toFixed(2)} at ${r.periodS.toFixed(2)} s`)
  ok(rhythmAcf(new Array(150).fill(0)).rhythm === 0, 'rhythmAcf on a flat line is 0')
}

// ── 5. Rate: autocorrelation vs zero crossings on harder synthetic data ─────
{
  const rows = []
  for (const [bpm, noise, jitter] of [[6.5, 1, 0], [10, 3, 0.1], [15, 2, 0.15], [20, 4, 0.1], [30, 2, 0]]) {
    const s = run({ durS: 75, ampMg: 5, bpm, noiseMg: noise, rateJitter: jitter, seed: Math.round(bpm * 7) }).stats()
    rows.push({ bpm, acf: s.rateAcfBpm, zc: s.rateBpm })
  }
  const errA = rows.map(r => Math.abs(r.acf - r.bpm)), errZ = rows.map(r => Math.abs(r.zc - r.bpm))
  console.log('    rate check (true / autocorrelation / zero-crossing):', rows.map(r => `${r.bpm}/${r.acf.toFixed(2)}/${r.zc.toFixed(2)}`).join('  '))
  ok(errA.every(e => e < 1.0), `autocorrelation rate (comparison only) within 1 bpm in all cases (max err ${Math.max(...errA).toFixed(2)})`)
  ok(errZ.every(e => e < 1.0), `zero-crossing rate (the one shown) within 1 bpm in all cases (max err ${Math.max(...errZ).toFixed(2)})`)
  // Breathing slower than the rhythm statistic's 10 s lag limit has no peak.
  const slow = run({ durS: 75, ampMg: 6, bpm: 5, seed: 3 }).stats()
  ok(slow.rhythm === 0 && !Number.isFinite(slow.rateAcfBpm), `5 bpm (12 s period) is outside the 1.5–10 s lags: rhythm ${slow.rhythm}, autocorrelation rate blank`)
  ok(near(slow.rateBpm, 5, 0.5), `...but zero crossings still read ${slow.rateBpm.toFixed(2)} bpm`)
}

// ── 6. Orientation ──────────────────────────────────────────────────────────
{
  ok(isUpsideDown([1000, 0, 0]) && !isUpsideDown([-1000, 0, 0]), 'static x +1000 reads upside down, -1000 does not')
  const up = run({ durS: 8, ampMg: 4, g: [1000, 0, 0] }).stats()
  ok(up.upsideDown === true, 'processor: +1000 mg on x for > 3 s → upside-down warning')
  const brief = run({ durS: 2, ampMg: 4, g: [1000, 0, 0] }).stats()
  ok(brief.upsideDown === false && brief.xPositive === true, 'processor: under 3 s positive → no warning yet')
  const down = run({ durS: 8, ampMg: 4, g: [-1000, 0, 0] }).stats()
  ok(down.upsideDown === false, 'processor: -1000 mg on x → no warning')
  ok(near(down.staticMg[0], -1000, 1), `static x reads ${down.staticMg[0].toFixed(1)} mg`)
  const g30 = [-1000 * Math.cos(Math.PI / 6), 1000 * Math.sin(Math.PI / 6), 0]
  ok(near(tiltFromVerticalDeg(g30), 30, 1e-9), `tilt of a 30° gravity vector: ${tiltFromVerticalDeg(g30).toFixed(6)}°`)
  ok(near(tiltFromVerticalDeg([-1000, 0, 0]), 0, 1e-9) && near(tiltFromVerticalDeg([0, 0, -1000]), 90, 1e-9) && near(tiltFromVerticalDeg([1000, 0, 0]), 180, 1e-9), 'tilt 0° upright, 90° on its side, 180° upside down')
  ok(near(mgToTiltDeg(17.45), 1, 0.001), `17.45 mg ≈ ${mgToTiltDeg(17.45).toFixed(4)}°`)
  ok(near(breathSizeMg(Array.from({ length: 2000 }, (_, i) => 10 * Math.sin(i / 10))), 10, 0.1), 'breathSizeMg: a 10 mg-peak sine reads 10')
}

// ── 7. Parsers match the study's ────────────────────────────────────────────
{
  // A frame: type 0x02 (measurement ACC), Polar-epoch ns timestamp, frame type 1, 3 samples.
  const samples = [[-1003, 41, -170], [-998, 39, -169], [12, -7, 32767]]
  const buf = new ArrayBuffer(10 + samples.length * 6)
  const dv = new DataView(buf)
  dv.setUint8(0, 0x02)
  const ns = 838000000123456789n
  dv.setBigUint64(1, ns, true)
  dv.setInt8(9, 1)
  samples.forEach((s, i) => s.forEach((v, k) => dv.setInt16(10 + i * 6 + k * 2, v, true)))
  const f = parsePmdAccFrame(dv)
  ok(f && f.x.join() === '-1003,-998,12' && f.z[2] === 32767, 'PMD frame parses to raw int16 mg')
  ok(f.devicePacketMicros === Number(ns / 1000n), `device timestamp ${f.devicePacketMicros} µs`)
  // the study's arithmetic on the same frame
  const step = Math.ceil(((dv.getInt8(9) + 1) * 8) / 8)
  const study = []
  for (let o = 10; o + 3 * step <= dv.byteLength; o += 3 * step) study.push([dv.getInt16(o, true) / 100, dv.getInt16(o + step, true) / 100, dv.getInt16(o + 2 * step, true) / 100])
  ok(study.every((s, i) => s[0] === f.x[i] / 100 && s[1] === f.y[i] / 100 && s[2] === f.z[i] / 100), 'raw / 100 equals the study row values')

  // HR: flags 0x16 = RR present, contact detected (bits 1-2 = 3), 8-bit HR
  const hb = new DataView(new ArrayBuffer(6))
  hb.setUint8(0, 0x16); hb.setUint8(1, 172); hb.setUint16(2, 870, true); hb.setUint16(4, 865, true)
  const h = parseHrRaw(hb)
  ok(h.heartRate === 172 && h.rrIntervals1024 === '870;865' && h.contactStatus === 3, `HR packet: ${h.heartRate} bpm, rr ${h.rrIntervals1024}, contact ${h.contactStatus} (unsigned above 127)`)
  ok(parseHrRaw(null).heartRate === -1, 'unreadable HR packet logs -1')

  const ts = packetSampleTimes(1000, 3)
  ok(near(ts[2], 1000, 1e-9) && near(ts[0], 1000 - 2 * ACC_MS_PER_SAMPLE, 1e-9), 'packet time marks the last sample')
}

// ── 8. CSV writers reproduce the study's, byte for byte ─────────────────────
{
  const here = fileURLToPath(new URL('.', import.meta.url))
  const src = readFileSync(here + '../../BreathBelt/hooks/useBeltSession.js', 'utf8')
  const grab = (name) => {
    const i = src.indexOf(`function ${name}(`)
    if (i < 0) throw new Error(`useBeltSession.js no longer defines ${name}`)
    let depth = 0, j = src.indexOf('{', i)
    for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break }
    return src.slice(i, j + 1)
  }
  const studyFns = new Function(`${grab('fmtNum')}\n${grab('fmtInt')}\n${grab('buildAccelCsv')}\n${grab('buildHRCsv')}\nreturn { buildAccelCsv, buildHRCsv }`)()

  // Two packets, as the H10 would deliver them.
  const packets = [
    { ts: 1764086400123, dev: 838000000123456, x: [-1003, -998, 0], y: [41, 39, -1], z: [-170, -169, 5] },
    { ts: 1764086400301, dev: 838000000300456, x: [-1001, 32767], y: [-32768, 7], z: [-5, 123] },
  ]
  const rec = createRawRecorder()
  const studyRows = []
  for (const p of packets) {
    rec.pushPacket(p.ts, p.dev, p.x, p.y, p.z)
    // the study's accelHandler row: values / 100, trial -1 outside trials, pacer NaN
    p.x.forEach((_, i) => studyRows.push({ phase: 'belt_scope', trial: -1, packetTimestamp: p.ts, sampleIndex: i, x: p.x[i] / 100, y: p.y[i] / 100, z: p.z[i] / 100, pacerRadius: NaN, devicePacketMicros: p.dev }))
  }
  const mine = buildAccelCsv(rec)
  const theirs = studyFns.buildAccelCsv(studyRows)
  ok(mine === theirs, 'accel CSV identical to the study writer for the same samples')
  console.log('    accel CSV:\n      ' + mine.split('\n').slice(0, 3).join('\n      '))
  ok(mine.split('\n')[1] === 'belt_scope,-1,1764086400123,0,-10.0300,0.4100,-1.7000,,838000000123456', 'accel row: mg / 100 to 4 dp, blank pacer, integer µs')

  const hrRows = [
    { timestamp: 1764086401000, heartRate: 66, rrIntervals1024: '931', contactStatus: 3 },
    { timestamp: 1764086402000, heartRate: 67, rrIntervals1024: '', contactStatus: 2 },
  ]
  const mineHr = buildHrCsv(hrRows)
  const theirsHr = studyFns.buildHRCsv(hrRows.map(r => ({ phase: 'belt_scope', trial: -1, ...r })))
  ok(mineHr === theirsHr, 'HR CSV identical to the study writer')

  const lab = buildLabelsCsv([{ t: 1764086402500, text: 'Tightened' }, { t: 1764086403000, text: 'moved "a bit", left' }], 1764086400000)
  ok(lab === 'timestamp,elapsed_s,label\n1764086402500,2.500,Tightened\n1764086403000,3.000,"moved ""a bit"", left"', 'labels CSV: elapsed seconds, quoted text')

  ok(sanitizeName('Norm test #3') === 'Norm-test-3' && sanitizeName('  ../x/y  ') === 'x-y' && sanitizeName('') === 'belt-scope', 'recording names sanitised for a filename')
  ok(/^\d{8}-\d{6}$/.test(fileStamp(Date.now())), 'file stamp is YYYYMMDD-HHMMSS')
}

// ── 9. Filter and simulator sanity ──────────────────────────────────────────
{
  // band-pass passes 0.25 Hz, removes DC (gravity) and most of 3 Hz
  const gain = (fHz) => {
    const bp = createBandpass(SCOPE_HZ)
    const out = []
    for (let i = 0; i < SCOPE_HZ * 120; i++) out.push(bp.step(1000 + Math.sin(2 * Math.PI * fHz * i / SCOPE_HZ)))
    const tail = out.slice(-Math.round(SCOPE_HZ * 40))
    return Math.SQRT2 * Math.sqrt(tail.reduce((s, v) => s + v * v, 0) / tail.length)
  }
  ok(near(gain(0.25), 1, 0.03), `band-pass gain at 0.25 Hz ${gain(0.25).toFixed(3)}`)
  ok(gain(3) < 0.1, `band-pass gain at 3 Hz ${gain(3).toFixed(3)}`)

  // the simulator, through the processor: size follows the setting, and a
  // strap shift moves the static vector
  const sim = createBeltSim({ sizeMg: 12, rateBpm: 12 })
  const p = createBeltScopeProcessor()
  let now = 1_700_000_000_000
  const feed = (ms) => {
    for (const end = now + ms; now < end; now += 100) {
      for (const pk of sim.packetsUntil(now)) {
        const ts = packetSampleTimes(pk.packetTs, pk.x.length)
        pk.x.forEach((_, i) => p.pushRaw(ts[i], pk.x[i], pk.y[i], pk.z[i]))
      }
    }
  }
  feed(45000)
  const a = p.stats()
  ok(near(a.sizeMg, 12, 1.5), `sim at 12 mg reads ${a.sizeMg.toFixed(1)} mg, ${a.rateBpm.toFixed(1)} bpm, rhythm ${a.rhythm.toFixed(2)}`)
  ok(!a.upsideDown && a.tiltDeg > 5 && a.tiltDeg < 15, `sim upright, tilt ${a.tiltDeg.toFixed(1)}°`)
  sim.size = 5
  feed(45000)
  ok(near(p.stats().sizeMg, 5, 1), `sim at 5 mg reads ${p.stats().sizeMg.toFixed(1)} mg`)
  const g0 = p.stats().staticMg
  sim.shift(25, now)
  feed(15000)
  const g1 = p.stats().staticMg
  const ang = Math.acos((g0[0] * g1[0] + g0[1] * g1[1] + g0[2] * g1[2]) / (Math.hypot(...g0) * Math.hypot(...g1))) * 180 / Math.PI
  ok(near(ang, 25, 2), `sim shift of 25° moves the static vector ${ang.toFixed(1)}°`)
  sim.flip()
  feed(15000)
  ok(p.stats().upsideDown === true, 'sim flip reads upside down')
  const h = p.history(30000)
  ok(h.t.length > 700 && h.t.length < 800, `30 s of history at ~25 Hz: ${h.t.length} points`)
}

// ── 10. Recorder scale: 30 minutes in typed arrays ──────────────────────────
{
  const rec = createRawRecorder()
  const xs = new Array(36).fill(-1000), ys = new Array(36).fill(5), zs = new Array(36).fill(-170)
  const packets = Math.ceil(30 * 60 * H10_ACC_HZ / 36)
  for (let i = 0; i < packets; i++) rec.pushPacket(i * 177, i, xs, ys, zs)
  ok(rec.sampleCount === packets * 36, `30 min recording holds ${rec.sampleCount} samples`)
  const t0 = Date.now()
  const csv = buildAccelCsv(rec)
  ok(csv.split('\n').length === rec.sampleCount + 1, `...and writes ${rec.sampleCount + 1} CSV lines in ${Date.now() - t0} ms (${(csv.length / 1e6).toFixed(1)} MB)`)
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
