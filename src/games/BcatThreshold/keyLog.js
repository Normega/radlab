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
//
// Keys are told apart by `code || key` (the physical key, or the character when the browser gives no code;
// an empty-string code counts as none, so it cannot merge every key into one).
//
// Losing focus. When the window loses focus the browser stops sending key events, so a key-up may never come
// and the key would look held for the rest of the trial (and be logged held_at_onset in the next). As Kite
// does (Kite.jsx: window 'blur' -> releaseAll, every key let go, control to pause), the page's blur handler
// calls tracker.releaseAll() and log.blur({ t }) (or log.blur({ t, tracker }), which does both). The blur is
// kept in the raw log as its own event. Parsing closes every press open at that moment at t, marked
// closedBy 'blur' (their real release time is unknown); a hold containing one is marked closedByBlur, and the
// parse carries `blurred`. scoreHolds leaves such holds out of onset lag and coverage, and gives no coverage
// for a half that overlaps the time focus was away (from the blur to the next key-down, or the trial end).
// A key-up that comes after the blur for a key the blur closed is kept and noted on that press; it is not a
// new press.
//
// Delivery races. An event's timestamp can be a little earlier than an event delivered before it: a key-up
// stamped just before the trial start (or before its own key-down) can arrive after begin(). Parsing never
// lets such a key-up end a press before the press (or the trial) started: it closes that press at the press
// start, duration 0, flagged upClamped. The raw event keeps its own timestamp. A key-down stamped before the
// trial start is likewise treated as down from the start (heldAtStart, downClamped).
//
// Known limit of the onset scoring (pending decision, not changed here): a hold scores against a half-pulse
// only if it starts within ± onsetWindowFrac (0.5) of that half's length of the half's planned start. So a
// steady lag of more than half a half-pulse (more than 1000 ms on a 4-s pulse, 650 ms on a 2.6-s one) is
// mis-assigned to the next half or left unscored. The raw events are always kept, so lag can be rescored
// offline with another rule.

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
/** How one physical key is told apart: its code, or its character when the browser gives no code ('' counts as none). */
export const keyId = (key, code) => code || key || null

export function createKeyTracker() {
  const down = new Map()   // keyId -> { key, code }
  return {
    keydown({ key, code, repeat }) { if (!repeat) down.set(keyId(key, code), { key, code }) },
    keyup({ key, code }) { down.delete(keyId(key, code)) },
    /** Window blur: every key let go (Kite's releaseAll), so the next trial logs no phantom held_at_onset. */
    releaseAll() { down.clear() },
    clear() { down.clear() },
    held() { return Array.from(down.values()) },
    isDown(codeOrKey) { return down.has(codeOrKey) },
  }
}

/**
 * The raw log of one trial.
 * @param {{ grow: {key, code}, shrink: {key, code} }} keys  config.keys
 */
export function createKeyLog(keys) {
  const events = []
  let repeats = 0, blurs = 0, state = 'idle'
  const push = (type, key, code, t, tHandler) => {
    events.push({ i: events.length, type, key: key ?? null, code: code ?? null, role: type === 'blur' ? null : roleOf(key, code, keys), t,
      t_handler: tHandler === undefined ? null : tHandler })
  }
  return {
    events,
    get repeats() { return repeats },
    get blurs() { return blurs },
    get state() { return state },
    /**
     * The window lost focus at t: every key counts as released (Kite's releaseAll). Kept in the raw log as a
     * 'blur' event. Pass the tracker to clear it too (it is cleared even between trials, when nothing is logged).
     */
    blur({ t, tHandler, tracker } = {}) {
      if (tracker) tracker.releaseAll()
      if (state !== 'open') return false
      blurs += 1
      push('blur', null, null, t, tHandler)
      return true
    },
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
      return { events, repeats, blurs, end_t: t }
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
const OPENS = new Set(['held_at_onset', 'keydown'])

// Each event's time for pairing (the raw event is never changed). In delivery order: nothing counts as before
// the trial start, and a key-up never counts as before the press of its key that was delivered ahead of it.
function pairingTimes(events, startMs) {
  const te = new Map(), lastOpen = new Map()
  for (const e of [...events].sort((a, b) => a.i - b.i)) {
    const k = keyId(e.key, e.code)
    let t = Math.max(e.t, startMs)
    if (OPENS.has(e.type)) lastOpen.set(k, t)
    else if (e.type === 'keyup' && lastOpen.has(k)) t = Math.max(t, lastOpen.get(k))
    te.set(e.i, t)
  }
  return te
}

/**
 * Pair raw events into presses, one per key-down (or held_at_onset), per physical key (keyId).
 * Each press: { key, code, role, t0, t1, durationMs, downEvent, upEvent, closedBy, heldAtStart, heldAtEnd,
 *   missingKeyup, inferredStart, downClamped, upClamped, keyupAfterBlur }
 *   closedBy — 'keyup' | 'next_keydown' (its key-up was never sent) | 'blur' (focus lost: release time unknown)
 *              | 'held_at_offset' | 'trial_end'
 *   downClamped / upClamped — its key-down / key-up was stamped before the trial start (or the key-up before
 *              its press), so t0 / t1 were moved up to it; the raw events keep their own times
 *   keyupAfterBlur — the event index of a key-up that came after a blur had already closed this press
 */
export function pairPresses(events, { startMs = 0, endMs }) {
  if (typeof endMs !== 'number') throw new Error('pairPresses: endMs (the trial end on the trial clock) is required')
  const te = pairingTimes(events, startMs)
  const open = new Map()         // keyId -> press under way
  const blurClosed = new Map()   // keyId -> press a blur closed, until its key goes down again
  const presses = []
  let blurSeen = false
  const newPress =(e, t0, flags) => ({ key: e.key, code: e.code, role: e.role, t0, t1: null, durationMs: null,
    downEvent: null, upEvent: null, closedBy: null, heldAtStart: false, heldAtEnd: false, missingKeyup: false,
    inferredStart: false, downClamped: false, upClamped: false, keyupAfterBlur: null, ...flags })
  const close = (p, t, upEvent, closedBy, flags = {}) => {
    p.t1 = Math.max(t, p.t0); p.durationMs = p.t1 - p.t0; p.upEvent = upEvent; p.closedBy = closedBy
    Object.assign(p, flags)
    presses.push(p)
  }
  const sorted = [...events].sort((a, b) => (te.get(a.i) - te.get(b.i)) || (a.i - b.i))
  for (const e of sorted) {
    const k = keyId(e.key, e.code), t = te.get(e.i)
    if (OPENS.has(e.type)) {
      const prev = open.get(k)
      if (prev) close(prev, t, null, 'next_keydown', { missingKeyup: true })   // a key-up the browser never sent
      blurClosed.delete(k)
      const downClamped = t !== e.t
      open.set(k, newPress(e, t, { downEvent: e.i, heldAtStart: e.type === 'held_at_onset' || downClamped, downClamped }))
    } else if (e.type === 'keyup') {
      const p = open.get(k)
      if (p) { open.delete(k); close(p, t, e.i, 'keyup', { upClamped: t !== e.t }) } else if (blurClosed.has(k)) {
        // the key-up of a press the blur already closed (the key was still down when focus came back)
        blurClosed.get(k).keyupAfterBlur = e.i
        blurClosed.delete(k)
      } else if (!blurSeen) {
        // released, but its press came before the log began and was not reported as held: it was down from the start
        const p2 = newPress(e, startMs, { heldAtStart: true, inferredStart: true })
        close(p2, t, e.i, 'keyup', { upClamped: t !== e.t })
      }
      // else: a key-up after a blur for a key never seen down (pressed while focus was away). Its press is
      // unknown, so none is invented; parseKeyLog lists it in unpairedKeyups.
    } else if (e.type === 'blur') {
      blurSeen = true
      for (const [kk, p] of open) { close(p, t, null, 'blur'); blurClosed.set(kk, p) }
      open.clear()
    } else if (e.type === 'held_at_offset') {
      const p = open.get(k)
      if (p) { open.delete(k); close(p, t, e.i, 'held_at_offset', { heldAtEnd: true }) }
    }
  }
  for (const p of open.values()) close(p, Math.max(endMs, p.t0), null, 'trial_end', { heldAtEnd: true })
  presses.sort((a, b) => (a.t0 - b.t0) || ((a.downEvent ?? -1) - (b.downEvent ?? -1)))
  presses.forEach((p, i) => { p.press = i })
  return presses
}

/** The pacer keys as Kite's control: the most recently pressed role still held wins; nothing held is 'pause'. */
export function controlSegments(presses, { startMs = 0, endMs }) {
  const marks = []
  for (const p of presses) {
    if (p.role !== 'grow' && p.role !== 'shrink') continue
    if (!(p.t1 > p.t0)) continue   // a press of length 0 (a clamped key-up) holds nothing; its release would sort before its press
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
 * @returns {{ events, presses, segments, holds, blurred, focusLost, unpairedKeyups }}
 *   presses  — every key-down paired with its key-up; `slip` true for a pacer-key press that is in no hold
 *   segments — the normalized control timeline (grow / shrink / pause), contiguous from startMs to endMs
 *   holds    — its grow and shrink segments, each with the presses it contains; closedByBlur when one of them
 *              was closed by a blur (its end is when focus was lost, not a release)
 *   blurred  — the window lost focus during the trial (there is a 'blur' event)
 *   focusLost — [{t0, t1}]: from each blur to the next key-down (the first sign focus is back), or the trial end
 *   unpairedKeyups — raw key-up event indices in no press (a key pressed while focus was away); kept, not scored
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
      censoredEnd: s.t1 >= endMs && inside.some(p => p.heldAtEnd),
      closedByBlur: inside.some(p => p.closedBy === 'blur') }
  })
  for (const p of presses) {
    p.short = p.durationMs < minHoldMs
    p.slip = (p.role === 'grow' || p.role === 'shrink') ? !holds.some(h => h.presses.includes(p.press)) : p.short
  }
  const clampT = t => Math.min(Math.max(t, startMs), endMs)
  const keydownTimes = events.filter(e => e.type === 'keydown').map(e => e.t)
  const focusLost = events.filter(e => e.type === 'blur').map(e => {
    const t0 = clampT(e.t)
    const back = keydownTimes.filter(t => t > t0)
    return { t0, t1: back.length ? clampT(Math.min(...back)) : endMs }
  })
  const used = new Set()
  for (const p of presses) { if (p.upEvent !== null) used.add(p.upEvent); if (p.keyupAfterBlur !== null) used.add(p.keyupAfterBlur) }
  const unpairedKeyups = events.filter(e => e.type === 'keyup' && !used.has(e.i)).map(e => e.i)
  return { events, presses, segments, holds, blurred: focusLost.length > 0, focusLost, unpairedKeyups }
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
 * Focus loss (excludeBlurred, the default): a hold closed by a blur answers no half and adds no coverage, and a
 * half that overlaps a focusLost interval is marked blurred and gets coverage null (left out of mean_coverage).
 * excludeBlurred: false scores them as if nothing happened (for offline comparison only).
 * @param {ReturnType<typeof parseKeyLog>} parsed
 * @param {ReturnType<import('./pacerClock.js').halfPulses>} halves
 */
export function scoreHolds(parsed, halves, { onsetWindowFrac = 0.5, excludeBlurred = true } = {}) {
  const { holds } = parsed
  const focusLost = parsed.focusLost || []
  const usable = hd => !(excludeBlurred && hd.closedByBlur)
  const taken = new Set()
  const perHalf = halves.map(h => {
    let best = null
    for (const hd of holds) {
      if (hd.phase !== h.phase || taken.has(hd.hold) || hd.censoredStart || !usable(hd)) continue
      const lag = hd.t0 - h.startMs
      if (Math.abs(lag) > onsetWindowFrac * h.durationMs) continue
      if (!best || Math.abs(lag) < Math.abs(best.t0 - h.startMs)) best = hd
    }
    let overlap = 0
    for (const hd of holds) if (hd.phase === h.phase && usable(hd)) overlap += Math.max(0, Math.min(hd.t1, h.endMs) - Math.max(hd.t0, h.startMs))
    if (best) taken.add(best.hold)
    const blurred = focusLost.some(f => f.t0 < h.endMs && f.t1 > h.startMs) ||
      holds.some(hd => hd.closedByBlur && hd.phase === h.phase && hd.t0 < h.endMs && hd.t1 > h.startMs)
    return {
      half: h.half, pulseIndex: h.pulseIndex, phase: h.phase, leadIn: h.leadIn, changed: h.changed,
      plannedStartMs: h.startMs, plannedEndMs: h.endMs, plannedMs: h.durationMs,
      hold: best ? best.hold : null,
      onsetLagMs: best ? best.t0 - h.startMs : null,
      offsetLagMs: best && !best.censoredEnd ? best.t1 - h.endMs : null,
      holdMs: best && !best.censoredEnd ? best.durationMs : null,
      coverage: h.durationMs > 0 && !(excludeBlurred && blurred) ? overlap / h.durationMs : null,
      blurred,
    }
  })
  const halfOfHold = new Map(perHalf.filter(r => r.hold !== null).map(r => [r.hold, r.half]))
  const perHold = holds.map(hd => ({ hold: hd.hold, phase: hd.phase, t0: hd.t0, t1: hd.t1, durationMs: hd.durationMs,
    closedByBlur: !!hd.closedByBlur, half: halfOfHold.has(hd.hold) ? halfOfHold.get(hd.hold) : null }))
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
      blurred: !!parsed.blurred,
      n_blur_closed_holds: holds.filter(hd => hd.closedByBlur).length,
      n_blurred_halves: perHalf.filter(r => r.blurred).length,
      median_onset_lag_ms: median(lags),
      mean_coverage: cov.length ? cov.reduce((a, b) => a + b, 0) / cov.length : null,
    },
  }
}
