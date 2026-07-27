import { useState } from 'react'

const KEY = 'fieldguide.courseId'

// Which course's wiki is being read. One course exists today, but slugs are
// unique per (course_id, slug) rather than globally, so every wiki query is
// course-scoped from the start — and the choice is remembered across the
// index → page → back navigation instead of resetting to the first course.
export function useWikiCourse(enrollments) {
  const courses = []
  for (const e of enrollments ?? []) {
    if (!courses.some(c => c.course_id === e.course_id)) {
      courses.push({ course_id: e.course_id, role: e.role, ...e.courses })
    }
  }

  const [courseId, setCourseId] = useState(() => {
    const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null
    return courses.some(c => c.course_id === saved) ? saved : courses[0]?.course_id
  })

  const select = (id) => {
    try { sessionStorage.setItem(KEY, id) } catch { /* private mode — in-memory is fine */ }
    setCourseId(id)
  }

  return { courseId, select, courses, course: courses.find(c => c.course_id === courseId) }
}
