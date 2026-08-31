// Run directly:  node --experimental-strip-types src/lib/authDetectRoutes.test.mjs
//
// The predicate guards against a failure that is SILENT in both directions:
// the wrong client consuming an auth code either writes a foreign session
// into its storage or burns a single-use code — no error surfaces either way,
// the user just isn't signed in. So the rule lives in one pure function and
// this table is the spec. If a new route family is added under /academic,
// add its rows here FIRST and make them pass.

import assert from 'node:assert/strict'
import { mainClientDetectsSessionAt as detects } from './authDetectRoutes.js'

let pass = 0
const check = (name, fn) => { fn(); pass++; void name }

// Main client MUST detect here — main-project auth links land on these.
const MUST_DETECT = [
  '/',
  '/verified',
  '/reset-password',
  '/class/psy240',                     // signup-confirmation landing (alias, forever)
  '/class/verify',
  '/academic',
  '/academic/admin',
  '/academic/lecture-lounge/admin',
  '/academic/psy240',                  // course home — neutral, but detection safe
  '/academic/psy240/lounge',           // future main-project confirmation landing
  '/academic/psy240/lounge/console',
  '/academic/psy240/lounge/wall/abc',
]

// Main client MUST NOT detect here — academic-project auth links land on
// these, and the main client would eat their codes.
const MUST_NOT_DETECT = [
  '/academic/fieldguide',
  '/academic/fieldguide/wiki',
  '/academic/fieldguide/wiki/some-slug',
  '/academic/fieldguide/join',
  '/academic/fieldguide/gaps',
  '/academic/fieldguide/whats-new',
  '/academic/fieldguide/roster/psy240',
  '/academic/psy240/wiki',
  '/academic/psy240/wiki/anova',
  '/academic/psy240/join',
  '/academic/psy240/gaps',
  '/academic/psy240/whats-new',
  '/academic/psy309/roster',
  '/academic/psy240/ingest',
  '/academic/psy240/review',
  '/academic/psy240/submissions',
  '/academic/psy240/corrections',
  '/academic/psy240/read',
  '/academic/psy240/reports',
]

check('main client detects where its own links land', () => {
  for (const p of MUST_DETECT) assert.equal(detects(p), true, p)
})

check('main client never detects where academic links land', () => {
  for (const p of MUST_NOT_DETECT) assert.equal(detects(p), false, p)
})

check('trailing slashes do not change the answer', () => {
  assert.equal(detects('/academic/psy240/wiki/'), false)
  assert.equal(detects('/academic/psy240/lounge/'), true)
  assert.equal(detects('/academic/fieldguide/'), false)
})

check('degenerate input defaults to detecting (main-site behavior)', () => {
  assert.equal(detects(''), true)
  assert.equal(detects(null), true)
  assert.equal(detects(undefined), true)
})

console.log(`authDetectRoutes: ${pass}/${pass} checks passed`)
