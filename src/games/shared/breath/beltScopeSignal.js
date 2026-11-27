// ── beltScopeSignal.js ──────────────────────────────────────────────────────
//
// Pure, React-free signal code for Belt Scope (/belt-scope), the lab's live
// readout of a Polar H10 for experimenting with how the strap is fitted.
// No calibration: everything here works on the raw accelerometer in mg.
// Imports use explicit .js extensions so node can run the tests directly:
//   node src/games/shared/breath/beltScopeSignal.test.mjs
//
// Units and clocks (match the BreathBelt study and its analysis code):
//   raw accel   int16 per axis straight from the PMD frame = mg. The study CSV
//               stores mg / 100 (useBeltConnection reads getInt16 / 100), and so
//               does buildAccelCsv here, so the analysis reads both alike.
//   time        wall-clock ms (Date.now()) at packet arrival = packet_timestamp.
//               The packet time marks its LAST sample; earlier samples are
//               back-assigned at 1000 / 203.4 ms each, the analysis's rule
//               (pkh_sample_ms in the Breathbelt R code).
//   orientation worn upright, gravity lies along -x (static x about -1000 mg).

export const H10_ACC_HZ = 203.4                 // measured H10 rate (nominal 200 Hz)
export const ACC_MS_PER_SAMPLE = 1000 / H10_ACC_HZ
export const DECIMATE = 8                       // raw samples per display/filter sample
export const SCOPE_HZ = H10_ACC_HZ / DECIMATE   // ≈ 25.4 Hz
export const MG_PER_DEG = 1000 * Math.sin(Math.PI / 180)   // 17.45 mg of 1 g ≈ 1°
export const RHYTHM_HZ = 5                      // analysis rate of the rhythm statistic
export const RHYTHM_LAGS_S = [1.5, 10]          // its lag range (PDT_ACF_LAG_S)

// ── Frame parsers ───────────────────────────────────────────────────────────

// Polar PMD accelerometer frame. Same layout and arithmetic as the study's
// parser (useBeltConnection accelHandler) except that the samples stay as raw
// int16 (mg) rather than being divided by 100.
//   bytes 1..8  sensor timestamp of the LAST sample, ns since 2000-01-01
//   byte  9     frame type; sample width = ceil((type + 1) * 8 / 8) bytes
//   bytes 10..  x, y, z per sample
export function parsePmdAccFrame(dv) {
  if (!dv || dv.byteLength < 10) return null
  let devicePacketMicros = NaN
  try {
    if (dv.byteLength >= 9) devicePacketMicros = Number(dv.getBigUint64(1, true) / BigInt(1000))
  } catch { /* the timestamp is additive; never fail the frame over it */ }
  const frameType = dv.getInt8(9)
  const step = Math.ceil(((frameType + 1) * 8) / 8)
  const x = [], y = [], z = []
  let offset = 10
  while (offset + 3 * step <= dv.byteLength) {
    x.push(dv.getInt16(offset, true))
    y.push(dv.getInt16(offset + step, true))
    z.push(dv.getInt16(offset + 2 * step, true))
    offset += 3 * step
  }
  if (!x.length) return null
  return { devicePacketMicros, frameType, x, y, z }
}

// GATT 0x2A37 heart-rate measurement, the study's row shape (useBeltConnection
// hrHandler): heartRate -1 when unreadable, rrIntervals1024 = raw 1/1024 s
// ticks joined with ';', contactStatus = flag bits 1-2 (3 = skin contact).
export function parseHrRaw(dv) {
  const row = { heartRate: -1, rrIntervals1024: '', contactStatus: -1, rrMs: [] }
  try {
    if (dv && dv.byteLength >= 2) {
      const flags = dv.getUint8(0)
      const hr16 = (flags & 0x01) !== 0
      const hasEnergy = (flags & 0x08) !== 0
      const hasRR = (flags & 0x10) !== 0
      row.contactStatus = (flags >> 1) & 0x03
      row.heartRate = hr16 ? dv.getUint16(1, true) : dv.getUint8(1)
      let off = hr16 ? 3 : 2
      if (hasEnergy) off += 2
      if (hasRR) {
        const rr = []
        for (; off + 1 < dv.byteLength; off += 2) rr.push(dv.getUint16(off, true))
        row.rrIntervals1024 = rr.join(';')
        row.rrMs = rr.map(t => t * 1000 / 1024)
      }
    }
  } catch { /* a bad packet logs as -1, as in the study */ }
  return row
}

// Sample times for one packet: the arrival time marks the last sample.
export function packetSampleTimes(packetTs, n, msPerSample = ACC_MS_PER_SAMPLE) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = packetTs - (n - 1 - i) * msPerSample
  return out
}

// ── Filters ─────────────────────────────────────────────────────────────────

// Second-order Butterworth section (RBJ cookbook, Q = 1/√2), direct form II
// transposed, causal. reset(u) puts it in steady state for a constant input u,
// so the first sample (1 g of gravity) does not ring through the high-pass.
export function createBiquad(type, fc, fs) {
  const w0 = 2 * Math.PI * fc / fs
  const cw = Math.cos(w0), sw = Math.sin(w0)
  const alpha = sw / (2 * Math.SQRT1_2)
  const a0 = 1 + alpha
  let b0, b1, b2
  if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2 }
  else if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2 }
  else throw new Error(`unknown biquad type ${type}`)
  const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0
  const A1 = (-2 * cw) / a0, A2 = (1 - alpha) / a0
  const dcGain = (B0 + B1 + B2) / (1 + A1 + A2)
  let z1 = 0, z2 = 0, primed = false
  const f = {
    reset(u) {
      const y = dcGain * u
      z2 = B2 * u - A2 * y
      z1 = y - B0 * u
      primed = true
    },
    step(x) {
      if (!primed) f.reset(x)
      const y = B0 * x + z1
      z1 = B1 * x - A1 * y + z2
      z2 = B2 * x - A2 * y
      return y
    },
  }
  return f
}

// Breathing band-pass: 2nd-order high-pass then 2nd-order low-pass.
export const BREATH_BAND_HZ = [0.05, 0.7]
export function createBandpass(fs = SCOPE_HZ, [lo, hi] = BREATH_BAND_HZ) {
  const hp = createBiquad('highpass', lo, fs)
  const lp = createBiquad('lowpass', hi, fs)
  return { step: (x) => lp.step(hp.step(x)) }
}

// Running mean over the last n samples (ring buffer + running sum).
export function createRunningMean(n) {
  const buf = new Float64Array(n)
  let len = 0, head = 0, sum = 0
  return {
    push(v) {
      if (len === n) sum -= buf[head]; else len++
      buf[head] = v; sum += v
      head = (head + 1) % n
      return sum / len
    },
    get mean() { return len ? sum / len : NaN },
    get length() { return len },
  }
}

// Averages every `factor` raw samples into one (box-car anti-alias, then keep).
// Output time = the last raw sample's time in the group.
export function createDecimator(factor = DECIMATE) {
  let n = 0, sx = 0, sy = 0, sz = 0
  return {
    push(t, x, y, z) {
      sx += x; sy += y; sz += z; n++
      if (n < factor) return null
      const out = { t, x: sx / n, y: sy / n, z: sz / n }
      n = 0; sx = 0; sy = 0; sz = 0
      return out
    },
  }
}

// ── 3×3 covariance + power iteration ────────────────────────────────────────

// Covariance of the three columns (arrays of equal length), as a flat 9-array.
export function covariance3(X, Y, Z, n = X.length) {
  let mx = 0, my = 0, mz = 0
  for (let i = 0; i < n; i++) { mx += X[i]; my += Y[i]; mz += Z[i] }
  mx /= n; my /= n; mz /= n
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0
  for (let i = 0; i < n; i++) {
    const a = X[i] - mx, b = Y[i] - my, c = Z[i] - mz
    xx += a * a; xy += a * b; xz += a * c; yy += b * b; yz += b * c; zz += c * c
  }
  const d = n > 1 ? n - 1 : 1
  return [xx / d, xy / d, xz / d, xy / d, yy / d, yz / d, xz / d, yz / d, zz / d]
}

const mul3 = (C, v) => [
  C[0] * v[0] + C[1] * v[1] + C[2] * v[2],
  C[3] * v[0] + C[4] * v[1] + C[5] * v[2],
  C[6] * v[0] + C[7] * v[1] + C[8] * v[2],
]
const norm3 = (v) => Math.hypot(v[0], v[1], v[2])
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Top eigenvector of a symmetric 3×3 matrix by power iteration. Seeds from the
// previous direction and from each axis (so a seed that happens to be
// orthogonal to the answer cannot trap it) and keeps the best Rayleigh
// quotient. Sign continuity: the result is flipped if it points away from
// `prevDir`, so the projected signal never inverts when the direction updates.
export function topEigen3(C, prevDir = null, iters = 60) {
  const seeds = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  if (prevDir && norm3(prevDir) > 0) seeds.unshift(prevDir)
  let best = null, bestLam = -Infinity
  for (const s of seeds) {
    let v = s.slice()
    let nv = norm3(v)
    v = v.map(c => c / nv)
    for (let k = 0; k < iters; k++) {
      const w = mul3(C, v)
      nv = norm3(w)
      if (!(nv > 0)) break
      const next = w.map(c => c / nv)
      const delta = Math.abs(1 - Math.abs(dot3(next, v)))
      v = next
      if (delta < 1e-14) break
    }
    const lam = dot3(v, mul3(C, v))
    if (lam > bestLam + 1e-12) { bestLam = lam; best = v }
  }
  if (prevDir && dot3(best, prevDir) < 0) best = best.map(c => -c)
  const trace = C[0] + C[4] + C[8]
  return { dir: best, lambda: bestLam, trace, share: trace > 0 ? Math.max(0, Math.min(1, bestLam / trace)) : NaN }
}

// ── Readout statistics ──────────────────────────────────────────────────────

export function sd(a) {
  const n = a.length
  if (n < 2) return NaN
  let m = 0
  for (let i = 0; i < n; i++) m += a[i]
  m /= n
  let s = 0
  for (let i = 0; i < n; i++) s += (a[i] - m) ** 2
  return Math.sqrt(s / (n - 1))
}

// Breathing size. PEAK amplitude (half the peak-to-peak) of a sine with the
// same SD: √2 · SD. This is the analysis's convention (pnz_amp_mg = √(2S),
// "mg, peak, i.e. half the peak-to-peak"), which is where the 15 mg / 7 mg
// reference figures come from, so the readout is comparable to them.
export function breathSizeMg(combined) {
  const s = sd(combined)
  return Number.isFinite(s) ? Math.SQRT2 * s : NaN
}

// The tilt that amplitude corresponds to: a change of a mg across 1 g.
export function mgToTiltDeg(mg) {
  if (!Number.isFinite(mg)) return NaN
  return Math.asin(Math.min(1, Math.abs(mg) / 1000)) * 180 / Math.PI
}

// Resample a uniformly sampled series from fsIn to fsOut by linear interpolation.
export function resampleLinear(a, fsIn, fsOut) {
  const n = a.length
  if (n < 2) return a.slice()
  const ratio = fsIn / fsOut
  const m = Math.floor((n - 1) / ratio) + 1
  const out = new Array(m)
  for (let j = 0; j < m; j++) {
    const p = j * ratio
    const i = Math.floor(p), f = p - i
    out[j] = i + 1 < n ? a[i] * (1 - f) + a[i + 1] * f : a[n - 1]
  }
  return out
}

// Rhythm: the analysis's detection statistic (pdt_acf in the Breathbelt R code).
// Biased autocorrelation, R(k) = Σ_{i<n-k} x_i x_{i+k} / Σ x_i² (demeaned), at
// lags of 1.5 to 10 s (at most n − 2 samples) at 5 Hz. The statistic is the
// height of the FIRST local maximum in that range, and its lag (refined by a
// parabola, clamped to ±half a sample) is the breath period. 0 and no lag when
// there is no local maximum. Sign-invariant.
export function rhythmAcf(x, fs = RHYTHM_HZ, lagS = RHYTHM_LAGS_S) {
  const n = x.length
  const none = { rhythm: 0, periodS: NaN }
  if (n < 4) return none
  let m = 0
  for (let i = 0; i < n; i++) m += x[i]
  m /= n
  const d = new Float64Array(n)
  let r0 = 0
  for (let i = 0; i < n; i++) { d[i] = x[i] - m; r0 += d[i] * d[i] }
  if (!(r0 > 0)) return none
  const lo = Math.round(lagS[0] * fs)
  const hi = Math.min(Math.round(lagS[1] * fs), n - 2)
  if (hi - lo + 1 < 3) return none
  const R = []
  for (let k = lo; k <= hi; k++) {
    let s = 0
    for (let i = 0; i + k < n; i++) s += d[i] * d[i + k]
    R.push(s / r0)
  }
  for (let j = 1; j < R.length - 1; j++) {
    // a peak at j: the slope's sign falls between j-1 → j and j → j+1
    if (Math.sign(R[j] - R[j - 1]) - Math.sign(R[j + 1] - R[j]) > 0) {
      const y0 = R[j - 1], y1 = R[j], y2 = R[j + 1]
      const den = y0 - 2 * y1 + y2
      const dl = den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / den)) : 0
      return { rhythm: y1, periodS: (lo + j + dl) / fs }
    }
  }
  return none
}

// Breathing rate by upward zero-crossings with hysteresis (±0.3 SD), the
// crossing time interpolated linearly. This is the rate Belt Scope shows; the
// autocorrelation lag (rhythmAcf) is kept beside it for comparison.
export function rateZeroCrossBpm(x, fs) {
  const s = sd(x)
  if (!(s > 0)) return NaN
  let m = 0
  for (const v of x) m += v
  m /= x.length
  const h = 0.3 * s
  let armed = false
  const ups = []
  for (let i = 1; i < x.length; i++) {
    const a = x[i - 1] - m, b = x[i] - m
    if (b < -h) armed = true
    if (armed && a < 0 && b >= 0) {
      ups.push((i - 1 + (-a) / (b - a)) / fs)
      armed = false
    }
  }
  if (ups.length < 3) return NaN
  return 60 * (ups.length - 1) / (ups[ups.length - 1] - ups[0])
}

// ── Orientation ─────────────────────────────────────────────────────────────

// Tilt of the strap from upright: the angle between the static gravity vector
// and -x (the analysis's POR_DOWN = c(-1, 0, 0)).
export function tiltFromVerticalDeg(g) {
  const n = norm3(g)
  if (!(n > 0)) return NaN
  return Math.acos(Math.max(-1, Math.min(1, -g[0] / n))) * 180 / Math.PI
}

// Upside down when the static x is positive (the analysis's upside_down = g[1] > 0).
export const isUpsideDown = (g) => Number.isFinite(g?.[0]) && g[0] > 0

// ── The live processor ──────────────────────────────────────────────────────
//
// Feed it raw samples (mg) with their times; it decimates to ~25 Hz and keeps
// everything the page draws and reads out.
//   pushRaw(t, x, y, z)
//   history(windowMs) → { t[], dx[], dy[], dz[], c[] }   newest last
//   stats()           → readout chips (see below)
export function createBeltScopeProcessor({
  fs = SCOPE_HZ, meanS = 10, pcaS = 20, statsS = 30, historyS = 65,
  dirEverySamples = 6, upsideHoldMs = 3000,
} = {}) {
  const dec = createDecimator(DECIMATE)
  const means = [0, 1, 2].map(() => createRunningMean(Math.round(meanS * fs)))
  const bps = [0, 1, 2].map(() => createBandpass(fs))
  const nPca = Math.round(pcaS * fs)
  const pca = [new Float64Array(nPca), new Float64Array(nPca), new Float64Array(nPca)]
  let pcaLen = 0, pcaHead = 0
  const nStats = Math.round(statsS * fs)
  const comb = new Float64Array(nStats)
  let combLen = 0, combHead = 0
  const nHist = Math.round(historyS * fs)
  const H = { t: new Float64Array(nHist), dx: new Float64Array(nHist), dy: new Float64Array(nHist), dz: new Float64Array(nHist), c: new Float64Array(nHist) }
  let histLen = 0, histHead = 0
  let dir = null, share = NaN, sinceDir = 0, lastT = -Infinity, count = 0
  let positiveSince = null, upsideDown = false
  const pcaMin = Math.round(3 * fs)

  function pushDecimated(t, x, y, z) {
    // keep the display clock monotonic even if packet arrival jitters
    if (t <= lastT) t = lastT + 0.001
    lastT = t
    count++
    const v = [x, y, z]
    const m = v.map((val, i) => means[i].push(val))
    const b = v.map((val, i) => bps[i].step(val))
    for (let i = 0; i < 3; i++) pca[i][pcaHead] = b[i]
    pcaHead = (pcaHead + 1) % nPca
    if (pcaLen < nPca) pcaLen++

    if (++sinceDir >= dirEverySamples && pcaLen >= pcaMin) {
      sinceDir = 0
      const C = covariance3(pca[0], pca[1], pca[2], pcaLen)
      const e = topEigen3(C, dir)
      dir = e.dir; share = e.share
    }
    const c = dir ? dot3(dir, b) : 0
    comb[combHead] = c
    combHead = (combHead + 1) % nStats
    if (combLen < nStats) combLen++

    H.t[histHead] = t; H.dx[histHead] = x - m[0]; H.dy[histHead] = y - m[1]; H.dz[histHead] = z - m[2]; H.c[histHead] = c
    histHead = (histHead + 1) % nHist
    if (histLen < nHist) histLen++

    if (m[0] > 0) {
      if (positiveSince == null) positiveSince = t
      upsideDown = t - positiveSince >= upsideHoldMs
    } else { positiveSince = null; upsideDown = false }
  }

  function ringToArray(buf, len, head, cap) {
    const out = new Array(len)
    const start = (head - len + cap) % cap
    for (let i = 0; i < len; i++) out[i] = buf[(start + i) % cap]
    return out
  }

  return {
    pushRaw(t, x, y, z) {
      const d = dec.push(t, x, y, z)
      if (d) pushDecimated(d.t, d.x, d.y, d.z)
    },
    pushDecimated,
    get sampleCount() { return count },
    get direction() { return dir },
    history(windowMs = 30000) {
      const out = { t: [], dx: [], dy: [], dz: [], c: [] }
      if (!histLen) return out
      const start = (histHead - histLen + nHist) % nHist
      const newest = H.t[(histHead - 1 + nHist) % nHist]
      for (let i = 0; i < histLen; i++) {
        const k = (start + i) % nHist
        if (newest - H.t[k] > windowMs) continue
        out.t.push(H.t[k]); out.dx.push(H.dx[k]); out.dy.push(H.dy[k]); out.dz.push(H.dz[k]); out.c.push(H.c[k])
      }
      return out
    },
    // Readouts. null fields until there is enough signal (10 s of combined).
    stats() {
      const g = means.map(mm => mm.mean)
      const base = {
        staticMg: g, tiltDeg: tiltFromVerticalDeg(g), upsideDown, xPositive: isUpsideDown(g),
        share, direction: dir,
        sizeMg: NaN, sizeTiltDeg: NaN, rhythm: NaN, rateBpm: NaN, rateAcfBpm: NaN, seconds: combLen / fs,
      }
      if (combLen < Math.round(10 * fs) || !dir) return base
      const c = ringToArray(comb, combLen, combHead, nStats)
      const sizeMg = breathSizeMg(c)
      const r = rhythmAcf(resampleLinear(c, fs, RHYTHM_HZ))
      return {
        ...base,
        sizeMg, sizeTiltDeg: mgToTiltDeg(sizeMg),
        rhythm: r.rhythm,
        // The readout uses zero crossings: on the synthetic checks it was the
        // closer of the two (max error 0.2 vs 0.4 bpm) and, unlike the
        // autocorrelation lag, it still reads breathing slower than 6 bpm.
        rateBpm: rateZeroCrossBpm(c, fs),
        rateAcfBpm: Number.isFinite(r.periodS) ? 60 / r.periodS : NaN,
      }
    },
  }
}

// ── Recording (raw, in memory, chunked typed arrays) ────────────────────────
//
// 30 minutes at 203 Hz is ~366k samples; one object per sample would be
// ~100 MB of heap. Chunks of typed arrays hold it in ~9 MB.

const CHUNK = 65536

export function createRawRecorder() {
  let chunks = []
  let total = 0
  let hr = []
  const newChunk = () => ({
    x: new Int16Array(CHUNK), y: new Int16Array(CHUNK), z: new Int16Array(CHUNK),
    ts: new Float64Array(CHUNK), idx: new Uint16Array(CHUNK), dev: new Float64Array(CHUNK), n: 0,
  })
  return {
    pushPacket(packetTs, devicePacketMicros, xs, ys, zs) {
      for (let i = 0; i < xs.length; i++) {
        let c = chunks[chunks.length - 1]
        if (!c || c.n === CHUNK) { c = newChunk(); chunks.push(c) }
        const k = c.n++
        c.x[k] = xs[i]; c.y[k] = ys[i]; c.z[k] = zs[i]
        c.ts[k] = packetTs; c.idx[k] = i; c.dev[k] = devicePacketMicros
        total++
      }
    },
    pushHr(row) { hr.push(row) },
    get sampleCount() { return total },
    get hrCount() { return hr.length },
    clear() { chunks = []; total = 0; hr = [] },
    // Iterate samples in order: cb(packetTs, sampleIndex, x, y, z, devUs)
    forEach(cb) {
      for (const c of chunks) for (let k = 0; k < c.n; k++) cb(c.ts[k], c.idx[k], c.x[k], c.y[k], c.z[k], c.dev[k])
    },
    hrRows() { return hr.slice() },
  }
}

// ── CSV writers: the study's layouts, byte for byte ─────────────────────────
//
// useBeltSession.js builds the study's _accel.csv and _hr.csv. These reproduce
// its header, column order, number formatting (fmtNum: toFixed(4), blank for
// null/NaN; fmtInt: Math.trunc, blank for NaN), the mg / 100 scaling the study
// row carries, and its `${header}\n${body}` shape (no trailing newline).
// beltScopeSignal.test.mjs checks them against the study's own functions.

const fmtNum = (v, digits = 4) => (v == null || Number.isNaN(v)) ? '' : Number(v).toFixed(digits)
const fmtInt = (v) => (v == null || Number.isNaN(v)) ? '' : String(Math.trunc(v))

export const ACCEL_HEADER = 'phase,trial,packet_timestamp,sample_index,x,y,z,pacer_radius,device_packet_us'
export const HR_HEADER = 'phase,trial,timestamp,heart_rate,rr_intervals_1024,contact_status'
export const LABELS_HEADER = 'timestamp,elapsed_s,label'

// phase 'belt_scope'; trial -1, which is what the study writes outside trials
// (currentTrialRef idles at -1); pacer_radius blank, as the study writes when
// no pacer is running (its getPacerRadius default returns NaN).
export function buildAccelCsv(recorder, { phase = 'belt_scope', trial = -1 } = {}) {
  const lines = []
  recorder.forEach((ts, idx, x, y, z, dev) => {
    lines.push([phase, trial, ts, idx, fmtNum(x / 100), fmtNum(y / 100), fmtNum(z / 100), fmtNum(NaN), fmtInt(dev)].join(','))
  })
  return `${ACCEL_HEADER}\n${lines.join('\n')}`
}

export function buildHrCsv(rows, { phase = 'belt_scope', trial = -1 } = {}) {
  const body = rows.map(r =>
    [phase, trial, r.timestamp, r.heartRate, r.rrIntervals1024 ?? '', r.contactStatus ?? -1].join(',')
  ).join('\n')
  return `${HR_HEADER}\n${body}`
}

const csvCell = (s) => /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s

export function buildLabelsCsv(labels, startMs) {
  const body = labels.map(l =>
    [l.t, ((l.t - startMs) / 1000).toFixed(3), csvCell(String(l.text))].join(',')
  ).join('\n')
  return `${LABELS_HEADER}\n${body}`
}

// "Norm test #3" → "Norm-test-3". Letters, digits, - and _ only; 60 chars max.
export function sanitizeName(name) {
  const s = String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 60)
  return s || 'belt-scope'
}

// Local time as YYYYMMDD-HHMMSS.
export function fileStamp(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// ── Simulator ───────────────────────────────────────────────────────────────
//
// A fake H10 for ?sim=1: gravity plus breathing along an axis at right angles
// to it, a small heartbeat ripple, sensor noise, quantised to whole mg like the
// real stream, in ~36-sample packets. shift() rotates gravity and the breathing
// axis together, the way a strap that has moved would; flip() turns the pod
// upside down.

const POLAR_EPOCH_MS = Date.UTC(2000, 0, 1)

function rotate(v, axis, deg) {
  const a = deg * Math.PI / 180
  const n = norm3(axis); const k = axis.map(c => c / n)
  const c = Math.cos(a), s = Math.sin(a)
  const kxv = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
  const kdv = dot3(k, v)
  return [0, 1, 2].map(i => v[i] * c + kxv[i] * s + k[i] * kdv * (1 - c))
}

export function createBeltSim({ seed = 7, sizeMg = 12, rateBpm = 12, noiseMg = 1.5, hz = H10_ACC_HZ } = {}) {
  let rnd = seed >>> 0
  const rand = () => {   // mulberry32
    rnd = (rnd + 0x6D2B79F5) >>> 0
    let t = rnd
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
  // Worn upright, tilted ~10° forward; breathing tilts it fore-aft.
  let g = [-985, 40, -170]
  let u = [0.17, 0.05, 0.98]
  { const gn = norm3(g); const gh = g.map(c => c / gn); const p = dot3(u, gh); u = u.map((c, i) => c - p * gh[i]); const un = norm3(u); u = u.map(c => c / un) }
  let size = sizeMg, rate = rateBpm
  let phase = 0, hbPhase = 0
  let transientUntil = -Infinity, transientStart = 0
  let sampleClock = null   // device time of the next sample, ms
  const msPer = 1000 / hz

  const sim = {
    set size(v) { size = Math.max(0, v) }, get size() { return size },
    set rate(v) { rate = Math.max(2, Math.min(40, v)) }, get rate() { return rate },
    shift(deg = 20, now = Date.now()) {
      const axis = [rand() - 0.5, rand() - 0.5, rand() - 0.5]
      g = rotate(g, axis, deg); u = rotate(u, axis, deg)
      transientStart = now; transientUntil = now + 1200
    },
    flip() { g = [-g[0], -g[1], g[2]]; u = [-u[0], -u[1], u[2]] },
    get gravity() { return g.slice() },
    // Emit the packets due up to `now` (wall ms). Each packet arrives "now".
    packetsUntil(now, perPacket = 36) {
      if (sampleClock == null) sampleClock = now - perPacket * msPer
      if (now - sampleClock > 3000) sampleClock = now - 3000      // background-tab catch-up cap
      const out = []
      while (now - sampleClock >= perPacket * msPer) {
        const x = [], y = [], z = []
        for (let i = 0; i < perPacket; i++) {
          const t = sampleClock + i * msPer
          phase += 2 * Math.PI * (rate / 60) / hz
          hbPhase += 2 * Math.PI * (68 / 60) / hz
          const b = size * Math.sin(phase)
          const hb = 2.5 * Math.exp(-((hbPhase % (2 * Math.PI)) ** 2) * 40)
          let tr = 0
          if (t >= transientStart && t < transientUntil) tr = 60 * Math.sin(2 * Math.PI * (t - transientStart) / 400) * Math.exp(-(t - transientStart) / 400)
          const v = [0, 1, 2].map(k => g[k] + b * u[k] + hb * (k === 2 ? 1 : 0.3) + tr * (k === 1 ? 1 : 0.5) + noiseMg * gauss())
          x.push(Math.round(v[0])); y.push(Math.round(v[1])); z.push(Math.round(v[2]))
        }
        sampleClock += perPacket * msPer
        const lastSampleMs = sampleClock - msPer
        out.push({ packetTs: Math.round(now), devicePacketMicros: Math.round((lastSampleMs - POLAR_EPOCH_MS) * 1000), frameType: 1, x, y, z })
      }
      return out
    },
    // One HR notification's worth (the study's row shape, minus phase/trial).
    hrRow(now) {
      const hr = Math.round(66 + 6 * Math.sin(phase))
      const ticks = Math.round(60000 / hr * 1.024)
      return { timestamp: now, heartRate: hr, rrIntervals1024: String(ticks), contactStatus: 3, rrMs: [ticks * 1000 / 1024] }
    },
  }
  return sim
}
