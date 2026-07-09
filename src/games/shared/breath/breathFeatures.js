// ── breathFeatures.js ───────────────────────────────────────────────────────
//
// Pure real-time feature extractors for the shared breath-signal layer.
// No React, no hardware — each factory returns a small stateful object that
// is fed samples/events and exposes derived values. Consumed by
// useBreathSignal; usable headless in tests.
//
// Signal conventions (match BreathBelt/breathUtils):
//   breath value: 0 = exhale trough, 1 = inhale peak (clamped)
//   timestamps:   wall-clock ms (Date.now() domain)

// ── Bluetooth HR Measurement characteristic parser ─────────────────────────
// Standard GATT 0x2A37 layout. BreathBelt's original handler read only the
// uint8 HR byte; this also extracts beat-to-beat RR intervals (flags bit 4),
// which the Polar H10 reports at 1/1024 s resolution — the raw material for
// RSA / HRV feedback.

export function parseHrPacket(dv) {
  if (!dv || dv.byteLength < 2) return null
  const flags = dv.getUint8(0)
  let offset = 1
  let hr
  if (flags & 0x01) { hr = dv.getUint16(offset, true); offset += 2 }
  else              { hr = dv.getUint8(offset);        offset += 1 }
  if (flags & 0x08) offset += 2 // energy-expended field present — skip
  const rrMs = []
  if (flags & 0x10) {
    while (offset + 2 <= dv.byteLength) {
      rrMs.push(dv.getUint16(offset, true) * 1000 / 1024)
      offset += 2
    }
  }
  return { hr, rrMs }
}

// ── Phase detector: inhale / exhale / pause ────────────────────────────────
// Classifies the slope of the breath value, normalized by the recent
// signal range so it works regardless of calibration gain. The deadband
// gives hysteresis: phase only flips when the slope clearly crosses the
// opposite threshold, so plateaus (breath holds) read as 'pause'.
//
//   push(t, value) → { phase, transition }
//   transition is null, or { type: 'inhale_start' | 'exhale_start', t }

const SLOPE_THRESHOLD = 0.12 // range-units per second (sine @ 4 s ≈ ±0.78 peak)

export function createPhaseDetector({ slopeWindowMs = 400, rangeWindowMs = 12000 } = {}) {
  const slopeBuf = [] // recent samples for slope estimate
  const rangeBuf = [] // longer window for amplitude normalization
  let phase = 'pause'

  return {
    push(t, value) {
      slopeBuf.push({ t, value })
      while (slopeBuf.length && t - slopeBuf[0].t > slopeWindowMs) slopeBuf.shift()
      rangeBuf.push({ t, value })
      while (rangeBuf.length && t - rangeBuf[0].t > rangeWindowMs) rangeBuf.shift()

      if (slopeBuf.length < 4) return { phase, transition: null }

      let min = Infinity, max = -Infinity
      for (const p of rangeBuf) {
        if (p.value < min) min = p.value
        if (p.value > max) max = p.value
      }
      const range = Math.max(max - min, 1e-6)
      const dtS = (t - slopeBuf[0].t) / 1000
      if (dtS <= 0) return { phase, transition: null }
      const slope = (value - slopeBuf[0].value) / range / dtS

      let next = phase
      if (slope > SLOPE_THRESHOLD)       next = 'inhale'
      else if (slope < -SLOPE_THRESHOLD) next = 'exhale'
      // |slope| below threshold: hold current phase (deadband)

      let transition = null
      if (next !== phase && (next === 'inhale' || next === 'exhale')) {
        transition = { type: next === 'inhale' ? 'inhale_start' : 'exhale_start', t }
      }
      phase = next
      return { phase, transition }
    },
    get phase() { return phase },
  }
}

// ── Rate & regularity tracker ──────────────────────────────────────────────
// Fed inhale-onset timestamps (from the phase detector's transitions).
// Onset-to-onset intervals give breath period; median of recent intervals
// gives a stable bpm; SD of recent intervals gives (ir)regularity in ms.

export function createRateTracker({
  maxIntervals = 6, minPeriodMs = 1500, maxPeriodMs = 15000,
} = {}) {
  let lastOnset = null
  const intervals = []

  return {
    pushOnset(t) {
      if (lastOnset != null) {
        const d = t - lastOnset
        if (d < minPeriodMs) return // spurious double-detection — ignore entirely
        if (d <= maxPeriodMs) {
          intervals.push(d)
          if (intervals.length > maxIntervals) intervals.shift()
        }
        // d > maxPeriodMs: gap too long (pause/dropout) — reset timing, keep history
      }
      lastOnset = t
    },
    get bpm() {
      if (intervals.length < 2) return null
      const s = [...intervals].sort((a, b) => a - b)
      return 60000 / s[Math.floor(s.length / 2)]
    },
    get lastPeriodMs() {
      return intervals.length ? intervals[intervals.length - 1] : null
    },
    // SD of recent breath periods, ms. Lower = steadier breathing.
    get regularitySdMs() {
      if (intervals.length < 3) return null
      const m = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const v = intervals.reduce((a, b) => a + (b - m) * (b - m), 0) / intervals.length
      return Math.sqrt(v)
    },
    // Coefficient of variation (SD / mean period), unitless. Fairer than raw SD
    // across breath rates: a longer period naturally has larger absolute jitter,
    // so absolute SD over-penalizes slow (resonance) breathing. Preferred input
    // for regularity-gated feedback; SD is kept for display/analytics.
    get regularityCv() {
      if (intervals.length < 3) return null
      const m = intervals.reduce((a, b) => a + b, 0) / intervals.length
      if (m <= 0) return null
      const v = intervals.reduce((a, b) => a + (b - m) * (b - m), 0) / intervals.length
      return Math.sqrt(v) / m
    },
  }
}

// ── RSA amplitude ──────────────────────────────────────────────────────────
// Respiratory sinus arrhythmia: how much the heart period swings with the
// breath. Cheap proxy: max−min RR interval over the last window (should span
// 1–3 breaths). Healthy slow breathing at ~6 bpm typically yields large
// swings; values grow as breathing slows toward resonance.
//
// rrPoints: [{ t, rr }] time-ordered; returns ms or null if too few beats.

export function rsaAmplitudeMs(rrPoints, now, windowMs = 12000) {
  let min = Infinity, max = -Infinity, n = 0
  for (let i = rrPoints.length - 1; i >= 0; i--) {
    const p = rrPoints[i]
    if (now - p.t > windowMs) break
    n++
    if (p.rr < min) min = p.rr
    if (p.rr > max) max = p.rr
  }
  return n >= 4 ? max - min : null
}

// ── Signal-quality / explained-variance tracker ────────────────────────────
// The breath signal is a fixed 1-D projection (the calibration weight vector)
// of the filtered x/y/z. This tracks how much of the total tri-axial breathing
// variance still lies along that direction:
//
//   EVR = uᵀΣu / trace(Σ)      u = normalized weights, Σ = rolling covariance
//
// bounded [0,1]. High at calibration; drops when posture/fit change rotates the
// breath's motion onto a different axis mix (the projection then flatlines even
// though the chest is still moving). `totalVar` (= trace Σ) distinguishes that
// from a breath-hold: posture change keeps totalVar high while EVR falls; a
// hold drops both. The same Σ feeds PCA-based background recalibration (its top
// eigenvector is the current best breath axis).

export function createQualityTracker(weights, { windowMs = 15000 } = {}) {
  let ux = 0, uy = 0, uz = 0
  const setDir = (w) => {
    const n = Math.sqrt(w[0]*w[0] + w[1]*w[1] + w[2]*w[2]) || 1
    ux = w[0]/n; uy = w[1]/n; uz = w[2]/n
  }
  setDir(weights)
  const buf = []

  // Rolling 3×3 covariance of the filtered axes over the window; null if sparse.
  function cov() {
    const n = buf.length
    if (n < 60) return null
    let mx = 0, my = 0, mz = 0
    for (const p of buf) { mx += p.fx; my += p.fy; mz += p.fz }
    mx /= n; my /= n; mz /= n
    let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0
    for (const p of buf) {
      const dx = p.fx - mx, dy = p.fy - my, dz = p.fz - mz
      cxx += dx*dx; cxy += dx*dy; cxz += dx*dz
      cyy += dy*dy; cyz += dy*dz; czz += dz*dz
    }
    cxx /= n; cxy /= n; cxz /= n; cyy /= n; cyz /= n; czz /= n
    return { cxx, cxy, cxz, cyy, cyz, czz, trace: cxx + cyy + czz, n }
  }

  // Variance along a unit direction: dᵀΣd
  const varAlong = (c, dx, dy, dz) => {
    const s0 = c.cxx*dx + c.cxy*dy + c.cxz*dz
    const s1 = c.cxy*dx + c.cyy*dy + c.cyz*dz
    const s2 = c.cxz*dx + c.cyz*dy + c.czz*dz
    return dx*s0 + dy*s1 + dz*s2
  }

  // Top eigenvector via power iteration, seeded for fast convergence.
  const topEigen = (c, seed) => {
    let vx = seed[0], vy = seed[1], vz = seed[2]
    const n0 = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1; vx /= n0; vy /= n0; vz /= n0
    for (let i = 0; i < 40; i++) {
      const nx = c.cxx*vx + c.cxy*vy + c.cxz*vz
      const ny = c.cxy*vx + c.cyy*vy + c.cyz*vz
      const nz = c.cxz*vx + c.cyz*vy + c.czz*vz
      const nn = Math.sqrt(nx*nx + ny*ny + nz*nz)
      if (nn < 1e-12) break
      vx = nx/nn; vy = ny/nn; vz = nz/nn
    }
    return [vx, vy, vz]
  }

  return {
    setDirection(w) { setDir(w) },
    getDirection() { return [ux, uy, uz] },
    push(t, fx, fy, fz) {
      buf.push({ t, fx, fy, fz })
      while (buf.length && t - buf[0].t > windowMs) buf.shift()
    },
    // { evr: 0–1 or null, totalVar, n } — null until enough samples.
    stats() {
      const c = cov()
      if (!c) return { evr: null, totalVar: null, n: buf.length }
      if (c.trace < 1e-12) return { evr: null, totalVar: c.trace, n: c.n }
      return { evr: Math.max(0, Math.min(1, varAlong(c, ux, uy, uz) / c.trace)), totalVar: c.trace, n: c.n }
    },
    // Propose an unsupervised re-projection onto the current dominant breath axis
    // (top principal component). Returned as a linear model {bias, weights} that
    // maps the filtered axes to ~0..1 — the same form processPacketMLR consumes,
    // so no change to the live path. Sign is chosen to preserve polarity vs the
    // current direction (no pacer needed); scale/offset from robust percentiles
    // of the recent projection. `evr` = fraction of variance the new axis captures.
    // Returns null if there isn't enough data or no clear oscillation.
    proposeRecal({ pct = 0.1 } = {}) {
      const c = cov()
      if (!c || c.trace < 1e-12) return null
      let [ex, ey, ez] = topEigen(c, [ux, uy, uz])
      const proj = buf.map(p => ex*p.fx + ey*p.fy + ez*p.fz)
      const cur  = buf.map(p => ux*p.fx + uy*p.fy + uz*p.fz)
      // sign continuity: keep positive correlation with the current projection
      const pm = proj.reduce((a, b) => a + b, 0) / proj.length
      const cm = cur.reduce((a, b) => a + b, 0) / cur.length
      let num = 0
      for (let i = 0; i < proj.length; i++) num += (proj[i] - pm) * (cur[i] - cm)
      if (num < 0) { ex = -ex; ey = -ey; ez = -ez; for (let i = 0; i < proj.length; i++) proj[i] = -proj[i] }
      const sorted = [...proj].sort((a, b) => a - b)
      const lo = sorted[Math.floor((sorted.length - 1) * pct)]
      const hi = sorted[Math.floor((sorted.length - 1) * (1 - pct))]
      const range = hi - lo
      if (!(range > 1e-9)) return null
      return {
        weights: [ex/range, ey/range, ez/range],
        bias: -lo/range,
        dir: [ex, ey, ez],
        evr: Math.max(0, Math.min(1, varAlong(c, ex, ey, ez) / c.trace)),
      }
    },
  }
}

// ── Time-windowed history buffer ───────────────────────────────────────────
// Append-only ring trimmed by age. Games read slices for scopes/trails.

export function createHistory(maxAgeMs = 60000) {
  const points = []
  return {
    push(point) {
      points.push(point)
      const cutoff = point.t - maxAgeMs
      // Trim from the front; amortized O(1)
      let drop = 0
      while (drop < points.length && points[drop].t < cutoff) drop++
      if (drop > 0) points.splice(0, drop)
    },
    recent(ms, now = points.length ? points[points.length - 1].t : 0) {
      const cutoff = now - ms
      let i = points.length
      while (i > 0 && points[i - 1].t >= cutoff) i--
      return points.slice(i)
    },
    get all() { return points },
    clear() { points.length = 0 },
  }
}
