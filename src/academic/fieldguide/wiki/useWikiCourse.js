import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { normalizeCourseCode, pickNewestTerm } from '../../courseRoutes'

// Which course's wiki is being read: THE ONE IN THE URL. Slugs are unique per
// (course_id, slug), so every wiki query is course-scoped; this hook turns
// /academic/:courseCode into the courseId those queries need.
//
// History: the course used to live in sessionStorage ('fieldguide.courseId'),
// which made wiki URLs unshareable — the same link opened different courses
// for different people. The key is still read (only read) by the legacy
// redirect shim as a hint for old bookmarks; nothing writes it any more.
//
// The signature predates the URL scheme and is kept so consumers don't churn:
// `select(courseId)` now navigates to the same surface under the other
// course's code instead of writing storage.
export function useWikiCourse(enrollments) {
  const { courseCode } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Memoized on identity, not convenience: `course` sits in consumers'
  // effect dependency arrays (WikiIndex's loader), and rebuilding it every
  // render turned those effects into an infinite refetch loop — new object →
  // effect refires → setState → re-render → new object. At network speed
  // that was ~1.5 requests/second per open tab, ~1.5M wiki_pages hits in the
  // 24h before the 2026-09-03 fix. `enrollments` is upstream useState, so
  // its identity is stable between auth changes.
  const courses = useMemo(() => {
    const out = []
    for (const e of enrollments ?? []) {
      if (!out.some(c => c.course_id === e.course_id)) {
        out.push({ course_id: e.course_id, role: e.role, ...e.courses })
      }
    }
    return out
  }, [enrollments])

  const want = normalizeCourseCode(courseCode)
  const course = useMemo(
    () => (want ? pickNewestTerm(courses.filter(c => String(c.code ?? '').toLowerCase() === want)) : null),
    [courses, want])
  const courseId = course?.course_id ?? null

  const select = (id) => {
    const next = courses.find(c => c.course_id === id)
    if (!next || !want) return
    navigate(pathname.replace(`/academic/${want}`, `/academic/${String(next.code).toLowerCase()}`))
  }

  return { courseId, select, courses, course }
}
