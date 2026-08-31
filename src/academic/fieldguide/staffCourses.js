// Which course a roster page is operating on.
//
// Pulled out of RosterAdmin so the one rule that matters here is testable
// without mounting a component: a course code that does not resolve returns
// null, and NEVER falls back to some other course the caller happens to staff.
// The page's next click can be a several-hundred-row import or a bulk invite,
// so "close enough" is the wrong failure mode — a wrong course is worse than
// an error message.
//
// This replaced `staffEnrollments[0]`, which picked by array position. That
// made PSY309's roster unreachable (whichever course sorted first was the only
// one openable) and made the answer depend on Postgres row order.

export const rosterPath = (code) =>
  `/academic/fieldguide/roster/${String(code).toLowerCase()}`

// One entry per course, sorted by code. Deduped because one person can hold
// two enrollments in the same course (ta AND instructor), which would
// otherwise render as two identical choices.
export function staffedCourses(staffEnrollments) {
  const byCode = new Map()
  for (const e of staffEnrollments ?? []) {
    const code = e?.courses?.code
    if (code && !byCode.has(code)) byCode.set(code, e)
  }
  return [...byCode.values()].sort((a, b) => a.courses.code.localeCompare(b.courses.code))
}

// Case-insensitive because the URL carries `psy240` while the course row says
// `PSY240`. Trimmed because a pasted URL can carry stray whitespace. Anything
// that does not match exactly one staffed course is null.
export function resolveCourse(courses, courseCode) {
  if (!courseCode) return null
  const want = String(courseCode).trim().toLowerCase()
  if (!want) return null
  return (courses ?? []).find(e => e?.courses?.code?.toLowerCase() === want) ?? null
}
