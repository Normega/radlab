// ── mirrorCalibration.js ────────────────────────────────────────────────────
//
// Pure, React-free primitives for the "Mirror" interaction:
//
//   1. createAmplitudeRanger — live auto-ranging of the breath value. Keeps the
//      calibrated axis (direction) but re-derives the 0..1 gain/offset from
//      rolling robust percentiles of the raw projection, so a breath-driven
//      pulse always uses the full visual range and self-heals depth drift
//      (population tidal depth varies widely and wanders within a session).
//      Fixes the frozen-gain clamping that a fixed calibration mapping suffers.
//
//   2. createCalibrationMonitor — a composite calibration-confidence engine.
//      Confidence is the geometric mean of four independent sub-scores, gated
//      by two artifact checks. The geometric mean is a soft AND: one bad factor
//      tanks the whole score, which is what a *trustworthy* calibration wants.
//      The same decomposition names the failure — the weakest factor routes the
//      coaching prompt — and drives the avatar's materialization (opacity = C).
//
// Signal conventions match breathFeatures/breathUtils:
//   proj  = the belt model's projection of the filtered axes (pre-clamp), the
//           raw material for the 0..1 breath value.
//   pacer = the paced avatar's reference waveform, 0 (exhale) .. 1 (inhale).
//   fx/fy/fz = the bandpassed accelerometer axes (for covariance / PCA).
//   timestamps = wall-clock ms.
//
// All thresholds are first guesses meant to be dialed in live on /dev/breath-lab
// against a real belt; they are gathered at the top of each factory.

// ── small helpers ───────────────────────────────────────────────────────────

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v }

// Linear ramp: x ≤ lo → 0, x ≥ hi → 1, linear between. Maps a raw metric onto a
// 0..1 confidence contribution with an explicit floor and ceiling.
function ramp(x, lo, hi) {
  if (x == null || !isFinite(x)) return 0
  if (hi === lo) return x >= hi ? 1 : 0
  return clamp01((x - lo) / (hi - lo))
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null
  const i = Math.floor((sortedAsc.length - 1) * p)
  return sortedAsc[i]
}

function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0 }

function std(a) {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length)
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 4) return 0
  const am = mean(a.slice(0, n)), bm = mean(b.slice(0, n))
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const ai = a[i] - am, bi = b[i] - bm
    num += ai * bi; da += ai * ai; db += bi * bi
  }
  return da * db > 0 ? num / Math.sqrt(da * db) : 0
}

// 3×3 covariance of the filtered axes over a set of {fx,fy,fz} rows.
function covariance(rows) {
  const n = rows.length
  if (n < 2) return null
  let mx = 0, my = 0, mz = 0
  for (const p of rows) { mx += p.fx; my += p.fy; mz += p.fz }
  mx /= n; my /= n; mz /= n
  let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0
  for (const p of rows) {
    const dx = p.fx - mx, dy = p.fy - my, dz = p.fz - mz
    cxx += dx * dx; cxy += dx * dy; cxz += dx * dz
    cyy += dy * dy; cyz += dy * dz; czz += dz * dz
  }
  cxx /= n; cxy /= n; cxz /= n; cyy /= n; cyz /= n; czz /= n
  return { cxx, cxy, cxz, cyy, cyz, czz, trace: cxx + cyy + czz }
}

// Top eigenvector (unit) of a covariance via power iteration; returns its
// eigenvalue too (variance captured along it).
function topEigen(c, seed = [1, 0, 0]) {
  let vx = seed[0], vy = seed[1], vz = seed[2]
  const n0 = Math.hypot(vx, vy, vz) || 1; vx /= n0; vy /= n0; vz /= n0
  let lambda = 0
  for (let i = 0; i < 60; i++) {
    const nx = c.cxx * vx + c.cxy * vy + c.cxz * vz
    const ny = c.cxy * vx + c.cyy * vy + c.cyz * vz
    const nz = c.cxz * vx + c.cyz * vy + c.czz * vz
    lambda = Math.hypot(nx, ny, nz)
    if (lambda < 1e-12) break
    vx = nx / lambda; vy = ny / lambda; vz = nz / lambda
  }
  return { vec: [vx, vy, vz], lambda }
}

// Angle (deg) between two directions, treating v and −v as identical (an axis,
// not an arrow) — eigenvector sign is arbitrary.
function axisAngleDeg(a, b) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])
  const na = Math.hypot(...a), nb = Math.hypot(...b)
  if (na < 1e-9 || nb < 1e-9) return 90
  return Math.acos(clamp01(dot / (na * nb))) * 180 / Math.PI
}

// Local maxima of a {t,v} series, min-separated in time. Used for rhythm checks.
function findPeaks(pts, minSepMs) {
  const peaks = []
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].v > pts[i - 1].v && pts[i].v >= pts[i + 1].v) {
      if (!peaks.length || pts[i].t - peaks[peaks.length - 1].t > minSepMs) peaks.push(pts[i])
    }
  }
  return peaks
}

// ── 1. Live amplitude auto-ranger ───────────────────────────────────────────
//
// Feed it the raw (pre-clamp) projection each sample; periodically call
// recompute() to refresh the 5th/95th-percentile band; normalize() maps a raw
// value onto 0..1 against the current band. Keeps the calibrated *direction*;
// only the amplitude mapping adapts.

export function createAmplitudeRanger({
  windowMs = 30000,   // rolling window the percentile band is drawn from
  pct      = 0.05,    // robust low/high percentiles (5th / 95th)
  minRange = 0.05,    // ignore a band narrower than this (noise, not breath)
  minCount = 40,      // need this many samples before ranging (else pass through)
} = {}) {
  const buf = []
  let lo = 0, hi = 1, ready = false

  return {
    push(t, raw) {
      if (raw == null || !isFinite(raw)) return
      buf.push({ t, v: raw })
      while (buf.length && t - buf[0].t > windowMs) buf.shift()
    },
    recompute() {
      if (buf.length < minCount) return
      const sorted = buf.map(p => p.v).sort((a, b) => a - b)
      const nlo = percentile(sorted, pct)
      const nhi = percentile(sorted, 1 - pct)
      if (nhi - nlo >= minRange) { lo = nlo; hi = nhi; ready = true }
    },
    normalize(raw) {
      if (!ready || raw == null) return clamp01(raw)     // pass through until ranged
      return clamp01((raw - lo) / (hi - lo))
    },
    reset() { buf.length = 0; lo = 0; hi = 1; ready = false },
    get ready() { return ready },
    get band() { return { lo, hi } },
  }
}

// ── 2. Calibration-confidence monitor ───────────────────────────────────────
//
// push(t, { fx, fy, fz, proj, pacer }) each processed sample during BREATHE.
// assess(now) → {
//   confidence,                     // composite 0..1 (smoothed) — drive avatar opacity
//   sub: { tracking, clarity, lock, strength },  // 0..1 factors
//   gates: { rhythm, motion },      // booleans (true = passing)
//   weakest,                        // key of the weakest factor / failing gate
//   coach,                          // prompt string for `weakest` (null if confident)
//   breaths,                        // breaths seen so far (peak count)
//   ready,                          // enough data to trust `assess` at all
// }

const COACH = {
  strength: "We can barely see your breath — check the strap is snug and the electrodes are damp.",
  clarity:  "Try breathing a little deeper, down into your belly.",
  lock:     "Let your shoulders relax and settle in — small movements confuse the signal.",
  rhythm:   "Breathe in an easy, even rhythm — no need to hold or push.",
  motion:   "Looks like a bit of movement there — settle, and it'll come back.",
  tracking: "Breathe in as the figure grows, out as it fades.",
}

export function createCalibrationMonitor({
  assessWindowMs = 10000,   // recent window each factor is computed over
  smoothTau      = 0.35,    // EMA smoothing of the composite (0..1 per assess)
  minSamples     = 120,     // ~5 s at 25 Hz before assess is trustworthy
  // factor ramps (raw metric → 0..1)
  trackingRamp   = [0.50, 0.88],   // Pearson r vs pacer
  clarityRamp    = [0.55, 0.90],   // EVR (variance captured by top axis)
  lockRampDeg    = [22, 5],        // axis angle between window halves (note: hi<lo → inverted)
  strengthRamp   = [3, 12],        // breath-excursion / noise-floor ratio
  // gates
  rhythmCvMax    = 0.35,           // max CV of inter-peak intervals to pass
  rhythmBpm      = [7, 26],        // plausible natural-breathing band
  gatePenalty    = 0.45,           // multiply confidence by this when a gate fails
  motionTvMult   = 6,              // totalVar spike above this × its own median = motion
} = {}) {
  const buf = []            // { t, fx, fy, fz, proj, pacer }
  const tvHistory = []      // rolling per-assess totalVar, for a self-referential motion baseline
  let smoothed = 0
  let lastAxis = null

  const recent = (now) => {
    const lo = now - assessWindowMs
    let i = buf.length
    while (i > 0 && buf[i - 1].t >= lo) i--
    return buf.slice(i)
  }

  return {
    push(t, s) {
      if (s == null) return
      buf.push({ t, fx: s.fx, fy: s.fy, fz: s.fz, proj: s.proj, pacer: s.pacer })
      // keep a generous tail (two assess windows) so half/half axis-lock works
      while (buf.length && t - buf[0].t > assessWindowMs * 2) buf.shift()
    },

    assess(now) {
      const w = recent(now)
      const ready = w.length >= minSamples
      const blank = {
        confidence: smoothed, sub: { tracking: 0, clarity: 0, lock: 0, strength: 0 },
        gates: { rhythm: false, motion: true }, weakest: 'strength', coach: COACH.strength,
        breaths: 0, ready: false,
      }
      if (!ready) return blank

      // ── tracking: correlation with the paced avatar ──
      const proj  = w.map(p => p.proj)
      const pacer = w.map(p => p.pacer)
      const r = Math.abs(pearson(proj, pacer))
      const tracking = ramp(r, trackingRamp[0], trackingRamp[1])

      // ── clarity: EVR = λ1 / traceΣ over the window ──
      const c = covariance(w)
      let clarity = 0, axis = lastAxis || [1, 0, 0]
      if (c && c.trace > 1e-12) {
        const e = topEigen(c, axis)
        axis = e.vec
        clarity = ramp(e.lambda / c.trace, clarityRamp[0], clarityRamp[1])
      }

      // ── lock: how much the breath axis has settled (angle between halves) ──
      const mid = Math.floor(w.length / 2)
      const cA = covariance(w.slice(0, mid)), cB = covariance(w.slice(mid))
      let lock = 0, angle = 90
      if (cA && cB && cA.trace > 1e-12 && cB.trace > 1e-12) {
        const eA = topEigen(cA, axis), eB = topEigen(cB, axis)
        angle = axisAngleDeg(eA.vec, eB.vec)
        // lockRampDeg is [lo,hi] with hi<lo (smaller angle = better): invert the ramp
        lock = 1 - ramp(angle, lockRampDeg[1], lockRampDeg[0])
      }
      lastAxis = axis

      // ── strength: breath excursion vs high-frequency noise floor ──
      const sortedProj = [...proj].sort((a, b) => a - b)
      const excursion = percentile(sortedProj, 0.95) - percentile(sortedProj, 0.05)
      // noise = high-pass residual (curvature), robust to the slow breath slope
      const hp = []
      for (let i = 1; i < proj.length - 1; i++) hp.push(proj[i] - 0.5 * (proj[i - 1] + proj[i + 1]))
      const noise = std(hp) || 1e-6
      const snr = excursion / noise
      const strength = ramp(snr, strengthRamp[0], strengthRamp[1])

      // ── rhythm gate: regular, in-band peaks ──
      const peaks = findPeaks(w.map(p => ({ t: p.t, v: p.proj })), 1500)
      const iois = []
      for (let i = 1; i < peaks.length; i++) iois.push(peaks[i].t - peaks[i - 1].t)
      let rhythm = false, breaths = peaks.length
      if (iois.length >= 2) {
        const m = mean(iois), cv = std(iois) / (m || 1)
        const bpm = 60000 / m
        rhythm = cv <= rhythmCvMax && bpm >= rhythmBpm[0] && bpm <= rhythmBpm[1]
      }

      // ── motion gate: totalVar spike vs its own rolling median ──
      const tv = c ? c.trace : 0
      tvHistory.push(tv); if (tvHistory.length > 30) tvHistory.shift()
      const tvSorted = [...tvHistory].sort((a, b) => a - b)
      const tvMed = percentile(tvSorted, 0.5) || tv
      const motion = !(tvMed > 1e-12 && tv > motionTvMult * tvMed)

      // ── composite: weighted geometric mean of factors, gated ──
      // lock is weighted a touch lower — it's the last factor to converge.
      const factors = { tracking, clarity, lock, strength }
      let confidence = weightedGeomean([
        [tracking, 1.0], [clarity, 1.0], [strength, 1.0], [lock, 0.6],
      ])
      if (!rhythm) confidence *= gatePenalty
      if (!motion) confidence *= gatePenalty

      smoothed += (confidence - smoothed) * smoothTau

      // Route coaching by *fundamentality*, not by whichever number is lowest.
      // The factors form a dependency chain: you can't follow the pace (tracking)
      // or settle an axis (lock) until the belt is actually picking up a clean
      // breath (strength, clarity). So when a foundational factor fails, its
      // failure is the root cause and the later ones are just symptoms — coach
      // the earliest broken link. Gates (movement, rhythm) sit in the middle:
      // they matter once the signal is acquired but before behavior.
      const FLOOR = 0.55
      let weakest =
        strength < FLOOR ? 'strength' :
        clarity  < FLOOR ? 'clarity'  :
        !motion          ? 'motion'   :
        !rhythm          ? 'rhythm'   :
        lock     < FLOOR ? 'lock'     :
        tracking < FLOOR ? 'tracking' :
        // all healthy — surface the weakest factor as a gentle nudge
        [['tracking', tracking], ['clarity', clarity], ['lock', lock], ['strength', strength]]
          .sort((a, b) => a[1] - b[1])[0][0]
      const confident = smoothed >= 0.85

      return {
        confidence: smoothed,
        sub: factors,
        gates: { rhythm, motion },
        weakest,
        coach: confident ? null : COACH[weakest],
        breaths,
        ready: true,
        debug: { r, snr, angle },
      }
    },

    reset() { buf.length = 0; tvHistory.length = 0; smoothed = 0; lastAxis = null },
  }
}

// Weighted geometric mean of [value, weight] pairs. A soft AND: any near-zero
// factor drags the whole score down in proportion to its weight.
function weightedGeomean(pairs) {
  let wsum = 0, acc = 0
  for (const [v, wt] of pairs) {
    wsum += wt
    acc += wt * Math.log(Math.max(v, 1e-6))
  }
  return wsum > 0 ? Math.exp(acc / wsum) : 0
}
