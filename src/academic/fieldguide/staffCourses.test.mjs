// Run directly:  node src/academic/fieldguide/staffCourses.test.mjs
//
// The invariant under test is a safety property, not a formatting one: a
// course code that does not resolve must return null rather than some other
// course the caller staffs. RosterAdmin's next action can be a several-hundred
// row import or a bulk invite, so resolving to the wrong course is materially
// worse than resolving to nothing.
//
// Guards the regression this replaced: `staffEnrollments[0]`, which answered
// "which course?" by array position.

import assert from 'node:assert/strict'
import { rosterPath, staffedCourses, resolveCourse } from './staffCourses.js'

let pass = 0
const check = (name, fn) => { fn(); pass++; void name }

const enr = (code, role = 'instructor', name = `${code} course`, term = '2026F') => ({
  id: `${code}-${role}`, role, status: 'active', course_id: `id-${code}`,
  courses: { code, name, term },
})

const BOTH = [enr('PSY309'), enr('PSY240')] // deliberately not in code order

check('rosterPath lowercases the code into the course-scoped path', () => {
  assert.equal(rosterPath('PSY240'), '/academic/psy240/roster')
  assert.equal(rosterPath('psy309'), '/academic/psy309/roster')
})

check('staffedCourses sorts by course code', () => {
  assert.deepEqual(staffedCourses(BOTH).map(e => e.courses.code), ['PSY240', 'PSY309'])
})

check('staffedCourses dedupes two roles in one course', () => {
  const dual = [enr('PSY240', 'instructor'), enr('PSY240', 'ta')]
  assert.equal(staffedCourses(dual).length, 1)
})

check('staffedCourses tolerates empty and malformed input', () => {
  assert.deepEqual(staffedCourses([]), [])
  assert.deepEqual(staffedCourses(undefined), [])
  assert.deepEqual(staffedCourses([{ id: 'x' }, { courses: {} }]), [])
})

check('resolveCourse matches case-insensitively, both directions', () => {
  const cs = staffedCourses(BOTH)
  assert.equal(resolveCourse(cs, 'psy240').course_id, 'id-PSY240')
  assert.equal(resolveCourse(cs, 'PSY240').course_id, 'id-PSY240')
  assert.equal(resolveCourse(cs, 'psy309').course_id, 'id-PSY309')
})

check('resolveCourse trims stray whitespace from a pasted URL', () => {
  assert.equal(resolveCourse(staffedCourses(BOTH), '  psy309 ').course_id, 'id-PSY309')
})

// The safety property. Each of these must be null, never a fallback.
check('an unstaffed course resolves to null, not to a course you do staff', () => {
  const cs = staffedCourses(BOTH)
  assert.equal(resolveCourse(cs, 'psy100'), null)
  assert.equal(resolveCourse(cs, 'psy24'), null)   // prefix of a real code
  assert.equal(resolveCourse(cs, 'psy2400'), null) // real code plus a char
})

check('a missing or empty code resolves to null, never to the first course', () => {
  const cs = staffedCourses(BOTH)
  assert.equal(resolveCourse(cs, undefined), null)
  assert.equal(resolveCourse(cs, ''), null)
  assert.equal(resolveCourse(cs, '   '), null)
  assert.equal(resolveCourse(cs, null), null)
})

check('resolving against no staffed courses is null, not a crash', () => {
  assert.equal(resolveCourse([], 'psy240'), null)
  assert.equal(resolveCourse(undefined, 'psy240'), null)
})

console.log(`staffCourses: ${pass}/${pass} checks passed`)
