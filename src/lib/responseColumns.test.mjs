// Run directly:  node src/lib/responseColumns.test.mjs
//
// Regression cover for the defect that cost Sandy Study 3 its repeated slider
// measures (2026-08-26/27). Two independent halves failed the same way:
//
//   * the DB dedupe trigger keyed an administration on (user, instrument,
//     session) and so read the 2nd and 3rd administration inside one session as
//     double-fires of the 1st, discarding them at insert time;
//   * the export names a column from the session, and all administrations in a
//     session share one — so even the rows that DID survive (stress, task
//     satisfaction, all intact in vas_responses) flattened to one column.
//
// Both halves rest on the same missing idea: a session may collect an
// instrument more than once, and the STEP is what tells the collections apart.
// These checks pin that idea down on the export side; the trigger side is
// pinned by 20260910_dedupe_by_step_index.sql.

import { repeatedSubcatsFromSteps, administrationSuffix, vasRepeats } from './responseColumns.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

// ── 1. Detecting a repeated instrument from the step log ─────────────────────

// Sandy Study 3's actual shape: one session, negative emotionality at steps
// 2 / 8 / 20, stress at 1 / 7 / 19, the questionnaires once each at the end.
const sandySteps = [
  { participant_schedule_id: 'sch1', subcategory: 'vas_stress',                   step_index: 1 },
  { participant_schedule_id: 'sch1', subcategory: 'slider_negative_emotionality', step_index: 2 },
  { participant_schedule_id: 'sch1', subcategory: 'vas_stress',                   step_index: 7 },
  { participant_schedule_id: 'sch1', subcategory: 'slider_negative_emotionality', step_index: 8 },
  { participant_schedule_id: 'sch1', subcategory: 'vas_stress',                   step_index: 19 },
  { participant_schedule_id: 'sch1', subcategory: 'slider_negative_emotionality', step_index: 20 },
  { participant_schedule_id: 'sch1', subcategory: 'aps-r',                        step_index: 25 },
]
const sandy = repeatedSubcatsFromSteps(sandySteps)

check('a slider asked three times in one session is repeated',
  sandy.has('slider_negative_emotionality'))
check('a scale asked three times in one session is repeated',
  sandy.has('vas_stress'))
check('a questionnaire asked once is NOT repeated',
  !sandy.has('aps-r'))

// The distinction that broke Liliana's export the other way: the same
// instrument in DIFFERENT sessions is not a within-session repeat, and must
// keep being named by its session rather than by a step.
const longitudinal = repeatedSubcatsFromSteps([
  { participant_schedule_id: 'day1',  subcategory: 'gad7', step_index: 3 },
  { participant_schedule_id: 'day14', subcategory: 'gad7', step_index: 3 },
  { participant_schedule_id: 'day28', subcategory: 'gad7', step_index: 3 },
])
check('the same instrument across separate sessions is not a within-session repeat',
  !longitudinal.has('gad7'))

// Two participants each sitting the same session once must not look like a
// repeat just because the study has more than one participant.
const twoParticipants = repeatedSubcatsFromSteps([
  { participant_schedule_id: 'p1s1', subcategory: 'vas_stress', step_index: 1 },
  { participant_schedule_id: 'p2s1', subcategory: 'vas_stress', step_index: 1 },
])
check('two participants sitting one session each is not a repeat',
  !twoParticipants.has('vas_stress'))

// Rows with no schedule link carry no session, so they can prove nothing.
check('steps with no schedule link are ignored',
  repeatedSubcatsFromSteps([
    { participant_schedule_id: null, subcategory: 'vas_stress', step_index: 1 },
    { participant_schedule_id: null, subcategory: 'vas_stress', step_index: 7 },
  ]).size === 0)

check('an empty or absent step log yields nothing', repeatedSubcatsFromSteps([]).size === 0)
check('an absent step log does not throw',          repeatedSubcatsFromSteps(undefined).size === 0)

// ── 2. The suffix ────────────────────────────────────────────────────────────

check('an instrument collected once gets no suffix — the session names it',
  administrationSuffix({ repeats: false, stepIndex: 8, ordinal: 2 }) === '')

check('a repeated administration is named by its recorded step',
  administrationSuffix({ repeats: true, stepIndex: 8, ordinal: 2 }) === '_s8')

check('step 0 is a real step, not a missing one',
  administrationSuffix({ repeats: true, stepIndex: 0, ordinal: 1 }) === '_s0')

// The failure that rule 4 exists for: where the step is unknown, the label must
// not look like a step. `_s2` would assert a protocol position this row cannot
// be shown to occupy.
const vague = administrationSuffix({ repeats: true, stepIndex: null, ordinal: 2 })
check('an unknown step falls back to an explicitly non-committal marker',
  vague === '_xstep2')
check('the fallback marker cannot be mistaken for a recorded step',
  !/^_s\d+$/.test(vague))

// ── 3. The three administrations must not collide ────────────────────────────
// The actual bug, stated as an invariant: three ratings of one scale in one
// session, identical in day, package and schedule, must produce three columns.

const base = 'vas_stress_d1'
const cols = [1, 7, 19].map(stepIndex =>
  base + administrationSuffix({ repeats: vasRepeats(sandy, 'stress', null), stepIndex }))
check('three administrations in one session produce three distinct columns',
  new Set(cols).size === 3)
check('the columns are named for the protocol position, not the occurrence',
  cols.join(',') === 'vas_stress_d1_s1,vas_stress_d1_s7,vas_stress_d1_s19')

// And the converse: a once-per-session scale keeps the column name it has
// always had, so fixing this does not rename every other study's export.
check('a once-per-session scale keeps its existing column name',
  'vas_sleep_d1' + administrationSuffix({ repeats: vasRepeats(sandy, 'sleep', null), stepIndex: 4 })
    === 'vas_sleep_d1')

// ── 4. Package delivery ──────────────────────────────────────────────────────

const pkgSteps = repeatedSubcatsFromSteps([
  { participant_schedule_id: 'sch1', subcategory: 'vas_pkg_pre_ratings', step_index: 2 },
  { participant_schedule_id: 'sch1', subcategory: 'vas_pkg_pre_ratings', step_index: 9 },
])
check('a scale inside a repeated package step counts as repeated',
  vasRepeats(pkgSteps, 'calm', 'pre_ratings'))
check('the same scale outside that package does not',
  !vasRepeats(pkgSteps, 'calm', null))
check('vasRepeats tolerates a missing set', !vasRepeats(null, 'calm', 'pre_ratings'))

console.log(`# response column naming: ${pass}/${pass + fail} checks passed`)
if (fail) process.exit(1)
