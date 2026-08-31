// studyDayPosition — the "Study Day N of M" a participant is told they are on.
//
// Two wrong answers have already shipped here, and each was wrong in a way the
// app could not show — only the participant's inbox could.
//
//   1. `participant_schedule.study_day` (date-derived: days since t0, plus one).
//      Any real-world slippage inflates it, so a participant who used the full
//      3-day midpoint window got emailed a number that climbed past the
//      protocol's own day map. Observed 2026-08-13: a session the protocol
//      calls Day 28 rendered as "Study Day 39".
//
//   2. The rank of the session's `study_sessions.day_number` among the study's
//      distinct day_numbers. That fixed the drift but swapped in a different
//      wrong fact: day_number is the CANONICAL compiled slot, identical for
//      everyone, while a counterbalance node means each participant walks the
//      blocks in their own order. Observed 2026-08-31: a volunteer whose first
//      Phase 1 block was drawn last in the compiled order was greeted, on her
//      very first email, with "Study Day 10 of 27" — then watched the number
//      run 10, 11, 12, 13, 6, 7, 8, 9, 2 … as she worked through the study.
//
// Both were inferences. The recorded fact is the participant's own traversal:
// this is the Nth session their schedule has handed them, whatever order the
// counterbalance drew. That is immune to date drift (it counts rows, not days)
// and immune to arm assignment (it counts THEIR rows), and it agrees with the
// old day_number rank for any participant who happens to draw canonical order —
// so nothing regresses for the studies that looked correct.
//
// The denominator stays the study's distinct day_number count: a participant
// traverses exactly one arm, and each distinct day_number appears once in any
// single traversal, so it is the same M for everyone and — unlike counting the
// participant's own rows — it does not grow as forks resolve and materialize
// more of the schedule.

/** One row of a participant's schedule, as far as ordering is concerned. */
export interface ScheduleRow {
  id: string
  scheduled_date: string | null
  send_time: string | null
}

/**
 * 1-based position of `rowId` in the participant's own schedule, ordered the
 * way they actually receive it. Null when the row isn't in the list.
 *
 * Missed and skipped rows still count: they were handed to the participant and
 * kept their slot in the sequence, so excluding them would renumber every
 * session after a miss (and silently disagree with any earlier email).
 */
export function scheduleRank(rows: ScheduleRow[], rowId: string): number | null {
  // Null send_time sorts first within its date — arbitrary but deterministic,
  // and id breaks the remaining ties so the answer never depends on row order
  // coming back from the database.
  const sorted = [...rows].sort((a, b) =>
    (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '') ||
    (a.send_time ?? '').localeCompare(b.send_time ?? '') ||
    a.id.localeCompare(b.id))

  const idx = sorted.findIndex(r => r.id === rowId)
  return idx === -1 ? null : idx + 1
}

export interface DayPositionInput {
  /** Every non-null day_number in the study's compiled sessions. Dupes fine —
   *  parallel arms share day_numbers (Phase 2 Day 1 exists once per condition)
   *  and a participant traverses exactly one, so they are counted distinctly. */
  studyDayNumbers: number[]
  /** This row's position in the participant's own schedule (scheduleRank). */
  position: number | null
  /** This row's compiled day_number, if it has a session. Used only as the
   *  fallback ordinal when the participant's own schedule is unavailable. */
  sessionDayNumber: number | null
}

export interface DayPosition {
  /** Renders as {{study_day}}. Null => the caller's own fallback. */
  ordinal: number | null
  /** Renders as the " of M" suffix. Null => bare "Study Day N". */
  total: number | null
}

export function studyDayPosition(input: DayPositionInput): DayPosition {
  const { studyDayNumbers, position, sessionDayNumber } = input

  const days = [...new Set(studyDayNumbers)].sort((a, b) => a - b)
  const total = days.length > 0 ? days.length : null

  // No compiled day map: nothing to count out of, and no fallback rank to
  // take. Single-shot studies land here and keep their previous behaviour.
  if (total === null) return { ordinal: position, total: null }

  let ordinal = position
  if (ordinal === null && sessionDayNumber !== null) {
    // The participant's schedule couldn't be read. The canonical rank is the
    // inference this module exists to avoid, but it beats no number at all,
    // and it is right for anyone in canonical order.
    const idx = days.indexOf(sessionDayNumber)
    ordinal = idx === -1 ? null : idx + 1
  }

  if (ordinal === null) return { ordinal: null, total: null }

  // A position past the end of the day map means the schedule holds more rows
  // than the protocol has days — a repeat, or a re-materialization. The
  // position is still a recorded fact; "of 27" would be a false claim, so drop
  // the claim rather than the number (never assert a label you can't show).
  if (ordinal > total) return { ordinal, total: null }

  return { ordinal, total }
}
