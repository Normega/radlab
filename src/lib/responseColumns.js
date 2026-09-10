// Naming the administrations of an instrument that a session collects MORE THAN
// ONCE.
//
// Most instruments are collected once per session, so the session — its label or
// its study day — names the column and that is the end of it. An instrument
// asked repeatedly inside one sitting breaks that: Sandy Study 3 asks five
// sliders and a stress scale at up to three points of a single session, and
// every one of those ratings carries the same schedule_id, the same study day
// and the same session label. Named from the session alone they all resolve to
// one column, and only the last written survives.
//
// The within-session coordinate is the STEP. It is a protocol position — every
// participant's step 19 is the same moment of the same session — which is what
// separates it from occurrence numbering. An occurrence count says "the third
// time this person answered", which drifts apart between participants the
// moment anyone drops out midway, and reads as a timepoint to whoever opens the
// file (CLAUDE.md participant-data rule 3).

// Which subcategories this study administers more than once within a single
// session instance.
//
// Read off the step log, which is written per delivered step, so this is a fact
// about the protocol. Decided per STUDY rather than per participant on purpose:
// the suffix then applies to every participant's columns for that instrument,
// including someone who only ever reached the first administration. Deciding it
// per participant is what makes one person's `vas_stress_d1` mean a different
// moment from another's.
export function repeatedSubcatsFromSteps(stepRows) {
  const perSessionInstance = new Map()
  for (const r of stepRows ?? []) {
    if (!r?.subcategory || !r?.participant_schedule_id) continue
    const k = `${r.participant_schedule_id}\u0000${r.subcategory}`
    perSessionInstance.set(k, (perSessionInstance.get(k) ?? 0) + 1)
  }
  const out = new Set()
  for (const [k, n] of perSessionInstance) {
    if (n > 1) out.add(k.slice(k.indexOf('\u0000') + 1))
  }
  return out
}

// The suffix that distinguishes one administration from the others.
//
//   ''            collected once per session — the session already names it
//   '_s8'         the recorded step that collected it
//   '_xstep2'     repeated, but the step is unknown and could not be
//                 reconstructed. Deliberately not a step-shaped label: a
//                 confidently wrong position is worse than an obviously vague
//                 one (rule 4), and `_s2` would claim a protocol point this row
//                 cannot be shown to occupy.
export function administrationSuffix({ repeats, stepIndex, ordinal }) {
  if (!repeats) return ''
  if (stepIndex != null) return `_s${stepIndex}`
  return `_xstep${ordinal ?? 1}`
}

// Does this study repeat the scale behind a vas_responses row within a session?
// A scale reaches a participant either on its own step (`vas_<slug>`) or inside
// a package step (`vas_pkg_<slug>`), and either can be the repeated one.
export function vasRepeats(repeatedSubcats, rawSlug, packageSlug) {
  if (!repeatedSubcats) return false
  if (repeatedSubcats.has(`vas_${rawSlug}`)) return true
  return !!packageSlug && repeatedSubcats.has(`vas_pkg_${packageSlug}`)
}
