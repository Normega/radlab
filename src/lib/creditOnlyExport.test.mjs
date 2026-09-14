// Run directly:  node src/lib/creditOnlyExport.test.mjs
//
// Credit-only consent (2026-09-11). A participant who completes a study for
// course credit but does not consent to research use must be absent from every
// research export — the PI's instruction was "Please don't share data from
// participants who aren't consenting to share data." They take part exactly like
// everyone else, so their rows sit in every table; these checks pin the filter
// that keeps those rows out, for each way a table is attached to a study.
//
// The last section reads studyExport.js's registry as text (it imports the
// Supabase client, so it cannot be loaded in Node): every table must have a way
// to attribute its rows, or the filter cannot vouch for it.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CREDIT_ONLY, isCreditOnly, partitionCreditOnly, scheduleIdsForEnrollments,
  isExcludedRow, dropExcludedRows,
} from './creditOnlyExport.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}
const ids = rows => rows.map(r => r.id).join(',')

// A study with three participants: A consented to research, B chose credit
// only, C enrolled before the option existed (consent_scope NULL).
const enrollments = [
  { id: 'eA', profile_id: 'pA', external_id: 'self-a', consent_scope: 'research' },
  { id: 'eB', profile_id: 'pB', external_id: 'self-b', consent_scope: CREDIT_ONLY },
  { id: 'eC', profile_id: 'pC', external_id: '1990',   consent_scope: null },
]
const gameSessions = [
  { id: 'gA', user_id: 'pA' }, { id: 'gB', user_id: 'pB' },
  { id: 'gT', user_id: 'pTest' },   // a test account never enrolled
]
const lilParts = [{ id: 'lA', profile_id: 'pA' }, { id: 'lB', profile_id: 'pB' }]
const schedule = [
  { id: 'sA1', participant_id: 'pA' }, { id: 'sB1', participant_id: 'pB' }, { id: 'sB2', participant_id: 'pB' },
]
const stepRows = [
  { participant_id: 'pA', category: 'game', subcategory: 'pond_watch' },
  { participant_id: 'pB', category: 'game', subcategory: 'farm_joy' },
]

const P = partitionCreditOnly({ enrollments, gameSessions, lilParts, schedule, stepRows })
const X = P.excluded

// ── 1. The enrollment list every id list is derived from ─────────────────────

check('NULL scope reads as research consent', !isCreditOnly({ consent_scope: null }))
check('credit_only enrollment removed', ids(P.enrollments) === 'eA,eC')
check('count states how many were left out', X.count === 1)
check('an exclusion makes the row pass active', X.active === true)
check("their game sessions are not fetched", P.gameSessions.map(s => s.id).join(',') === 'gA,gT')
check('an unenrolled test account\'s sessions are untouched', P.gameSessions.some(s => s.id === 'gT'))
check("their liliana participant id is not fetched", P.lilParts.map(p => p.id).join(',') === 'lA')
check("their step log does not shape the study's design", P.stepRows.length === 1 && P.stepRows[0].participant_id === 'pA')
check("their schedule rows become excluded schedule links", X.scheduleIds.has('sB1') && X.scheduleIds.has('sB2') && !X.scheduleIds.has('sA1'))

{
  const none = partitionCreditOnly({ enrollments: [enrollments[0], enrollments[2]], gameSessions, lilParts, schedule })
  check('a study with no credit-only participants leaves the row pass off', none.excluded.active === false)
  const rows = [{ id: 1, user_id: 'pB' }]
  check('...and dropExcludedRows returns the rows untouched', dropExcludedRows({ space: 'profile', col: 'user_id' }, rows, none.excluded) === rows)
}

{
  // A second enrollment carrying the same external id would re-admit B's rows,
  // since rows are attributed by identifier.
  const twin = partitionCreditOnly({ enrollments: [...enrollments, { id: 'eB2', profile_id: null, external_id: 'self-b', consent_scope: 'research' }] })
  check('an enrollment sharing a credit-only identifier is excluded too', !twin.enrollments.some(e => e.id === 'eB2') && twin.excluded.count === 2)
}

// ── 2. 'study' tables: fetched by study_id, so every participant comes back ───

{
  // game_sessions / pond_watch_results / zerin_daily_checkins — profile owner
  const owner = { space: 'profile', col: 'user_id' }
  const rows = [
    { id: 1, user_id: 'pA' }, { id: 2, user_id: 'pB' }, { id: 3, user_id: 'pTest' }, { id: 4, user_id: null },
  ]
  check('study table: credit-only owner dropped; research, unenrolled and NULL owners kept',
    ids(dropExcludedRows(owner, rows, X)) === '1,3,4')
}
{
  // participant_compensation — external owner, plus enrollment_id
  const owner = { space: 'external', col: 'participant_id' }
  const rows = [
    { id: 1, participant_id: 'self-a' }, { id: 2, participant_id: 'self-b' },
    { id: 3, participant_id: 'typo', enrollment_id: 'eB' },   // unknown id, but B's enrollment
    { id: 4, participant_id: 'typo' },
  ]
  check('compensation: excluded by external id and by enrollment_id; unattributable row kept',
    ids(dropExcludedRows(owner, rows, X)) === '1,4')
}
{
  // participant_step_timings — profile owner AND a schedule link
  const owner = { space: 'profile', col: 'participant_id' }
  const rows = [{ id: 1, participant_id: 'pA', participant_schedule_id: 'sA1' }, { id: 2, participant_id: 'pZ', participant_schedule_id: 'sB2' }]
  check('step timings: a row on a credit-only schedule is dropped whatever its owner column says',
    ids(dropExcludedRows(owner, rows, X)) === '1')
}

// ── 3. 'session', 'liliana' and 'parent' tables ──────────────────────────────

{
  const owner = { space: 'session', col: 'session_id' }
  const rows = [{ id: 1, session_id: 'gA' }, { id: 2, session_id: 'gB' }, { id: 3, session_id: 'gT' }, { id: 4, session_id: 'unknown' }]
  check('session table: only rows under a kept game session survive', ids(dropExcludedRows(owner, rows, X)) === '1,3')
}
{
  const owner = { space: 'lilPart', col: 'participant_id' }
  const rows = [{ id: 1, participant_id: 'lA' }, { id: 2, participant_id: 'lB' }]
  check('liliana table: only rows under a kept liliana participant survive', ids(dropExcludedRows(owner, rows, X)) === '1')
}
{
  const parentOwner = { space: 'profile', col: 'participant_id' }
  const parents = dropExcludedRows(parentOwner, [{ id: 'v1', participant_id: 'pA' }, { id: 'v2', participant_id: 'pB' }], X)
  const kept = new Set(parents.map(r => r.id))
  const events = [{ id: 1, session_id: 'v1' }, { id: 2, session_id: 'v2' }]
  check('parent table: children of a dropped parent are dropped',
    ids(dropExcludedRows({ space: 'parent', col: 'session_id' }, events, X, kept)) === '1')
  check('parent table: with no kept-parent set nothing is shipped (fails closed)',
    dropExcludedRows({ space: 'parent', col: 'session_id' }, events, X, undefined).length === 0)
}

// ── 4. Profile tables and the same student credit-only in ANOTHER study ───────

{
  // A self-enrolled student keeps one account across course studies: research in
  // this study, credit-only in another. Profile-scoped tables return both.
  const pairs = [{ profile_id: 'pA', study_id: 'CHM135' }]
  const scheduleRows = [
    { id: 'chmA1', participant_id: 'pA', study_id: 'CHM135' },
    { id: 'chmZ1', participant_id: 'pZ', study_id: 'CHM135' },   // someone else there
    { id: 'phlA1', participant_id: 'pA', study_id: 'PHL999' },   // pA, a research study
  ]
  const foreign = scheduleIdsForEnrollments(pairs, scheduleRows)
  check('foreign schedule ids are matched as (participant, study) pairs', foreign.join(',') === 'chmA1')

  const P2 = partitionCreditOnly({ enrollments: [enrollments[0]], foreignScheduleIds: foreign })
  check('a foreign credit-only schedule alone activates the row pass', P2.excluded.active && P2.excluded.count === 0)
  const owner = { space: 'profile', col: 'user_id' }
  const rows = [
    { id: 1, user_id: 'pA', schedule_id: 'sA1' },     // this study
    { id: 2, user_id: 'pA', schedule_id: 'chmA1' },   // their credit-only study
    { id: 3, user_id: 'pA', schedule_id: null },      // unlinked: cannot be attributed
  ]
  check('profile table: the credit-only study\'s rows are dropped, this study\'s and unlinked rows kept',
    ids(dropExcludedRows(owner, rows, P2.excluded)) === '1,3')
}

// ── 5. An entry with no way to attribute its rows ────────────────────────────

{
  let threw = false
  try { isExcludedRow({ space: null, col: null }, { id: 1 }, X) } catch { threw = true }
  check('an unattributable table is refused when someone is excluded', threw)
}

// ── 6. The registry itself ───────────────────────────────────────────────────
// ownerOf() derives an owner for every strategy except 'study', which must
// declare ownerSpace. A 'study' table without it would be refused by the filter
// above — loudly, but only on the day a credit-only study exports.

{
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'studyExport.js'), 'utf8')
  const block = src.slice(src.indexOf('export const EXPORT_TABLES'), src.indexOf('const PHYSIO_TABLES'))
  const entries = block.split('\n').filter(l => /\{\s*table:/.test(l))
  check('registry parsed', entries.length > 20)
  for (const line of entries) {
    const table = line.match(/table:\s*'([^']+)'/)?.[1]
    if (/strategy:\s*'study'/.test(line)) {
      check(`study-scoped ${table} declares ownerSpace and ownerCol`, /ownerSpace:\s*'(profile|external)'/.test(line) && /ownerCol:\s*'[^']+'/.test(line))
    } else {
      check(`${table} has a known strategy`, /strategy:\s*'(profile|external|session|liliana|parent)'/.test(line))
    }
  }
  check('fetchStudyData filters every table through dropExcludedRows', /dropExcludedRows\(ownerOf\(entry\)/.test(src))
  check('fetchParticipantData refuses credit-only participants first',
    /export async function fetchParticipantData[^\n]*\n\s*await assertNotCreditOnly\(/.test(src))
}

console.log(`creditOnlyExport: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
