// Run directly:  node --experimental-strip-types src/components/routeTitle.test.mjs
//
// titleFor is a pure function over ~140 routes; the course-scoped branch has
// to coexist with three static /academic names that are NOT course codes.
// Failure is cosmetic (a wrong tab title), so this is a cheap table, not an
// exhaustive one.

import assert from 'node:assert/strict'
import { titleFor } from './titleFor.js'

let pass = 0
const check = (name, fn) => { fn(); pass++; void name }

check('course-scoped academic titles', () => {
  assert.equal(titleFor('/academic/psy240'), 'PSY240 — RADlab')
  assert.equal(titleFor('/academic/psy240/lounge'), 'Lecture Lounge — RADlab')
  assert.equal(titleFor('/academic/psy240/lounge/console'), 'Lecture Lounge — RADlab')
  assert.equal(titleFor('/academic/psy240/wiki'), 'PSY240 Field Guide — RADlab')
  assert.equal(titleFor('/academic/psy309/roster'), 'PSY309 Field Guide — RADlab')
})

check('static academic names are not treated as course codes', () => {
  assert.equal(titleFor('/academic/admin'), 'Academic Admin — RADlab')
  assert.equal(titleFor('/academic/lecture-lounge/admin'), 'Academic Admin — RADlab')
  assert.equal(titleFor('/academic/fieldguide'), 'Field Guide — RADlab')
  assert.equal(titleFor('/academic/fieldguide/wiki/anova'), 'Field Guide — RADlab')
})

check('legacy and neighbouring routes unchanged', () => {
  assert.equal(titleFor('/class/psy240'), 'Lecture Lounge — RADlab')
  assert.equal(titleFor('/lecture-lounge/admin'), 'Academic Admin — RADlab')
  assert.equal(titleFor('/admin/studies'), 'Admin — RADlab')
  assert.equal(titleFor('/'), 'RADlab — Regulatory & Affective Dynamics Lab')
})

console.log(`routeTitle: ${pass}/${pass} checks passed`)
