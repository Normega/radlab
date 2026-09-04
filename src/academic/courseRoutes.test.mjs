// Run directly:  node --experimental-strip-types src/academic/courseRoutes.test.mjs
//
// Two safety properties, in staffCourses.test.mjs style:
//   1. resolveEnrolledCourse returns null on any non-exact code — never a
//      fallback to another course (the invariant staffCourses.resolveCourse
//      established; a wrong course is worse than an error page).
//   2. termSortKey orders terms CHRONOLOGICALLY, not alphabetically — the
//      naive string sort puts 2026F before 2026S before 2026W, which reverses
//      the actual year (Winter Jan, Summer May, Fall Sep).

import assert from 'node:assert/strict'
import {
  normalizeCourseCode, coursePath, loungePath, joinPath, wikiBase, courseSubPath,
  FIELD_GUIDE_SEGMENTS, termSortKey, pickNewestTerm, resolveEnrolledCourse,
} from './courseRoutes.js'

let pass = 0
const check = (name, fn) => { fn(); pass++; void name }

const enr = (code, term, role = 'student') => ({
  id: `${code}-${term}-${role}`, role, status: 'active', course_id: `id-${code}-${term}`,
  courses: { code, name: `${code} course`, term },
})

check('path builders lowercase the code', () => {
  assert.equal(coursePath('PSY240'), '/academic/psy240')
  assert.equal(loungePath('PSY240'), '/academic/psy240/lounge')
  assert.equal(joinPath('psy309'), '/academic/psy309/join')
  assert.equal(wikiBase('PSY309'), '/academic/psy309/wiki')
  assert.equal(courseSubPath('PSY240', 'roster'), '/academic/psy240/roster')
})

check('normalizeCourseCode trims, lowercases, nulls empties', () => {
  assert.equal(normalizeCourseCode(' PSY240 '), 'psy240')
  assert.equal(normalizeCourseCode(''), null)
  assert.equal(normalizeCourseCode('   '), null)
  assert.equal(normalizeCourseCode(undefined), null)
  assert.equal(normalizeCourseCode(null), null)
})

check('FIELD_GUIDE_SEGMENTS covers the fieldguide surfaces and excludes lounge', () => {
  for (const s of ['wiki', 'join', 'gaps', 'whats-new', 'roster', 'ingest']) {
    assert.ok(FIELD_GUIDE_SEGMENTS.has(s), s)
  }
  assert.ok(!FIELD_GUIDE_SEGMENTS.has('lounge'))
  assert.ok(!FIELD_GUIDE_SEGMENTS.has('admin'))
})

check('termSortKey orders chronologically within a year (W < S < F)', () => {
  assert.ok(termSortKey('2026W') < termSortKey('2026S'))
  assert.ok(termSortKey('2026S') < termSortKey('2026F'))
  // The alphabetical trap this exists to avoid:
  assert.ok('2026F' < '2026S', 'sanity: string sort really is wrong')
})

check('termSortKey orders across years and handles junk', () => {
  assert.ok(termSortKey('2026F') < termSortKey('2027W'))
  assert.ok(termSortKey('2026Y') < termSortKey('2026W')) // full-year before sessions
  assert.equal(termSortKey(null), -1)
  assert.equal(termSortKey('garbage'), -1)
})

check('pickNewestTerm works on course rows and enrollment rows', () => {
  assert.equal(pickNewestTerm([{ term: '2026F' }, { term: '2027W' }]).term, '2027W')
  const picked = pickNewestTerm([enr('PSY240', '2026F'), enr('PSY240', '2027F')])
  assert.equal(picked.courses.term, '2027F')
  assert.equal(pickNewestTerm([]), null)
  assert.equal(pickNewestTerm(undefined), null)
})

check('resolveEnrolledCourse matches case-insensitively, newest term wins', () => {
  const es = [enr('PSY240', '2026F'), enr('PSY240', '2027F'), enr('PSY309', '2026F')]
  assert.equal(resolveEnrolledCourse(es, 'psy240').courses.term, '2027F')
  assert.equal(resolveEnrolledCourse(es, 'PSY240').courses.term, '2027F')
  assert.equal(resolveEnrolledCourse(es, ' psy309 ').courses.code, 'PSY309')
})

// The safety property: null, never a fallback.
check('an unmatched code resolves to null, not another course', () => {
  const es = [enr('PSY240', '2026F'), enr('PSY309', '2026F')]
  assert.equal(resolveEnrolledCourse(es, 'psy100'), null)
  assert.equal(resolveEnrolledCourse(es, 'psy24'), null)   // prefix of a real code
  assert.equal(resolveEnrolledCourse(es, 'psy2400'), null) // real code plus a char
  assert.equal(resolveEnrolledCourse(es, ''), null)
  assert.equal(resolveEnrolledCourse(es, undefined), null)
  assert.equal(resolveEnrolledCourse([], 'psy240'), null)
  assert.equal(resolveEnrolledCourse(undefined, 'psy240'), null)
})

// The signed-out routing rule, as data. FieldGuideAuthRoute serves the public
// reader to a visitor with no session ONLY when the requested course is itself
// public; otherwise the visitor must get the login form. Until 2026-09-03 the
// test was merely "does any public course exist", so every signed-out visitor
// to PSY240 was told their *account* had no access and offered PSY309 — a real
// student hit this on her laptop while signed in on her phone.
const asVisitors = (cs) => cs.map(c => ({
  id: `public-${c.id}`, role: 'visitor', status: 'active', course_id: c.id,
  courses: { code: c.code, name: c.name, term: c.term },
}))
const servesPublicReader = (publicCourses, courseCode) =>
  !courseCode || !!resolveEnrolledCourse(asVisitors(publicCourses), courseCode)

check('a signed-out visitor gets the reader only for a public course', () => {
  const pub = [{ id: 'p309', code: 'PSY309', name: 'Research Methods', term: '2026F' }]
  assert.equal(servesPublicReader(pub, 'psy309'), true)   // public course: read away
  assert.equal(servesPublicReader(pub, 'psy240'), false)  // private: must sign in
  assert.equal(servesPublicReader(pub, null), true)       // legacy no-param mount
  assert.equal(servesPublicReader([], 'psy240'), false)   // nothing public at all
  assert.equal(servesPublicReader([], null), true)
})

console.log(`courseRoutes: ${pass}/${pass} checks passed`)
