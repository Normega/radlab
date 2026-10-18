// ── BCAT-DDM pre-run: speeding and slowing thresholds ─────────────────────
//
// Pure and node-testable, like schedule.js. The pre-run is a short version of the
// main task: one free-response roving stream of steps, with the same pacer and
// button. A press within the 5-breath window after a change (plus graceMs for
// motor time, as the prototype scores the main task) counts as noticing it.
// Presses in the 1-3 steady breaths before each change measure false alarms.
//
// Each change's size is chosen by a QUEST-style Bayesian grid: logistic
// detection in log size with a fixed slope, a false-alarm rate and a small
// lapse rate. Speeding and slowing get separate thresholds (decided 2026-10-15).
// Each change's direction follows the main task's rule (schedule.js
// chooseStep). The simulation of this procedure is
// scripts/bcat_ddm_sim/run_prerun.py (plan §6h): about 24 changes, 11 minutes.
//
// Unlike a schedule, the pre-run cannot be precomputed, because each size
// depends on the responses so far. createPrerun() keeps a schedule-shaped
// { breaths, pauses, events } and appends to it as the stream clock reaches its
// end, so pacerAt() works unchanged. The caller drives it with
// advanceTo(streamMs) and press(streamMs).
//
// The result's m50Faster / m50Slower mean what the main task's m50HatFaster /
// m50HatSlower mean: the size noticed in half of the 5-breath windows.

import { DEFAULTS, mulberry32, chooseStep } from './schedule.js'

export const PRERUN_DEFAULTS = {
  nChanges:      24,
  seed:          1,
  separate:      true,     // one threshold per direction; false = one shared threshold
  basePeriodMs:  DEFAULTS.basePeriodMs,
  minRatio:      DEFAULTS.minRatio,
  maxRatio:      DEFAULTS.maxRatio,
  leadInBreaths: 4,
  gapMin:        1,        // steady breaths before each change, inclusive range
  gapMax:        3,
  windowBreaths: 5,
  graceMs:       1000,     // a press this long after a window closes still counts for it

  // the grid model (run_prerun.py)
  slope:         0.39,     // logistic scale in log size, fitted to the simulated observers
  lapse:         0.03,
  muMin:         0.02,     // threshold grid: muN log-spaced sizes
  muMax:         0.9,
  muN:           81,
  faMinPerMin:   0.05,     // false-alarm rate grid: faN log-spaced rates
  faMaxPerMin:   2,
  faN:           15,
  priorM:        0.2,      // prior on the threshold: log-normal around a 20% change
  priorSd:       0.7,
  magMin:        0.03,     // the sizes the pre-run will present
  magMax:        0.6,
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1))

// The Bayesian grid. Directions: −1 faster, +1 slower. With `separate`, the
// posterior is over (faster threshold, slower threshold, false-alarm rate);
// otherwise over (one threshold, false-alarm rate).
export function createQuest(options = {}, separate = true) {
  const o = { ...PRERUN_DEFAULTS, ...options }
  const MU = Float64Array.from(linspace(Math.log(o.muMin), Math.log(o.muMax), o.muN))
  const HFA = Float64Array.from(linspace(Math.log(o.faMinPerMin / 60), Math.log(o.faMaxPerMin / 60), o.faN), Math.exp)
  const nM = MU.length
  const nH = HFA.length
  const prior = MU.map(m => -0.5 * ((m - Math.log(o.priorM)) / o.priorSd) ** 2)
  const lp = new Float64Array(separate ? nM * nM * nH : nM * nH)
  for (let i = 0; i < nM; i++) {
    if (!separate) { lp.fill(prior[i], i * nH, (i + 1) * nH); continue }
    for (let j = 0; j < nM; j++) lp.fill(prior[i] + prior[j], (i * nM + j) * nH, (i * nM + j + 1) * nH)
  }

  let cache = null
  function marginals() {
    if (cache) return cache
    let max = -Infinity
    for (let c = 0; c < lp.length; c++) if (lp[c] > max) max = lp[c]
    const fast = new Float64Array(nM)
    const slow = new Float64Array(nM)
    const fa = new Float64Array(nH)
    let total = 0
    for (let c = 0; c < lp.length; c++) {
      const p = Math.exp(lp[c] - max)
      const k = c % nH
      const cell = (c - k) / nH
      fa[k] += p
      if (separate) { fast[Math.floor(cell / nM)] += p; slow[cell % nM] += p } else fast[cell] += p
      total += p
    }
    for (const a of [fast, slow, fa]) for (let i = 0; i < a.length; i++) a[i] /= total
    cache = { fast, slow: separate ? slow : fast, fa }
    return cache
  }
  const marginal = (dir) => (dir > 0 ? marginals().slow : marginals().fast)
  const mean = (p, x) => p.reduce((s, pi, i) => s + pi * x[i], 0)

  const q = {
    separate,
    // a change of size `mag` in direction `dir`, with a window of wSec seconds
    updateChange(dir, mag, wSec, hit) {
      const ll = new Float64Array(nM * nH)
      for (let i = 0; i < nM; i++) {
        const pdet = (1 - o.lapse) / (1 + Math.exp(-(Math.log(mag) - MU[i]) / o.slope))
        for (let k = 0; k < nH; k++) {
          const ph = clamp(1 - Math.exp(-HFA[k] * wSec) * (1 - pdet), 1e-9, 1 - 1e-9)
          ll[i * nH + k] = Math.log(hit ? ph : 1 - ph)
        }
      }
      if (!separate) for (let c = 0; c < ll.length; c++) lp[c] += ll[c]
      else {
        for (let i = 0; i < nM; i++) for (let j = 0; j < nM; j++) {
          const from = (dir < 0 ? i : j) * nH
          const to = (i * nM + j) * nH
          for (let k = 0; k < nH; k++) lp[to + k] += ll[from + k]
        }
      }
      cache = null
    },
    // gSec seconds of steady breaths, with or without a press
    updateGap(gSec, pressed) {
      const add = HFA.map(h => {
        const stay = clamp(Math.exp(-h * gSec), 1e-12, 1 - 1e-12)
        return Math.log(pressed ? 1 - stay : stay)
      })
      for (let c = 0; c < lp.length; c++) lp[c] += add[c % nH]
      cache = null
    },
    muHat: (dir) => mean(marginal(dir), MU),
    muSd(dir) {
      const p = marginal(dir)
      const m = mean(p, MU)
      return Math.sqrt(p.reduce((s, pi, i) => s + pi * (MU[i] - m) ** 2, 0))
    },
    faHat: () => mean(marginals().fa, HFA),                  // false alarms per second
    nextMag: (dir) => clamp(Math.exp(q.muHat(dir)), o.magMin, o.magMax),
    // The size giving 50% hits in a window of wRefSec: what m50Hat means to the main task
    m50Hat(dir, wRefSec) {
      const stay = Math.exp(-q.faHat() * wRefSec)
      const F = clamp((1 - 0.5 / stay) / (1 - o.lapse), 0.02, 0.98)
      return Math.exp(q.muHat(dir) + o.slope * Math.log(F / (1 - F)))
    },
  }
  return q
}

export function createPrerun(options = {}) {
  const o = { ...PRERUN_DEFAULTS, ...options }
  const r = mulberry32(o.seed)
  const rng = { u: r, sign: () => (r() < 0.5 ? -1 : 1) }
  const quest = createQuest(o, o.separate)
  // the one-threshold reading of the same responses, kept for comparison
  const quests = o.separate ? [quest, createQuest(o, false)] : [quest]
  const shared = quests[quests.length - 1]
  const wRefSec = (o.windowBreaths * o.basePeriodMs + o.graceMs) / 1000
  const schedule = { design: 'prerun', options: o, durationMs: 0, breaths: [], pauses: [], events: [] }
  const presses = []
  const history = []
  let t = 0
  let P = o.basePeriodMs
  let phase = 'gap'          // what was appended last: 'gap' → a change is next, 'window' → steady breaths, 'tail' → the end
  let gapStartMs = 0
  let done = false

  const addBreath = (periodMs, tag) => {
    schedule.breaths.push({ i: schedule.breaths.length, startMs: Math.round(t), periodMs: Math.round(periodMs), tag })
    t += Math.round(periodMs)
    schedule.durationMs = t
  }
  const pressedIn = (a, b) => presses.find(ms => ms >= a && ms < b)
  const m50 = (dir, qq = quest) => clamp(qq.m50Hat(dir, wRefSec), o.muMin, o.muMax)

  for (let k = 0; k < o.leadInBreaths; k++) addBreath(P, 'lead')
  addGap()

  function addGap() {
    const n = o.gapMin + Math.floor(r() * (o.gapMax - o.gapMin + 1))
    for (let k = 0; k < n; k++) addBreath(P, 'stable')
  }

  // The last change's window (if its grace has passed by `nowMs`), then the steady breaths since it
  function score(nowMs) {
    const e = schedule.events[schedule.events.length - 1]
    if (e && e.hit == null && nowMs >= e.windowEndMs + o.graceMs) {
      const end = e.windowEndMs + o.graceMs
      const p = pressedIn(e.onsetMs, end)
      e.hit = p != null
      e.pressMs = p ?? null
      for (const qq of quests) qq.updateChange(e.dir, e.mag, (end - e.onsetMs) / 1000, e.hit)
      gapStartMs = end
      history.push({ n: schedule.events.length, event_id: e.id, dir: e.dir, mag: e.mag, hit: e.hit,
                     m50Faster: m50(-1), m50Slower: m50(1), m50Shared: m50(0, shared),
                     faPerMin: quest.faHat() * 60 })
    }
    if (nowMs > gapStartMs && !(e && e.hit == null)) {
      for (const qq of quests) qq.updateGap((nowMs - gapStartMs) / 1000, pressedIn(gapStartMs, nowMs) != null)
      gapStartMs = nowMs
    }
  }

  function change() {
    const ask = { ...o, m50HatFaster: quest.nextMag(-1), m50HatSlower: quest.nextMag(1) }
    const { dir, mag, newPeriod } = chooseStep(null, ask, rng, P, 1, true)
    const onsetMs = t
    const onsetBreath = schedule.breaths.length
    for (let k = 0; k < o.windowBreaths; k++) addBreath(newPeriod, 'window')
    schedule.events.push({ id: schedule.events.length, type: 'step', onsetMs, onsetBreath, windowEndMs: t,
                           dir, mag, asked: dir > 0 ? ask.m50HatSlower : ask.m50HatFaster,
                           fromPeriodMs: Math.round(P), toPeriodMs: Math.round(newPeriod), hit: null, pressMs: null })
    P = newPeriod
  }

  const lastEvent = () => schedule.events[schedule.events.length - 1]
  const nextAt = () => (phase === 'tail' ? lastEvent().windowEndMs + o.graceMs : t)

  function step() {
    if (phase === 'gap') {             // a change starts now
      score(t)
      change()
      phase = 'window'
    } else if (phase === 'window') {   // the window ends now
      if (schedule.events.length < o.nChanges) { addGap(); phase = 'gap'; return }
      while (t < lastEvent().windowEndMs + o.graceMs) addBreath(P, 'tail')
      phase = 'tail'
    } else {                           // the last window's grace has passed
      score(nextAt())
      done = true
    }
  }

  return {
    schedule,
    options: o,
    history,
    presses,
    get done() { return done },
    get nScored() { return history.length },
    // the expected length, for a progress bar (it varies with the sizes chosen)
    expectedMs: (o.leadInBreaths + o.nChanges * ((o.gapMin + o.gapMax) / 2 + o.windowBreaths)) * o.basePeriodMs,
    advanceTo(ms) {
      while (!done && ms >= nextAt()) step()
    },
    press(ms) {
      if (!done) presses.push(ms)
    },
    // End early: score what has closed by `ms`, drop a change whose window is still open
    stop(ms) {
      if (done) return
      score(ms)
      done = true
    },
    result() {
      const scored = schedule.events.filter(e => e.hit != null)
      const dirs = (d) => scored.filter(e => e.dir === d)
      const inWindow = (ms) => scored.some(e => ms >= e.onsetMs && ms < e.windowEndMs + o.graceMs)
      return {
        separate: o.separate,
        nChanges: scored.length,
        m50Faster: m50(-1),
        m50Slower: m50(1),
        m50Shared: m50(0, shared),
        sdFaster: quest.muSd(-1),      // posterior SD of each log threshold
        sdSlower: quest.muSd(1),
        faPerMin: quest.faHat() * 60,
        nFaster: dirs(-1).length,
        hitsFaster: dirs(-1).filter(e => e.hit).length,
        nSlower: dirs(1).length,
        hitsSlower: dirs(1).filter(e => e.hit).length,
        otherPresses: presses.filter(ms => !inWindow(ms)).length,
      }
    },
  }
}
