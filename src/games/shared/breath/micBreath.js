// ── micBreath ───────────────────────────────────────────────────────────────
// Pure DSP for estimating breathing from an ordinary microphone (webcam,
// laptop, phone, headset). No Web Audio here — the hook (useMicBreath.js)
// feeds it one spectrum frame every ~50 ms, so everything below runs headless
// in tests.
//
// What a mic can and can't hear:
//   • Breath is broadband noise. Close to the mic (phone/headset, < ~30 cm) both
//     inhale and exhale are audible; at webcam distance usually only the exhale,
//     and quiet nasal breathing may be under the room's noise floor entirely.
//   • Exhaling *onto* the capsule makes low-frequency "wind" (< ~200 Hz) — very
//     strong, but only when the mic is in the airstream.
//   • A mic hears airflow loudness, not direction. Inhale vs exhale is inferred
//     from timing (the gap after an exhale is the longer one), never measured.
//
// Pipeline per frame:
//   band dB (breath band + wind band) → rolling percentile noise floor →
//   dB-above-floor → tonal gate (spectral flatness; voice/music is tonal,
//   breath is noise) → EMA-smoothed = "activity" → hysteresis burst detector →
//   bursts → rate, two ways:
//     1. burst intervals, deciding whether each breath is one burst (exhale only)
//        or a pair (inhale + exhale) — the main ambiguity of acoustic breathing;
//     2. autocorrelation of the activity trace, as an independent check.

export const MIC_DEFAULTS = {
  frameMs: 50,
  breathBandHz: [250, 2500],
  windBandHz: [20, 200],
  source: 'both',            // 'breath' | 'wind' | 'both' (max of the two)
  floorWindowMs: 15000,
  floorPercentile: 0.2,
  smoothMs: 150,
  onDb: 5,                   // activity (dB above floor) that opens a burst
  offDb: 2.5,                // ...and that it must stay under to close one
  minBurstMs: 250,
  maxBurstMs: 6000,          // longer = a sustained noise change, not a breath
  mergeGapMs: 250,           // dips shorter than this don't split a burst
  flatnessMin: 0.18,         // below = tonal (voice) → not breath
  tonalHoldMs: 300,          // keep the voice gate shut this long after the last tonal frame
  pairing: 'auto',           // 'auto' | 'single' | 'pairs'
  maxBursts: 16,
  acfWindowMs: 30000,
  minPeriodMs: 2000,         // 30 bpm
  maxPeriodMs: 15000,        // 4 bpm
}

// ── Spectrum → features ─────────────────────────────────────────────────────
// db: Float32Array from AnalyserNode.getFloatFrequencyData (dBFS per bin).
export function bandFeatures(db, sampleRate, fftSize, [loHz, hiHz]) {
  const binHz = sampleRate / fftSize
  const lo = Math.max(1, Math.floor(loHz / binHz))
  const hi = Math.min(db.length - 1, Math.ceil(hiHz / binHz))
  let sumP = 0, sumLnP = 0, sumFP = 0, n = 0
  for (let i = lo; i <= hi; i++) {
    const d = Number.isFinite(db[i]) ? Math.max(db[i], -160) : -160
    const p = Math.pow(10, d / 10)
    sumP += p
    sumLnP += Math.log(p)
    sumFP += p * i * binHz
    n++
  }
  if (!n || sumP <= 0) return { db: -160, flatness: 0, centroid: 0 }
  const mean = sumP / n
  return {
    db: 10 * Math.log10(sumP),
    flatness: Math.exp(sumLnP / n) / mean,   // 1 = white noise, → 0 = pure tone
    centroid: sumFP / sumP,
  }
}

export function frameFromSpectrum(db, sampleRate, fftSize, opts = {}) {
  const o = { ...MIC_DEFAULTS, ...opts }
  const b = bandFeatures(db, sampleRate, fftSize, o.breathBandHz)
  const w = bandFeatures(db, sampleRate, fftSize, o.windBandHz)
  return { breathDb: b.db, windDb: w.db, flatness: b.flatness, centroid: b.centroid }
}

// ── Rolling percentile floor ────────────────────────────────────────────────
function createFloorTracker(windowFrames, pct) {
  const buf = []
  let cached = null, sinceSort = 0
  return {
    push(v) {
      buf.push(v)
      if (buf.length > windowFrames) buf.shift()
      // Re-sort every 10 frames (~0.5 s): the floor moves slowly anyway.
      if (cached == null || ++sinceSort >= 10) {
        const s = [...buf].sort((a, b) => a - b)
        cached = s[Math.min(s.length - 1, Math.floor(pct * s.length))]
        sinceSort = 0
      }
      return cached
    },
  }
}

const median = a => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}
const cv = a => {
  if (a.length < 2) return null
  const m = a.reduce((x, y) => x + y, 0) / a.length
  const v = a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)
  return Math.sqrt(v) / m
}

// ── One breath or two bursts per breath? ────────────────────────────────────
// Given recent burst onsets (and per-burst loudness/centroid), decide whether
// bursts come singly (exhale-only) or in inhale+exhale pairs.
//   • Timing: pairs alternate short (in→ex) and long (ex→pause→in) gaps, so
//     summing adjacent gaps makes them far steadier. Summing always shrinks the
//     CV by ~√2 for random jitter, hence the 0.5 bar rather than 0.71.
//   • Character: pairs alternate in loudness or pitch (exhale louder/lower).
// Returns { pairs, intervalRatio, alternation }.
export function classifyPairing(bursts) {
  if (bursts.length < 5) return { pairs: false, intervalRatio: null, alternation: null }
  const on = bursts.map(b => b.t0)
  const gaps = on.slice(1).map((t, i) => t - on[i])
  const sums = gaps.slice(1).map((g, i) => g + gaps[i])
  const cvSingle = cv(gaps), cvPair = cv(sums)
  const intervalRatio = cvSingle > 0 ? cvPair / cvSingle : 1
  // Strict alternation: consecutive gaps flip short/long every time.
  let flips = 0
  for (let i = 1; i < gaps.length - 1; i++) {
    if (Math.sign(gaps[i] - gaps[i - 1]) !== Math.sign(gaps[i + 1] - gaps[i])) flips++
  }
  const gapAlternates = gaps.length >= 4 && flips >= gaps.length - 2
  const alternation = Math.max(altScore(bursts.map(b => b.peakDb), 2), altScore(bursts.map(b => b.centroid), 0.12, true))
  const pairs = (intervalRatio < 0.5 && gapAlternates) || alternation >= 0.85
  return { pairs, intervalRatio, alternation }
}

// Fraction of consecutive bursts that flip side of the median by a meaningful
// margin (absolute dB, or relative for centroid).
function altScore(vals, margin, relative = false) {
  const m = median(vals)
  if (m == null) return 0
  const tol = relative ? Math.abs(m) * margin : margin
  const side = vals.map(v => (v > m + tol / 2 ? 1 : v < m - tol / 2 ? -1 : 0))
  let ok = 0, n = 0
  for (let i = 1; i < side.length; i++) {
    n++
    if (side[i] !== 0 && side[i] === -side[i - 1]) ok++
  }
  return n ? ok / n : 0
}

// Normalized autocorrelation of x (sampled every dtMs) over [minLag, maxLag] ms.
export function acfPeriod(x, dtMs, minPeriodMs, maxPeriodMs) {
  const n = x.length
  const minL = Math.round(minPeriodMs / dtMs), maxL = Math.min(Math.round(maxPeriodMs / dtMs), n - 2)
  if (maxL <= minL) return { periodMs: null, strength: 0 }
  const mean = x.reduce((a, b) => a + b, 0) / n
  const y = x.map(v => v - mean)
  const r0 = y.reduce((a, b) => a + b * b, 0)
  if (r0 <= 1e-9) return { periodMs: null, strength: 0 }
  const r = new Float64Array(maxL + 2)
  for (let L = minL - 1; L <= maxL + 1; L++) {
    let s = 0
    for (let i = 0; i + L < n; i++) s += y[i] * y[i + L]
    r[L] = s / r0 * (n / (n - L))   // unbiased: don't penalise long lags
  }
  // Highest *local* maximum — a monotone tail at minL isn't a period.
  let best = -Infinity, bestL = null
  for (let L = minL; L <= maxL; L++) {
    if (r[L] > r[L - 1] && r[L] >= r[L + 1] && r[L] > best) { best = r[L]; bestL = L }
  }
  if (bestL == null) return { periodMs: null, strength: 0 }
  // Prefer the shortest lag whose peak is nearly as strong (avoid locking onto
  // a multiple of the true period).
  for (let L = minL; L < bestL; L++) {
    if (r[L] > r[L - 1] && r[L] >= r[L + 1] && r[L] >= 0.85 * best &&
        Math.abs(bestL / L - Math.round(bestL / L)) < 0.15) { bestL = L; best = r[L]; break }
  }
  return { periodMs: bestL * dtMs, strength: Math.max(0, Math.min(1, best)) }
}

// ── Detector ────────────────────────────────────────────────────────────────
export function createMicBreathDetector(opts = {}) {
  let o = { ...MIC_DEFAULTS, ...opts }
  const floorFrames = () => Math.round(o.floorWindowMs / o.frameMs)
  let breathFloor = createFloorTracker(floorFrames(), o.floorPercentile)
  let windFloor   = createFloorTracker(floorFrames(), o.floorPercentile)
  let smB = 0, smW = 0
  let lastTonalT = -Infinity
  let burst = null          // open burst
  const bursts = []         // completed, newest last
  const actHist = []        // { t, act } for ACF
  let lastAcf = { periodMs: null, strength: 0 }, lastAcfT = -Infinity
  let pairing = { pairs: false, intervalRatio: null, alternation: null }

  function closeBurst() {
    const b = burst
    burst = null
    const dur = b.lastAbove - b.t0
    if (dur < o.minBurstMs || dur > o.maxBurstMs) return null
    const done = {
      t0: b.t0, t1: b.lastAbove, peakDb: b.peak,
      centroid: b.cW > 0 ? b.cSum / b.cW : 0, label: null,
    }
    bursts.push(done)
    if (bursts.length > o.maxBursts) bursts.shift()
    pairing = classifyPairing(bursts)
    labelBursts()
    return done
  }

  // In pair mode, the burst followed by the SHORTER gap is the inhale.
  function labelBursts() {
    const usePairs = o.pairing === 'pairs' || (o.pairing === 'auto' && pairing.pairs)
    if (!usePairs || bursts.length < 3) { bursts.forEach(b => { b.label = usePairs ? null : 'breath' }); return }
    const gaps = bursts.slice(1).map((b, i) => b.t0 - bursts[i].t0)
    let even = 0, odd = 0, ne = 0, no = 0
    gaps.forEach((g, i) => { if (i % 2) { odd += g; no++ } else { even += g; ne++ } })
    const evenIsInhale = even / ne < odd / Math.max(no, 1)
    bursts.forEach((b, i) => { b.label = ((i % 2 === 0) === evenIsInhale) ? 'inhale' : 'exhale' })
  }

  return {
    setOptions(next) {
      const floorChanged = next.floorWindowMs !== undefined || next.floorPercentile !== undefined
      o = { ...o, ...next }
      if (floorChanged) {
        breathFloor = createFloorTracker(floorFrames(), o.floorPercentile)
        windFloor   = createFloorTracker(floorFrames(), o.floorPercentile)
      }
      labelBursts()
    },
    get options() { return o },

    // frame: { breathDb, windDb, flatness, centroid }
    push(t, frame) {
      const a = 1 - Math.exp(-o.frameMs / o.smoothMs)
      const bf = breathFloor.push(frame.breathDb)
      const wf = windFloor.push(frame.windDb)
      // Gate BEFORE smoothing: gating the smoothed trace lets the decaying tail
      // of a voiced sound through as "breath" once the flatness recovers.
      const rawB = Math.max(0, frame.breathDb - bf)
      if (frame.flatness < o.flatnessMin && rawB > o.onDb) lastTonalT = t
      const tonal = t - lastTonalT <= o.tonalHoldMs
      smB += a * ((tonal ? 0 : rawB) - smB)
      smW += a * (Math.max(0, frame.windDb - wf) - smW)
      const bAct = smB
      const act = o.source === 'breath' ? bAct : o.source === 'wind' ? smW : Math.max(bAct, smW)

      let event = null
      if (!burst && act > o.onDb) {
        burst = { t0: t, lastAbove: t, peak: act, cSum: 0, cW: 0 }
      }
      if (burst) {
        if (act > o.offDb) {
          burst.lastAbove = t
          if (act > burst.peak) burst.peak = act
          burst.cSum += frame.centroid * act; burst.cW += act
        } else if (t - burst.lastAbove > o.mergeGapMs) {
          event = closeBurst()
        }
        if (burst && t - burst.t0 > o.maxBurstMs + o.mergeGapMs) burst = null  // runaway: drop
      }

      actHist.push({ t, act })
      while (actHist.length && t - actHist[0].t > o.acfWindowMs) actHist.shift()
      if (t - lastAcfT >= 1000 && actHist.length > (o.minPeriodMs * 2) / o.frameMs) {
        lastAcf = acfPeriod(actHist.map(p => p.act), o.frameMs, o.minPeriodMs, o.maxPeriodMs)
        lastAcfT = t
      }

      return {
        t, act, breathAct: bAct, windAct: smW, tonal,
        breathFloorDb: bf, windFloorDb: wf,
        inBurst: !!burst, event,
      }
    },

    get bursts() { return bursts },
    get pairing() { return pairing },

    // Rate summary. Stale (> 2 × period since last burst) → null.
    estimate(now) {
      const usePairs = o.pairing === 'pairs' || (o.pairing === 'auto' && pairing.pairs)
      const recent = bursts.filter(b => now - b.t0 < o.acfWindowMs)
      let periodMs = null
      if (recent.length >= 3) {
        const on = recent.map(b => b.t0)
        const gaps = on.slice(1).map((x, i) => x - on[i])
        const per = usePairs ? gaps.slice(1).map((g, i) => g + gaps[i]) : gaps
        const m = median(per.filter(p => p >= o.minPeriodMs * 0.75 && p <= o.maxPeriodMs))
        periodMs = m
      }
      const last = bursts[bursts.length - 1]
      if (periodMs && last && now - last.t0 > 2.5 * periodMs) periodMs = null
      return {
        bpm: periodMs ? 60000 / periodMs : null,
        mode: usePairs ? 'pairs' : 'single',
        acfBpm: lastAcf.periodMs ? 60000 / lastAcf.periodMs : null,
        acfStrength: lastAcf.strength,
        pairing,
      }
    },
  }
}
