// ── BCAT-DDM pacer schedules ───────────────────────────────────────────────
//
// Pure, React-free and node-testable (imports use explicit `.js`, like
// emberMechanics.js). One source of truth for *what the pacer does when*: the
// task will drive its pacer clock from these schedules, and the power
// simulation (scripts/bcat_ddm_sim/) consumes the very same output, so a design
// that is simulated is the design that runs.
//
// Everything is in absolute milliseconds from stream start, precomputed — no
// per-breath timers — so a 40 min stream cannot drift. Every change starts at
// an inhale onset (= a breath start), where a period switch is invisible in
// the pacer's position.
//
// Magnitudes are proportional changes in breath *period* (the paper's
// convention, delta = TotalChange − 1): slower = P·(1 + m), faster = P·(1 − m).
// They are passed relative to the participant's 50%-detection magnitude
// (`m50Hat`, the Quest pre-run's estimate), so one design spec serves everyone.
//
// Designs (docs/markdowns/bcat_ddm_plan.md §6a):
//   brief       — the handoff as written: steps from a fixed baseline, 4 fixed
//                 levels, long response window, return to baseline + re-entrain
//   roving      — steps whose new rate becomes the baseline (no returns),
//                 continuous magnitudes, short window, hazard-based onsets
//   trials      — fixed-length trials, step at a random breath, null trials,
//                 pacer pause between trials
//   ramp        — fixed-length trials, rate ramps from a random breath to the
//                 end of the trial whatever the response; null trials
//   roving_ramp — roving for most of the session, then a ramp block
//   roving_mixed — roving, but each change is randomly a step or a ramp of the
//                 same total size (the ramp then holds the new rate); Study 1's
//                 salience manipulation inside one stream, no blocks
//
// Blip designs probe HOW LONG evidence is held (leaky vs perfect accumulation).
// A blip is a one-breath departure from the current rate, after which the pacer
// returns to that rate: …4.0, 4.0, 3.4, 4.0… s. Rate never roves in these designs.
//   double_blip — single blips and pairs of blips separated by 0–8 normal
//                 breaths, at two sizes, after settled stretches. A leak loses
//                 the first blip's evidence over the gap by a fixed PROPORTION;
//                 a criterion drains a fixed AMOUNT, so big blips survive long
//                 gaps and small ones don't (the size × gap interaction).
//   blip_train  — small blips at random times (each breath a blip with
//                 probability blipTrainP); the press-triggered average of blip
//                 history is the integration kernel (cf. Brunton et al. 2013).
//   blip_combo  — double_blip for the first half, blip_train for the second

//
// Bump designs are the smooth counterpart: the pace rises to a peak and returns over 3-4
// breaths (raised cosine), giving total-change evidence without sharp breath-to-breath jumps.
//   double_bump      — single bumps and pairs at gaps of 0/2/4/8 normal breaths, two sizes
//   bump_train       — bumps at random times
//   roving_bump      — roving, then a double-bump block (last quarter)
//   roving_ramp_bump — roving, then a double-bump block, then a ramp block

export const DESIGNS = ['brief', 'roving', 'trials', 'ramp', 'roving_ramp', 'roving_mixed',
                        'double_blip', 'blip_train', 'blip_combo',
                        'double_bump', 'bump_train', 'roving_bump', 'roving_ramp_bump']

export const DEFAULTS = {
  minutes:          40,      // task time budget, pauses included
  basePeriodMs:     4000,
  m50Hat:           0.20,    // participant's estimated 50%-detection magnitude
  seed:             1,
  minRatio:         0.55,    // pacer period bounds, as ratios of basePeriodMs
  maxRatio:         1.8,
  leadInBreaths:    3,
  probeP:           1 / 3,   // share of windows followed by an arousal probe
  probeMs:          5000,    // probe pause (pacer stopped)
  reentrainBreaths: [2, 3],  // after a probe / return, inclusive range

  // brief
  briefWindowBreaths: 10,
  briefLevels:        [0.7, 1.0, 1.4, 1.9],   // × m50Hat ≈ 25/50/75/90% points
  briefLevelWeights:  [0.15, 0.30, 0.30, 0.25],
  gapMinS:            30,
  gapMaxS:            60,
  gapMode:            'after',  // 'after' re-entrainment | 'onset' (onset-to-onset)

  // roving
  rovingWindowBreaths: 5,
  minGapBreaths:       2,
  extraGapMean:        3,       // geometric extra breaths, mean
  relMagMin:           0.5,     // × m50Hat, log-uniform
  relMagMax:           2.2,

  // trials
  trialBreaths:    8,
  trialOnsetMin:   2,           // breaths before onset, inclusive range
  trialOnsetMax:   5,
  nullP:           0.25,
  itiMs:           3000,

  // ramp
  rampTrialBreaths: 10,
  rampOnsetMin:     2,
  rampOnsetMax:     3,
  rampRates:        [0.25, 0.5], // × m50Hat per breath

  // roving_ramp
  rampFrac: 0.25,

  // roving_mixed
  mixedRampShare:   0.5,   // share of changes delivered as ramps
  mixedRampBreaths: 6,     // breaths a ramp takes to reach the new rate
  mixedHoldBreaths: 3,     // window continues this many breaths after a ramp completes

  // double_blip
  blipSizes:         [1.2, 2.0],         // × m50Hat; one breath carries less evidence than a step
  blipGaps:          [0, 1, 2, 4, 8],    // normal breaths between the two blips of a pair
  blipSingleP:       0.2,                // share of probes that are a single blip (reference)
  blipSettleMin:     3,                  // settled breaths before each probe (+ geometric extra)
  blipSettleExtra:   2,
  blipTailBreaths:   3,                  // window runs this many breaths past the last blip

  // blip_train
  blipTrainP:        0.15,               // per-breath blip probability
  blipTrainRelMin:   0.6,                // × m50Hat, log-uniform sizes
  blipTrainRelMax:   1.6,
  blipTrainProbeEvery: 30,               // breaths between probe opportunities

  // blip_combo
  blipComboSplit:    0.5,                // share of the session in double_blip (first)

  // bumps: a smooth excursion and return over bumpWidths breaths (raised-cosine profile),
  // so it carries total-change evidence without the sharp breath-to-breath changes of a blip
  bumpWidths:        [3, 4],             // breaths per bump, drawn per bump
  bumpSizes:         [0.6, 1.0],         // × m50Hat, PEAK proportional change (double_bump); single bumps ~15-50% detected
  bumpGaps:          [0, 2, 4, 8],       // normal breaths between the two bumps of a pair
  bumpSingleP:       0.2,
  bumpTrainP:        0.1,                // per-slot probability a bump starts (bump_train)
  bumpTrainRelMin:   0.5,                // × m50Hat, log-uniform peak sizes (bump_train)
  bumpTrainRelMax:   1.1,
  rovingBumpFrac:    0.25,               // roving_bump: share of the session in the double-bump block (last)
  rrbBumpFrac:       0.2,                // roving_ramp_bump: double-bump block share (middle)
  rrbRampFrac:       0.2,                // roving_ramp_bump: ramp block share (last)
}

// ── seeded RNG ──────────────────────────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRng(seed) {
  const r = mulberry32(seed)
  return {
    u: r,
    uniform: (lo, hi) => lo + (hi - lo) * r(),
    int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),          // inclusive
    logUniform: (lo, hi) => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * r()),
    sign: () => (r() < 0.5 ? -1 : 1),
    geometric: (mean) => {                                          // support 0,1,2,…
      if (mean <= 0) return 0
      const p = 1 / (1 + mean)
      return Math.floor(Math.log(1 - r()) / Math.log(1 - p))
    },
    weighted: (weights) => {
      const total = weights.reduce((s, w) => s + w, 0)
      let x = r() * total
      for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i }
      return weights.length - 1
    },
  }
}

// ── builder ─────────────────────────────────────────────────────────────────
function createBuilder(o) {
  const s = {
    t: 0,
    breaths: [],   // { i, startMs, periodMs, tag }
    pauses: [],    // { startMs, endMs, kind, beforeBreath }
    events: [],    // see pushEvent
  }
  const lo = o.basePeriodMs * o.minRatio
  const hi = o.basePeriodMs * o.maxRatio
  s.clamp = (p) => Math.min(hi, Math.max(lo, p))
  s.addBreath = (periodMs, tag) => {
    const i = s.breaths.length
    s.breaths.push({ i, startMs: Math.round(s.t), periodMs: Math.round(periodMs), tag })
    s.t += Math.round(periodMs)
    return i
  }
  s.addPause = (ms, kind) => {
    s.pauses.push({ startMs: Math.round(s.t), endMs: Math.round(s.t + ms), kind, beforeBreath: s.breaths.length })
    s.t += ms
  }
  s.pushEvent = (e) => { s.events.push({ id: s.events.length, ...e }); return e }
  return s
}

const changed = (p, dir, mag) => p * (1 + dir * mag)

// A step from period P, magnitude `mag` (proportional), direction chosen at
// random but steered back toward basePeriodMs when near the bounds. Returns
// { dir, mag, newPeriod } with the magnitude shrunk if both directions would
// leave the bounds.
function chooseStep(s, o, rng, P, mag, meanRevert) {
  let dir = rng.sign()
  if (meanRevert) {
    // P(slower) falls from 1 → 0 as log(P/base) goes from the low bound to the high one
    const x = Math.log(P / o.basePeriodMs)
    const span = x >= 0 ? Math.log(o.maxRatio) : -Math.log(o.minRatio)
    const pSlower = 0.5 - 0.5 * Math.max(-1, Math.min(1, x / span))
    dir = rng.u() < pSlower ? 1 : -1
  }
  const fits = (d) => {
    const q = changed(P, d, mag)
    return q >= o.basePeriodMs * o.minRatio && q <= o.basePeriodMs * o.maxRatio
  }
  if (!fits(dir)) dir = -dir
  if (!fits(dir)) {
    // shrink until it fits on the side with more room
    dir = P < o.basePeriodMs ? 1 : -1
    while (mag > 0.01 && !fits(dir)) mag *= 0.9
  }
  return { dir, mag, newPeriod: changed(P, dir, mag) }
}

function pickReentrain(o, rng) {
  const [a, b] = o.reentrainBreaths
  return rng.int(a, b)
}

// ── designs ─────────────────────────────────────────────────────────────────
function runBrief(s, o, rng, endMs) {
  const B = o.basePeriodMs
  for (let k = 0; k < o.leadInBreaths; k++) s.addBreath(B, 'lead')
  const W = o.briefWindowBreaths
  let lastOnsetMs = -Infinity
  for (;;) {
    let gapMs = rng.uniform(o.gapMinS, o.gapMaxS) * 1000
    if (o.gapMode === 'onset') gapMs = Math.max(0, gapMs - (s.t - lastOnsetMs))
    const level = rng.weighted(o.briefLevelWeights)
    const mag = o.briefLevels[level] * o.m50Hat
    const { dir, mag: m, newPeriod } = chooseStep(s, o, rng, B, mag, false)
    const worst = gapMs + W * Math.max(B, newPeriod) + o.probeMs + 4 * B
    if (s.t + worst > endMs) break
    const nGap = Math.ceil(gapMs / B)
    for (let k = 0; k < nGap; k++) s.addBreath(B, 'stable')

    const onsetBreath = s.breaths.length
    const onsetMs = s.t
    lastOnsetMs = onsetMs
    for (let k = 0; k < W; k++) s.addBreath(newPeriod, 'window')
    s.pushEvent({ type: 'step', onsetMs, onsetBreath, windowEndMs: s.t, dir, mag: m,
                  level, fromPeriodMs: B, toPeriodMs: Math.round(newPeriod) })
    if (rng.u() < o.probeP) s.addPause(o.probeMs, 'probe')

    const retBreath = s.breaths.length
    const retMs = s.t
    const nRe = pickReentrain(o, rng)
    for (let k = 0; k < nRe; k++) s.addBreath(B, 'reentrain')
    s.pushEvent({ type: 'return', onsetMs: retMs, onsetBreath: retBreath, windowEndMs: s.t,
                  dir: -dir, mag: Math.abs(B / newPeriod - 1), fromPeriodMs: Math.round(newPeriod), toPeriodMs: B })
  }
}

function runRoving(s, o, rng, endMs) {
  let P = o.basePeriodMs
  if (s.breaths.length === 0) for (let k = 0; k < o.leadInBreaths; k++) s.addBreath(P, 'lead')
  const W = o.rovingWindowBreaths
  for (;;) {
    const nGap = o.minGapBreaths + rng.geometric(o.extraGapMean)
    const rel = rng.logUniform(o.relMagMin, o.relMagMax)
    const { dir, mag, newPeriod } = chooseStep(s, o, rng, P, rel * o.m50Hat, true)
    const worst = nGap * P + W * newPeriod + o.probeMs + 3 * newPeriod
    if (s.t + worst > endMs) break
    for (let k = 0; k < nGap; k++) s.addBreath(P, 'stable')

    const onsetBreath = s.breaths.length
    const onsetMs = s.t
    for (let k = 0; k < W; k++) s.addBreath(newPeriod, 'window')
    s.pushEvent({ type: 'step', onsetMs, onsetBreath, windowEndMs: s.t, dir, mag, relMag: rel,
                  fromPeriodMs: Math.round(P), toPeriodMs: Math.round(newPeriod) })
    P = newPeriod
    if (rng.u() < o.probeP) {
      s.addPause(o.probeMs, 'probe')
      const nRe = pickReentrain(o, rng)
      for (let k = 0; k < nRe; k++) s.addBreath(P, 'reentrain')
    }
  }
}

function runTrials(s, o, rng, endMs) {
  const B = o.basePeriodMs
  for (;;) {
    const n = o.trialBreaths
    const onsetIdx = rng.int(o.trialOnsetMin, o.trialOnsetMax)
    const isNull = rng.u() < o.nullP
    const rel = rng.logUniform(o.relMagMin, o.relMagMax)
    const { dir, mag, newPeriod } = chooseStep(s, o, rng, B, rel * o.m50Hat, false)
    const worst = o.itiMs + n * Math.max(B, newPeriod) + o.probeMs
    if (s.t + worst > endMs) break
    s.addPause(o.itiMs, 'iti')
    for (let k = 0; k < onsetIdx; k++) s.addBreath(B, 'pre')
    const onsetBreath = s.breaths.length
    const onsetMs = s.t
    for (let k = onsetIdx; k < n; k++) s.addBreath(isNull ? B : newPeriod, isNull ? 'null' : 'window')
    s.pushEvent(isNull
      ? { type: 'null', onsetMs, onsetBreath, windowEndMs: s.t, dir: 0, mag: 0, fromPeriodMs: B, toPeriodMs: B }
      : { type: 'step', onsetMs, onsetBreath, windowEndMs: s.t, dir, mag, relMag: rel,
          fromPeriodMs: B, toPeriodMs: Math.round(newPeriod) })
    if (rng.u() < o.probeP) s.addPause(o.probeMs, 'probe')
  }
}

function runRamp(s, o, rng, endMs) {
  const B = o.basePeriodMs
  for (;;) {
    const n = o.rampTrialBreaths
    const onsetIdx = rng.int(o.rampOnsetMin, o.rampOnsetMax)
    const isNull = rng.u() < o.nullP
    const rateIdx = rng.int(0, o.rampRates.length - 1)
    const rate = o.rampRates[rateIdx] * o.m50Hat
    const dir = rng.sign()
    const nRamp = n - onsetIdx
    const periods = []
    for (let k = 1; k <= nRamp; k++) periods.push(isNull ? B : s.clamp(changed(B, dir, rate * k)))
    const worst = o.itiMs + onsetIdx * B + periods.reduce((a, b) => a + b, 0) + o.probeMs
    if (s.t + worst > endMs) break
    s.addPause(o.itiMs, 'iti')
    for (let k = 0; k < onsetIdx; k++) s.addBreath(B, 'pre')
    const onsetBreath = s.breaths.length
    const onsetMs = s.t
    for (const p of periods) s.addBreath(p, isNull ? 'null' : 'ramp')
    const finalPeriod = periods[periods.length - 1]
    s.pushEvent(isNull
      ? { type: 'null', onsetMs, onsetBreath, windowEndMs: s.t, dir: 0, mag: 0, fromPeriodMs: B, toPeriodMs: B }
      : { type: 'ramp', onsetMs, onsetBreath, windowEndMs: s.t, dir, rate, rateIdx,
          mag: Math.abs(finalPeriod / B - 1), fromPeriodMs: B, toPeriodMs: Math.round(finalPeriod) })
    if (rng.u() < o.probeP) s.addPause(o.probeMs, 'probe')
  }
}

function runRovingMixed(s, o, rng, endMs) {
  let P = o.basePeriodMs
  for (let k = 0; k < o.leadInBreaths; k++) s.addBreath(P, 'lead')
  for (;;) {
    const nGap = o.minGapBreaths + rng.geometric(o.extraGapMean)
    const rel = rng.logUniform(o.relMagMin, o.relMagMax)
    const { dir, mag, newPeriod } = chooseStep(s, o, rng, P, rel * o.m50Hat, true)
    const isRamp = rng.u() < o.mixedRampShare
    const nWin = isRamp ? o.mixedRampBreaths + o.mixedHoldBreaths : o.rovingWindowBreaths
    const worst = nGap * P + nWin * Math.max(P, newPeriod) + o.probeMs + 3 * newPeriod
    if (s.t + worst > endMs) break
    for (let k = 0; k < nGap; k++) s.addBreath(P, 'stable')

    const onsetBreath = s.breaths.length
    const onsetMs = s.t
    if (isRamp) {
      // geometric interpolation: equal proportional change per breath, ending exactly on newPeriod
      const n = o.mixedRampBreaths
      for (let k = 1; k <= n; k++) s.addBreath(P * Math.pow(newPeriod / P, k / n), 'ramp')
      for (let k = 0; k < o.mixedHoldBreaths; k++) s.addBreath(newPeriod, 'window')
    } else {
      for (let k = 0; k < nWin; k++) s.addBreath(newPeriod, 'window')
    }
    s.pushEvent({ type: isRamp ? 'ramp' : 'step', onsetMs, onsetBreath, windowEndMs: s.t, dir, mag, relMag: rel,
                  fromPeriodMs: Math.round(P), toPeriodMs: Math.round(newPeriod),
                  ...(isRamp ? { rampBreaths: o.mixedRampBreaths } : {}) })
    P = newPeriod
    if (rng.u() < o.probeP) {
      s.addPause(o.probeMs, 'probe')
      const nRe = pickReentrain(o, rng)
      for (let k = 0; k < nRe; k++) s.addBreath(P, 'reentrain')
    }
  }
}

function runDoubleBlip(s, o, rng, endMs) {
  const B = o.basePeriodMs
  if (s.breaths.length === 0) for (let k = 0; k < o.leadInBreaths; k++) s.addBreath(B, 'lead')
  for (;;) {
    const nSettle = o.blipSettleMin + rng.geometric(o.blipSettleExtra)
    const single = rng.u() < o.blipSingleP
    const gap = single ? null : o.blipGaps[rng.int(0, o.blipGaps.length - 1)]
    const sizeIdx = rng.int(0, o.blipSizes.length - 1)
    const mag = Math.min(o.blipSizes[sizeIdx] * o.m50Hat, 0.42)
    const dir = rng.sign()
    const blipPeriod = s.clamp(changed(B, dir, mag))
    const nProbe = single ? 1 : gap + 2
    const worst = (nSettle + nProbe + o.blipTailBreaths) * Math.max(B, blipPeriod) + o.probeMs + 3 * B
    if (s.t + worst > endMs) break
    for (let k = 0; k < nSettle; k++) s.addBreath(B, 'stable')

    const onsetBreath = s.breaths.length
    const onsetMs = s.t
    s.addBreath(blipPeriod, 'dblip')
    if (!single) {
      for (let k = 0; k < gap; k++) s.addBreath(B, 'gap')
      s.addBreath(blipPeriod, 'dblip')
    }
    for (let k = 0; k < o.blipTailBreaths; k++) s.addBreath(B, 'tail')
    s.pushEvent({ type: single ? 'blip_single' : 'blip_pair', onsetMs, onsetBreath, windowEndMs: s.t,
                  dir, mag: Math.abs(blipPeriod / B - 1), sizeIdx, gap,
                  fromPeriodMs: B, toPeriodMs: Math.round(blipPeriod) })
    if (rng.u() < o.probeP) {
      s.addPause(o.probeMs, 'probe')
      const nRe = pickReentrain(o, rng)
      for (let k = 0; k < nRe; k++) s.addBreath(B, 'reentrain')
    }
  }
}

function runBlipTrain(s, o, rng, endMs) {
  const B = o.basePeriodMs
  if (s.breaths.length === 0) for (let k = 0; k < o.leadInBreaths; k++) s.addBreath(B, 'lead')
  let sinceProbe = 0
  let prevBlip = false
  for (;;) {
    if (s.t + 2 * B + o.probeMs > endMs) break
    // never two blips in a row: a 2-breath excursion is a different stimulus
    if (!prevBlip && rng.u() < o.blipTrainP) {
      const rel = rng.logUniform(o.blipTrainRelMin, o.blipTrainRelMax)
      const dir = rng.sign()
      const p = s.clamp(changed(B, dir, rel * o.m50Hat))
      const onsetBreath = s.breaths.length
      const onsetMs = s.t
      s.addBreath(p, 'tblip')
      s.pushEvent({ type: 'blip', onsetMs, onsetBreath, windowEndMs: s.t + 3 * B, dir,
                    mag: Math.abs(p / B - 1), relMag: rel, fromPeriodMs: B, toPeriodMs: Math.round(p) })
      prevBlip = true
    } else {
      s.addBreath(B, 'stable')
      prevBlip = false
    }
    if (++sinceProbe >= o.blipTrainProbeEvery && !prevBlip) {
      sinceProbe = 0
      if (rng.u() < o.probeP) {
        s.addPause(o.probeMs, 'probe')
        const nRe = pickReentrain(o, rng)
        for (let k = 0; k < nRe; k++) s.addBreath(B, 'reentrain')
      }
    }
  }
}

// Raised-cosine bump profile: weight of breath k (1..n) in an n-breath bump. Peaks at 1 in the
// middle (n = 3 → .5, 1, .5; n = 4 → .35, .90, .90, .35), so each breath differs from the last by
// at most about half the peak change.
export function bumpProfile(n) {
  return Array.from({ length: n }, (_, i) => Math.sin(Math.PI * (i + 1) / (n + 1)) ** 2)
}

function addBump(s, o, P, dir, peak, n, tag) {
  for (const w of bumpProfile(n)) s.addBreath(s.clamp(changed(P, dir, peak * w)), tag)
}

function runDoubleBump(s, o, rng, endMs) {
  const B = o.basePeriodMs
  if (s.breaths.length === 0) for (let k = 0; k < o.leadInBreaths; k++) s.addBreath(B, 'lead')
  // after a roving block the rate may not be at base: pause, so the return is not itself a change
  else if (s.breaths[s.breaths.length - 1].periodMs !== B) s.addPause(o.itiMs, 'iti')
  for (;;) {
    const nSettle = o.blipSettleMin + rng.geometric(o.blipSettleExtra)
    const single = rng.u() < o.bumpSingleP
    const gap = single ? null : o.bumpGaps[rng.int(0, o.bumpGaps.length - 1)]
    const sizeIdx = rng.int(0, o.bumpSizes.length - 1)
    const peak = Math.min(o.bumpSizes[sizeIdx] * o.m50Hat, 0.42)
    const width = o.bumpWidths[rng.int(0, o.bumpWidths.length - 1)]
    const dir = rng.sign()
    const nProbe = single ? width : 2 * width + gap
    const worst = (nSettle + nProbe + o.blipTailBreaths) * B * (1 + peak) + o.probeMs + 3 * B
    if (s.t + worst > endMs) break
    for (let k = 0; k < nSettle; k++) s.addBreath(B, 'stable')

    const onsetBreath = s.breaths.length
    const onsetMs = s.t
    addBump(s, o, B, dir, peak, width, 'dbump')
    if (!single) {
      for (let k = 0; k < gap; k++) s.addBreath(B, 'gap')
      addBump(s, o, B, dir, peak, width, 'dbump')
    }
    for (let k = 0; k < o.blipTailBreaths; k++) s.addBreath(B, 'tail')
    s.pushEvent({ type: single ? 'bump_single' : 'bump_pair', onsetMs, onsetBreath, windowEndMs: s.t,
                  dir, mag: peak, sizeIdx, gap, width,
                  fromPeriodMs: B, toPeriodMs: Math.round(changed(B, dir, peak)) })
    if (rng.u() < o.probeP) {
      s.addPause(o.probeMs, 'probe')
      const nRe = pickReentrain(o, rng)
      for (let k = 0; k < nRe; k++) s.addBreath(B, 'reentrain')
    }
  }
}

function runBumpTrain(s, o, rng, endMs) {
  const B = o.basePeriodMs
  if (s.breaths.length === 0) for (let k = 0; k < o.leadInBreaths; k++) s.addBreath(B, 'lead')
  let sinceProbe = 0
  for (;;) {
    if (s.t + 6 * B + o.probeMs > endMs) break
    if (rng.u() < o.bumpTrainP) {
      const rel = rng.logUniform(o.bumpTrainRelMin, o.bumpTrainRelMax)
      const peak = Math.min(rel * o.m50Hat, 0.42)
      const width = o.bumpWidths[rng.int(0, o.bumpWidths.length - 1)]
      const dir = rng.sign()
      const onsetBreath = s.breaths.length
      const onsetMs = s.t
      addBump(s, o, B, dir, peak, width, 'tbump')
      s.pushEvent({ type: 'bump', onsetMs, onsetBreath, windowEndMs: s.t + 3 * B, dir, mag: peak, relMag: rel,
                    width, fromPeriodMs: B, toPeriodMs: Math.round(changed(B, dir, peak)) })
      sinceProbe += width
      s.addBreath(B, 'stable')        // at least one normal breath between bumps
    } else {
      s.addBreath(B, 'stable')
    }
    if (++sinceProbe >= o.blipTrainProbeEvery) {
      sinceProbe = 0
      if (rng.u() < o.probeP) {
        s.addPause(o.probeMs, 'probe')
        const nRe = pickReentrain(o, rng)
        for (let k = 0; k < nRe; k++) s.addBreath(B, 'reentrain')
      }
    }
  }
}

// ── public API ──────────────────────────────────────────────────────────────
export function buildSchedule(design, options = {}) {
  if (!DESIGNS.includes(design)) throw new Error(`unknown design: ${design}`)
  const o = { ...DEFAULTS, ...options }
  const rng = makeRng(o.seed)
  const s = createBuilder(o)
  const totalMs = o.minutes * 60_000

  if (design === 'brief')  runBrief(s, o, rng, totalMs)
  if (design === 'roving') runRoving(s, o, rng, totalMs)
  if (design === 'trials') runTrials(s, o, rng, totalMs)
  if (design === 'ramp')   runRamp(s, o, rng, totalMs)
  if (design === 'roving_ramp') {
    runRoving(s, o, rng, totalMs * (1 - o.rampFrac))
    runRamp(s, o, rng, totalMs)
  }
  if (design === 'roving_mixed') runRovingMixed(s, o, rng, totalMs)
  if (design === 'double_blip') runDoubleBlip(s, o, rng, totalMs)
  if (design === 'blip_train') runBlipTrain(s, o, rng, totalMs)
  if (design === 'blip_combo') {
    runDoubleBlip(s, o, rng, totalMs * o.blipComboSplit)
    runBlipTrain(s, o, rng, totalMs)
  }
  if (design === 'double_bump') runDoubleBump(s, o, rng, totalMs)
  if (design === 'bump_train') runBumpTrain(s, o, rng, totalMs)
  if (design === 'roving_bump') {
    runRoving(s, o, rng, totalMs * (1 - o.rovingBumpFrac))
    runDoubleBump(s, o, rng, totalMs)
  }
  if (design === 'roving_ramp_bump') {
    runRoving(s, o, rng, totalMs * (1 - o.rrbBumpFrac - o.rrbRampFrac))
    runDoubleBump(s, o, rng, totalMs * (1 - o.rrbRampFrac))
    runRamp(s, o, rng, totalMs)
  }

  return {
    design,
    options: o,
    durationMs: Math.round(s.t),
    breaths: s.breaths,
    pauses: s.pauses,
    events: s.events,
  }
}

// Summary counts — what a design yields per session, before any responding.
export function scheduleYield(schedule) {
  const count = (type) => schedule.events.filter(e => e.type === type).length
  const pausedMs = schedule.pauses.reduce((a, p) => a + (p.endMs - p.startMs), 0)
  return {
    design: schedule.design,
    minutes: schedule.durationMs / 60_000,
    breaths: schedule.breaths.length,
    steps: count('step'),
    ramps: count('ramp'),
    nulls: count('null'),
    returns: count('return'),
    changesPerMin: (count('step') + count('ramp')) / (schedule.durationMs / 60_000),
    pausedShare: pausedMs / schedule.durationMs,
  }
}

// Pacer clock: phase in [0,1) (0 = inhale start) and breath index at time t,
// looked up from the schedule. Returns null during pauses and after the end.
export function pacerAt(schedule, tMs) {
  const b = schedule.breaths
  let lo = 0, hi = b.length - 1
  if (hi < 0 || tMs < b[0].startMs) return null
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (b[mid].startMs <= tMs) lo = mid; else hi = mid - 1
  }
  const br = b[lo]
  const into = tMs - br.startMs
  if (into >= br.periodMs) return null
  return { breath: lo, phase: into / br.periodMs, periodMs: br.periodMs }
}
