// ── BCAT threshold key log ─────────────────────────────────────────────────
//
// Pure, React-free and node-testable. Two halves:
//
// 1. Recording. createKeyLog() keeps every raw key-down and key-up of one trial as it arrives, with its time
//    on the trial clock (ms from the trial start, the clock pacerClock.js uses; the caller passes
//    event.timeStamp - trialStart). Auto-repeat key-downs while a key is held are counted, not logged, as in
//    the source build. A key already down when the trial starts is logged as 'held_at_onset', one still down
//    when it ends as 'held_at_offset' (the source build's names). Nothing is ever removed from the log.
//
// 2. Parsing and scoring. parseKeyLog() pairs the raw events into presses (one per key-down, every key-down
//    in exactly one press), then turns the pacer keys into one control timeline the way Kite does
//    (src/games/Kite/Kite.jsx: the most recently pressed key that is still held wins, nothing held is
//    'pause') and normalizes it with Kite's rule (src/games/Kite/breathShapes.js, normalizeSegments):
//      - a release shorter than MERGE_GAP_MS between two holds of the same phase is an accidental key-up:
//        the gap and both holds become one hold;
//      - a hold shorter than MIN_HOLD_MS is a slip, not a phase: it becomes pause;
//      - merge, then demote slips, then merge again (so rapid same-key tapping is rescued first, and a
//        hold interrupted by a slip of the other key is stitched back together).
//    The normalized grow and shrink holds are then scored against the planned half-pulses
//    (pacerClock.halfPulses): onset lag, offset lag, hold duration, and coverage. A press is labelled a
//    slip when no normalized hold of its phase contains any of it. Slips stay in the output, flagged.
//
// keyLog.test.mjs checks that normalizeSegments here gives the same result as Kite's own on random logs.

export const MERGE_GAP_MS = 300   // = Kite's MERGE_GAP_MS (breathShapes.js)
export const MIN_HOLD_MS = 300    // = Kite's MIN_HOLD_MS

/** 'grow' | 'shrink' | 'other': by the character typed, by the physical key only if the browser gives none. */
export function roleOf(key, code, keys) {
  const k = String(key || '').toLowerCase()
  if (k === keys.grow.key) return 'grow'
  if (k === keys.shrink.key) return 'shrink'
  if (!k || k === 'unidentified') {
    if (code === keys.grow.code) return 'grow'
    if (code === keys.shrink.code) return 'shrink'
  }
  return 'other'
}

/**
 * Which keys are down right now, across trials (to log 'held_at_onset', and so a touch or breath trial
 * can wait until W and S are up). Feed it every keydown and keyup.
 */
export function createKeyTracker() {
  const down = new Map()   // code -> { key, code }
  return {
    keydown({ key, code, repeat }) { if (!repeat) down.set(code, { key, code }) },
    keyup({ code }) { down.delete(code) },
    clear() { down.clear() },
    held() { return Array.from(down.values()) },
    isDown(code) { return down.has(code) },
  }
}

/**
 * The raw log of one trial.
 * @param {{ grow: {key, code}, shrink: {key, code} }} keys  config.keys
 */
export function createKeyLog(keys) {
  const events = []
  let repeats = 0, state = 'idle'
  const push = (type, key, code, t, tHandler) => {
    events.push({ i: events.length, type, key: key ?? null, code: code ?? null, role: roleOf(key, code, keys), t,
      t_handler: tHandler === undefined ? null : tHandler })
  }
  return {
    events,
    get repeats() { return repeats },
    get state() { return state },
    /** Start the trial at time t (normally 0); held = keys already down (createKeyTracker().held()). */
    begin(t = 0, held = []) {
      if (state !== 'idle') throw new Error('keyLog: begin() called twice')
      state = 'open'
      for (const h of held) push('held_at_onset', h.key, h.code, t, t)
    },
    keydown({ key, code, t, repeat = false, tHandler }) {
      if (state !== 'open') return false
      if (repeat) { repeats += 1; return false }
      push('keydown', key, code, t, tHandler)
      return true
    },
    keyup({ key, code, t, tHandler }) {
      if (state !== 'open') return false
      push('keyup', key, code, t, tHandler)
      return true
    },
    /** End the trial at time t; held = keys still down. Returns the log. */
    end(t, held = []) {
      if (state !== 'open') throw new Error('keyLog: end() without begin()')
      for (const h of held) push('held_at_offset', h.key, h.code, t, t)
      state = 'closed'
      return { events, repeats, end_t: t }
    },
  }
}

// ── Kite's normalization (breathShapes.js), with the thresholds as parameters ──
function coalesce(segments, mergeGapMs) {
  const out = []
  for (const s of segments) {
    const prev = out[out.length - 1]
    const prev2 = out[out.length - 2]
    if (prev && prev.phase === s.phase) {
      prev.t1 = s.t1
      continue
    }
    if (s.phase !== 'pause' && prev && prev2 &&
        prev.phase === 'pause' && prev.t1 - prev.t0 < mergeGapMs &&
        prev2.phase === s.phase) {
      out.pop()
      prev2.t1 = s.t1
      continue
    }
    out.push({ ...s })
  }
  return out
}

function demoteShortHolds(segments, minHoldMs) {
  return segments.map(s =>
    s.phase !== 'pause' && s.t1 - s.t0 < minHoldMs ? { ...s, phase: 'pause' } : s)
}

/** Kite's normalizeSegments: coalesce, demote slips, coalesce. Segments are {phase, t0, t1}; 'pause' is special. */
export function normalizeSegments(segments, { minHoldMs = MIN_HOLD_MS, mergeGapMs = MERGE_GAP_MS } = {}) {
  return coalesce(demoteShortHolds(coalesce(segments, mergeGapMs), minHoldMs), mergeGapMs)
}

// ── parsing ──────────────────────────────────────────────────────────────
const byTime = (a, b) => (a.t - b.t) || (a.i - b.i)

/** Pair raw events into presses, one per key-down (or held_at_onset), per physical key. */
export function pairPresses(events, { startMs = 0, endMs }) {
  if (typeof endMs !== 'number') throw new Error('pairPresses: endMs (the trial end on the trial clock) is required')
  const open = new Map()   // code -> press under way
  const presses = []
  const close = (p, t, upEvent, flags = {}) => {
    p.t1 = t; p.durationMs = t - p.t0; p.upEvent = upEvent
    Object.assign(p, flags)
    presses.push(p)
  }
  for (const e of [...events].sort(byTime)) {
    const k = e.code ?? e.key
    if (e.type === 'held_at_onset' || e.type === 'keydown') {
      const prev = open.get(k)
      if (prev) close(prev, e.t, null, { missingKeyup: true })   // a key-up the browser never sent (lost focus)
      open.set(k, { key: e.key, code: e.code, role: e.role, t0: e.t, t1: null, durationMs: null,
        downEvent: e.i, upEvent: null, heldAtStart: e.type === 'held_at_onset', heldAtEnd: false, missingKeyup: false, inferredStart: false })
    } else if (e.type === 'keyup') {
      const p = open.get(k)
      if (p) { open.delete(k); close(p, e.t, e.i) } else {
        // released, but its press came before the log began and was not reported as held: it was down from the start
        presses.push({ key: e.key, code: e.code, role: e.role, t0: startMs, t1: e.t, durationMs: e.t - startMs,
          downEvent: null, upEvent: e.i, heldAtStart: true, heldAtEnd: false, missingKeyup: false, inferredStart: true })
      }
    } else if (e.type === 'held_at_offset') {
      const p = open.get(k)
      if (p) { open.delete(k); close(p, e.t, e.i, { heldAtEnd: true }) }
    }
  }
  for (const p of open.values()) close(p, Math.max(endMs, p.t0), null, { heldAtEnd: true })
  presses.sort((a, b) => (a.t0 - b.t0) || ((a.downEvent ?? -1) - (b.downEvent ?? -1)))
  presses.forEach((p, i) => { p.press = i })
  return presses
}

/** The pacer keys as Kite's control: the most recently pressed role still held wins; nothing held is 'pause'. */
export function controlSegments(presses, { startMs = 0, endMs }) {
  const marks = []
  for (const p of presses) {
    if (p.role !== 'grow' && p.role !== 'shrink') continue
    marks.push({ t: p.t0, kind: 'press', role: p.role, ord: p.press })
    marks.push({ t: p.t1, kind: 'release', role: p.role, ord: p.press })
  }
  // at one instant: releases before presses, then by press order, so a hand-over does not invent an overlap
  marks.sort((a, b) => (a.t - b.t) || ((a.kind === 'release' ? 0 : 1) - (b.kind === 'release' ? 0 : 1)) || (a.ord - b.ord))
  const segments = []
  let held = [], control = 'pause', since = startMs
  const switchTo = (next, t) => {
    if (next === control) return
    if (t > since) segments.push({ phase: control, t0: since, t1: t })
    control = next; since = t
  }
  for (const m of marks) {
    const t = Math.min(Math.max(m.t, startMs), endMs)
    // Kite's press() and release(): a release lets go of the role, as Kite lets go of the kind
    if (m.kind === 'press') { held = [...held.filter(r => r !== m.role), m.role]; switchTo(m.role, t) } else {
      held = held.filter(r => r !== m.role)
      switchTo(held.length ? held[held.length - 1] : 'pause', t)
    }
  }
  if (endMs > since) segments.push({ phase: control, t0: since, t1: endMs })
  return segments
}

/**
 * Parse one trial's raw log.
 * @param {object[]} events  createKeyLog().events
 * @param {{ startMs?: number, endMs: number, minHoldMs?: number, mergeGapMs?: number }} opts
 * @returns {{ events, presses, segments, holds }}
 *   presses  — every key-down paired with its key-up; `slip` true for a pacer-key press that is in no hold
 *   segments — the normalized control timeline (grow / shrink / pause), contiguous from startMs to endMs
 *   holds    — its grow and shrink segments, each with the presses it contains
 */
export function parseKeyLog(events, opts) {
  const { startMs = 0, endMs, minHoldMs = MIN_HOLD_MS, mergeGapMs = MERGE_GAP_MS } = opts
  const presses = pairPresses(events, { startMs, endMs })
  const raw = controlSegments(presses, { startMs, endMs })
  const segments = normalizeSegments(raw, { minHoldMs, mergeGapMs })
  const holds = segments.filter(s => s.phase !== 'pause').map((s, i) => {
    const inside = presses.filter(p => p.role === s.phase && p.t0 < s.t1 && p.t1 > s.t0)
    return { hold: i, phase: s.phase, t0: s.t0, t1: s.t1, durationMs: s.t1 - s.t0, presses: inside.map(p => p.press),
      censoredStart: s.t0 <= startMs && inside.some(p => p.heldAtStart),
      censoredEnd: s.t1 >= endMs && inside.some(p => p.heldAtEnd) }
  })
  for (const p of presses) {
    p.short = p.durationMs < minHoldMs
    p.slip = (p.role === 'grow' || p.role === 'shrink') ? !holds.some(h => h.presses.includes(p.press)) : p.short
  }
  return { events, presses, segments, holds }
}

// ── scoring ──────────────────────────────────────────────────────────────
function median(xs) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Score normalized holds against the planned half-pulses.
 * A hold answers a half-pulse of its phase when it starts within ± onsetWindowFrac of that half's length of
 * the half's planned start (each hold answers at most one half; the closest onset wins). A hold already down
 * when the trial began has no onset to score, and one still down when it ended has no offset.
 * @param {ReturnType<typeof parseKeyLog>} parsed
 * @param {ReturnType<import('./pacerClock.js').halfPulses>} halves
 */
export function scoreHolds(parsed, halves, { onsetWindowFrac = 0.5 } = {}) {
  const { holds } = parsed
  const taken = new Set()
  const perHalf = halves.map(h => {
    let best = null
    for (const hd of holds) {
      if (hd.phase !== h.phase || taken.has(hd.hold) || hd.censoredStart) continue
      const lag = hd.t0 - h.startMs
      if (Math.abs(lag) > onsetWindowFrac * h.durationMs) continue
      if (!best || Math.abs(lag) < Math.abs(best.t0 - h.startMs)) best = hd
    }
    let overlap = 0
    for (const hd of holds) if (hd.phase === h.phase) overlap += Math.max(0, Math.min(hd.t1, h.endMs) - Math.max(hd.t0, h.startMs))
    if (best) taken.add(best.hold)
    return {
      half: h.half, pulseIndex: h.pulseIndex, phase: h.phase, leadIn: h.leadIn, changed: h.changed,
      plannedStartMs: h.startMs, plannedEndMs: h.endMs, plannedMs: h.durationMs,
      hold: best ? best.hold : null,
      onsetLagMs: best ? best.t0 - h.startMs : null,
      offsetLagMs: best && !best.censoredEnd ? best.t1 - h.endMs : null,
      holdMs: best && !best.censoredEnd ? best.durationMs : null,
      coverage: h.durationMs > 0 ? overlap / h.durationMs : null,
    }
  })
  const halfOfHold = new Map(perHalf.filter(r => r.hold !== null).map(r => [r.hold, r.half]))
  const perHold = holds.map(hd => ({ hold: hd.hold, phase: hd.phase, t0: hd.t0, t1: hd.t1, durationMs: hd.durationMs,
    half: halfOfHold.has(hd.hold) ? halfOfHold.get(hd.hold) : null }))
  const lags = perHalf.filter(r => r.onsetLagMs !== null).map(r => r.onsetLagMs)
  const cov = perHalf.filter(r => r.coverage !== null).map(r => r.coverage)
  const pacerPresses = parsed.presses.filter(p => p.role === 'grow' || p.role === 'shrink')
  return {
    halves: perHalf,
    holds: perHold,
    summary: {
      n_halves: halves.length,
      n_matched: lags.length,
      n_holds: holds.length,
      n_unmatched_holds: perHold.filter(h => h.half === null).length,
      n_pacer_presses: pacerPresses.length,
      n_slips: pacerPresses.filter(p => p.slip).length,
      median_onset_lag_ms: median(lags),
      mean_coverage: cov.length ? cov.reduce((a, b) => a + b, 0) / cov.length : null,
    },
  }
}
