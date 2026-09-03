// Run directly:  node src/lib/instrumentColumns.test.mjs
//
// Composable instrument responses were written from the day the integration
// shipped (2026-08-25) and read back by nothing — `instrument_responses` was in
// no export registry, so every answer the five standalone instrument types
// collected was unreadable through the Export tab. These checks cover the
// flattening that closes that gap.
//
// The cases that matter are the ones where a wrong answer is silently
// plausible: a multi-select where an unselected option must be a real 0 rather
// than a blank, a hierarchy level whose null direction means "not changed"
// rather than "missing", and an unknown type that must still emit its data
// instead of dropping the answer.

import { instrumentColumns } from './instrumentColumns.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── 1. Scalars ────────────────────────────────────────────────────────────────
check('likert_slider is the bare value',
  eq(instrumentColumns('mastery_baseline', 'likert_slider', 6), { mastery_baseline: 6 }))

check('open_text is the text as typed',
  eq(instrumentColumns('why_baseline', 'open_text', 'I ran out of time'),
     { why_baseline: 'I ran out of time' }))

check('an unanswered scalar is null, not absent',
  eq(instrumentColumns('mastery_baseline', 'likert_slider', null), { mastery_baseline: null }))

// ── 2. Single-select multiple choice ──────────────────────────────────────────
check('single select records the option id',
  eq(instrumentColumns('grade_baseline', 'multiple_choice', { option_id: 'pass_only', value: null }),
     { grade_baseline: 'pass_only' }))

check('inline entry gets its own column',
  eq(instrumentColumns('grade_baseline', 'multiple_choice', { option_id: 'specific', value: '85' }),
     { grade_baseline: 'specific', grade_baseline_value: '85' }))

check('an empty inline entry emits no value column',
  eq(instrumentColumns('grade_baseline', 'multiple_choice', { option_id: 'specific', value: '' }),
     { grade_baseline: 'specific' }))

// ── 3. Multi-select — the case the definition is needed for ───────────────────
const emotionDef = {
  config: { options: [{ id: 'anxious' }, { id: 'hopeful' }, { id: 'frustrated' }, { id: 'other' }] },
}
const multi = instrumentColumns(
  'emotions_tt1', 'multiple_choice',
  [{ option_id: 'anxious', value: null }, { option_id: 'other', value: 'curious' }],
  emotionDef,
)

check('every offered option is present, chosen ones 1',
  multi.emotions_tt1_anxious === 1 && multi.emotions_tt1_other === 1)

check('UNCHOSEN options are an explicit 0, not a blank',
  multi.emotions_tt1_hopeful === 0 && multi.emotions_tt1_frustrated === 0)

check('multi-select carries a readable summary',
  multi.emotions_tt1_selected === 'anxious; other')

check('inline entry on a chosen option is kept',
  multi.emotions_tt1_other_value === 'curious')

// Without a definition (deleted or unavailable) the chosen options must still
// export — but nothing may claim an option was NOT chosen, because the option
// list is unknown.
const noDef = instrumentColumns('emotions_tt1', 'multiple_choice',
  [{ option_id: 'anxious', value: null }], null)
check('no definition still exports what was chosen', noDef.emotions_tt1_anxious === 1)
check('no definition asserts no zeros', !('emotions_tt1_hopeful' in noDef))

// An option collected but since removed from the definition must not vanish.
const stale = instrumentColumns('emotions_tt1', 'multiple_choice',
  [{ option_id: 'retired_option', value: null }], emotionDef)
check('an option no longer in the definition survives', stale.emotions_tt1_retired_option === 1)
check('and the current options are still zeroed', stale.emotions_tt1_hopeful === 0)

// ── 4. Open list ──────────────────────────────────────────────────────────────
const list = instrumentColumns('causes_tt1', 'open_list', [
  { factor: 'poor time management', contribution: 82 },
  { factor: 'unclear notes', contribution: 40 },
])
check('open list numbers entries from 1',
  list.causes_tt1_1_factor === 'poor time management' && list.causes_tt1_1_contribution === 82)
check('open list keeps entry order',
  list.causes_tt1_2_factor === 'unclear notes' && list.causes_tt1_2_contribution === 40)
check('open list records how many were given', list.causes_tt1_count === 2)
check('an empty list still records a count of 0',
  instrumentColumns('causes_tt1', 'open_list', []).causes_tt1_count === 0)

// ── 5. Hierarchy ──────────────────────────────────────────────────────────────
const hier = instrumentColumns('beliefs_tt2', 'hierarchy', [
  { id: 'skill_specific', changed: true,  direction: -42 },
  { id: 'self_global',    changed: false, direction: null },
])
check('a changed level records 1 and its direction',
  hier.beliefs_tt2_skill_specific_changed === 1 && hier.beliefs_tt2_skill_specific_direction === -42)
check('an unchanged level is 0 with a null direction',
  hier.beliefs_tt2_self_global_changed === 0 && hier.beliefs_tt2_self_global_direction === null)
check('a direction of 0 is preserved, not treated as missing',
  instrumentColumns('b_tt2', 'hierarchy', [{ id: 'x', changed: true, direction: 0 }])
    .b_tt2_x_direction === 0)

// ── 6. Unknown type ───────────────────────────────────────────────────────────
check('an unregistered type still exports its data as JSON',
  instrumentColumns('mystery_baseline', 'something_new', { a: 1 }).mystery_baseline === '{"a":1}')

// ── 7. Hyphenated ids stay legal column names ─────────────────────────────────
check('hyphens are stripped from ids',
  'q_baseline_optiona' in instrumentColumns('q_baseline', 'multiple_choice',
    [{ option_id: 'option-a' }], { config: { options: [{ id: 'option-a' }] } }))

console.log(`instrumentColumns: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
