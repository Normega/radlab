// The path and course-resolution vocabulary for /academic/:courseCode routes.
//
// One module, three jobs:
//   1. Path builders — the ONLY place course-scoped URLs are spelled out.
//   2. Term ordering — "/academic/psy240" resolves to the NEWEST term's course
//      row, so that a new term (PSY240 2027F) archives the old one simply by
//      existing: the old row keeps all its data but no student- or
//      staff-facing path resolves to it any more.
//   3. resolveEnrolledCourse — the guard-side lookup, carrying the same
//      invariant as staffCourses.resolveCourse: a code that does not resolve
//      returns null and NEVER falls back to another course the caller can
//      see. A wrong course is worse than an error page.
//
// Deliberately dependency-free (no React, no router): src/lib/supabase.js
// imports FIELD_GUIDE_SEGMENTS at module load for its auth-detection
// predicate, and pulling anything heavier in here would drag academic code
// into the entry bundle.

const lc = (code) => String(code ?? '').trim().toLowerCase()

// Course codes are 'PSY240' in the database and 'psy240' in URLs — the same
// token in different cases, matching the classes.slug convention on the main
// project.
export const normalizeCourseCode = (param) => {
  const v = lc(param)
  return v === '' ? null : v
}

// ── Path builders ──────────────────────────────────────────────────────────

export const coursePath    = (code) => `/academic/${lc(code)}`
export const loungePath    = (code) => `/academic/${lc(code)}/lounge`
export const joinPath      = (code) => `/academic/${lc(code)}/join`
export const wikiBase      = (code) => `/academic/${lc(code)}/wiki`
export const courseSubPath = (code, seg) => `/academic/${lc(code)}/${seg}`

// The Field Guide surfaces that live under /academic/:courseCode/<seg>.
// Shared with src/lib/authDetectRoutes.js: these are the segments where the
// ACADEMIC project's auth links may land, so the MAIN client must not consume
// auth codes there. 'lounge' is intentionally absent — it is a main-project
// surface.
export const FIELD_GUIDE_SEGMENTS = new Set([
  'wiki', 'join', 'gaps', 'whats-new',
  'ingest', 'review', 'submissions', 'corrections', 'roster', 'read', 'reports',
])

// ── Term ordering ──────────────────────────────────────────────────────────

// Terms look like '2026F'. A plain string sort mis-orders seasons within a
// year (alphabetically F < S < W, chronologically Winter < Summer < Fall), so
// the season letter gets an explicit rank. 'Y' (full-year) sorts before its
// sessions. THIS MAP is the one place to fix if a new term code ever appears;
// an unknown letter ranks above all known ones so a typo'd term is at least
// visible (it wins newest) rather than silently buried.
const SEASON_RANK = { Y: 0, W: 1, S: 2, F: 3 }

export function termSortKey(term) {
  const m = String(term ?? '').trim().match(/^(\d{4})\s*([A-Za-z]?)/)
  if (!m) return -1
  const year = Number(m[1])
  const season = m[2] ? (SEASON_RANK[m[2].toUpperCase()] ?? 5) : 0
  return year * 10 + season
}

// Rows may be course rows ({term}) or enrollment rows ({courses:{term}}).
export function pickNewestTerm(rows) {
  let best = null, bestKey = -Infinity
  for (const row of rows ?? []) {
    if (!row) continue
    const term = row.term ?? row.courses?.term
    const key = termSortKey(term)
    // Deterministic tie-break by term string so equal keys can't flap with
    // input order.
    if (key > bestKey || (key === bestKey && best !== null &&
        String(term) > String(best.term ?? best.courses?.term))) {
      best = row
      bestKey = key
    }
  }
  return best
}

// ── Guard-side resolution ──────────────────────────────────────────────────

// Which of the caller's enrollments does /academic/:courseCode address?
// All enrollments whose course code matches (case-insensitively), newest term
// wins. Null on no match — never another course. Note the reach of this rule:
// after a term rollover, a student enrolled only in the OLD term still
// matches here, which is why the rollover reset deactivates old enrollments
// (the guard's status='active' filter is what actually ends old-term access).
export function resolveEnrolledCourse(enrollments, courseCode) {
  const want = normalizeCourseCode(courseCode)
  if (!want) return null
  const matches = (enrollments ?? []).filter(e => lc(e?.courses?.code) === want)
  return matches.length ? pickNewestTerm(matches) : null
}
