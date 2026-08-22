// ── breathShapes ────────────────────────────────────────────────────────────
// Pure functions for the Free Breathing prototype: turn the raw hold/release
// segment log into per-breath phase durations, and those into shape data.
//
// A segment is { phase: 'in' | 'out' | 'pause', t0, t1 } in ms (performance.now
// timebase). The log starts at the first inhale press — anything before that
// is not recorded, so a leading pause never belongs to a breath.
//
// A breath is { inh, hold, exh, rest } in seconds:
//   inh  — total time the inhale control was held before the first exhale
//   hold — un-held time between inhale and exhale (top pause)
//   exh  — total time the exhale control was held
//   rest — un-held time after the exhale, until the next inhale (or Finish)
//
// The raw log is normalized before parsing (Norm, 2026-08-22):
//   - A raise shorter than MERGE_GAP_MS between two holds of the same phase is
//     an accidental key-up: the gap and both holds merge into one hold, so its
//     time counts as breathing, not as pause.
//   - An in/out hold shorter than MIN_HOLD_MS is a slip, not a phase: it
//     becomes pause, so rapid in/out flicker never mints a breath. (The face
//     still answers every press — animation reads the live control state, not
//     this parser.)
// Longer gaps between same-phase holds stay real pauses and land in the
// adjacent hold/rest. A breath closes when the next inhale begins, or at
// Finish. An inhale never followed by an exhale is not a breath and is
// dropped.

export const MERGE_GAP_MS = 300
export const MIN_HOLD_MS  = 300

// One pass, two jobs: fuse adjacent same-phase segments, and absorb a
// sub-MERGE_GAP_MS pause sitting between two holds of the same phase.
function coalesce(segments) {
  const out = []
  for (const s of segments) {
    const prev  = out[out.length - 1]
    const prev2 = out[out.length - 2]
    if (prev && prev.phase === s.phase) {
      prev.t1 = s.t1
      continue
    }
    if (s.phase !== 'pause' && prev && prev2 &&
        prev.phase === 'pause' && prev.t1 - prev.t0 < MERGE_GAP_MS &&
        prev2.phase === s.phase) {
      out.pop()
      prev2.t1 = s.t1
      continue
    }
    out.push({ ...s })
  }
  return out
}

function demoteShortHolds(segments) {
  return segments.map(s =>
    s.phase !== 'pause' && s.t1 - s.t0 < MIN_HOLD_MS ? { ...s, phase: 'pause' } : s)
}

// coalesce → demote → coalesce: the first pass rescues rapid same-key tapping
// into one long hold before the length test; the last stitches holds back
// together around a demoted slip (out · blip-in · out becomes one exhale).
export function normalizeSegments(segments) {
  return coalesce(demoteShortHolds(coalesce(segments)))
}

export function parseBreaths(segments) {
  const breaths = []
  let cur = null

  for (const s of normalizeSegments(segments)) {
    const dur = (s.t1 - s.t0) / 1000
    if (dur <= 0) continue

    if (s.phase === 'in') {
      if (cur && cur.seenOut) {
        breaths.push(finish(cur))
        cur = null
      }
      if (!cur) cur = { inh: 0, hold: 0, exh: 0, rest: 0, seenOut: false }
      cur.inh += dur
    } else if (s.phase === 'out') {
      if (!cur) continue
      cur.seenOut = true
      cur.exh += dur
    } else {
      if (!cur) continue
      if (cur.seenOut) cur.rest += dur
      else cur.hold += dur
    }
  }

  if (cur && cur.seenOut) breaths.push(finish(cur))
  return breaths
}

function finish({ inh, hold, exh, rest }) {
  return { inh, hold, exh, rest }
}

export function meanBreath(breaths) {
  const n = breaths.length
  if (n === 0) return { inh: 0, hold: 0, exh: 0, rest: 0 }
  const sum = breaths.reduce(
    (a, b) => ({ inh: a.inh + b.inh, hold: a.hold + b.hold, exh: a.exh + b.exh, rest: a.rest + b.rest }),
    { inh: 0, hold: 0, exh: 0, rest: 0 },
  )
  return { inh: sum.inh / n, hold: sum.hold / n, exh: sum.exh / n, rest: sum.rest / n }
}

// Longest single phase across all breaths — the shared scale, so every shape
// (overlay and small multiples) is drawn in the same seconds-per-pixel.
export function maxDuration(breaths) {
  let max = 0
  for (const b of breaths) max = Math.max(max, b.inh, b.hold, b.exh, b.rest)
  return Math.max(max, 0.001)
}
