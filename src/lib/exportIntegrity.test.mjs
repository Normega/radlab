// Run directly:  node src/lib/exportIntegrity.test.mjs
//
// The export must never lose a collected response. Before 2026-09-10 the master
// dropped every row but the last inside a two-minute window measured on
// participant clocks, and let a second row overwrite a first that named the same
// column. These checks pin the replacement: only provable copies are omitted, and
// a repeat always gets cells of its own.

import { splitResubmissions, createRepeatNamer, putCell, RESUBMISSION_WINDOW_MS } from './exportIntegrity.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

const T0 = Date.parse('2026-09-10T12:00:00Z')
const at = ms => new Date(T0 + ms).toISOString()
const opts = {
  subjectOf: r => r.user_id,
  keyOf:     r => `${r.slug}|${r.step}`,
  payloadOf: r => JSON.stringify(r.responses),
  timeOf:    r => Date.parse(r.completed_at),
}
const row = (id, over = {}) => ({
  id, user_id: 'p1', slug: 'stress', step: 1, responses: { value: 3 }, completed_at: at(0), ...over,
})
const ids = rs => rs.map(r => r.id).join(',')

// ── 1. What the database flagged ──────────────────────────────────────────────

{
  const { kept, omitted } = splitResubmissions([
    row('a', { received_at: at(0) }),
    row('b', { received_at: at(900), completed_at: at(900), resubmission_of: 'a' }),
  ], opts)
  check('a database-flagged copy is omitted', ids(omitted) === 'b')
  check('its original is kept', ids(kept) === 'a')
}

{
  const { kept } = splitResubmissions([
    row('a', { received_at: at(0) }),
    row('b', { received_at: at(300), completed_at: at(300) }),
  ], opts)
  check('an unflagged server-stamped row is always kept, even when identical', ids(kept) === 'a,b')
}

// ── 2. Legacy rows, tested on the timestamps they have ────────────────────────

{
  const { kept, omitted } = splitResubmissions([
    row('a'), row('b', { completed_at: at(643) }),
  ], opts)
  check('an identical legacy row 643 ms later is a copy', ids(omitted) === 'b')
  check('the earliest copy is the one kept', ids(kept) === 'a')
}

{
  const { kept } = splitResubmissions([
    row('a'), row('b', { completed_at: at(RESUBMISSION_WINDOW_MS + 1000) }),
  ], opts)
  check('an identical legacy row outside the window is a real response', ids(kept) === 'a,b')
}

{
  const { kept } = splitResubmissions([
    row('a'), row('b', { completed_at: at(200), responses: { value: 4 } }),
  ], opts)
  check('a different answer is never a copy, however fast', ids(kept) === 'a,b')
}

{
  const { kept } = splitResubmissions([
    row('a'),
    row('x', { completed_at: at(100), slug: 'mood' }),
    row('b', { completed_at: at(200) }),
  ], opts)
  check('once another variable is collected in between, a repeat is real', ids(kept) === 'a,x,b')
}

{
  const { kept } = splitResubmissions([
    row('a'), row('b', { completed_at: at(200), step: 7 }),
  ], opts)
  check('the same answer at a different step is a different variable', ids(kept) === 'a,b')
}

{
  const { kept } = splitResubmissions([
    row('a'), row('b', { user_id: 'p2' }),
  ], opts)
  check('identical answers from two participants are both kept', ids(kept) === 'a,b')
}

{
  const { kept, omitted } = splitResubmissions([
    row('c', { completed_at: at(400) }), row('a'), row('b', { completed_at: at(200) }),
  ], opts)
  check('a burst of three identical legacy rows keeps only the first', ids(kept) === 'a' && omitted.length === 2)
}

{
  const { kept } = splitResubmissions([
    row('late', { received_at: at(5000), completed_at: at(5000), responses: { value: 9 } }),
    row('early', { completed_at: at(0) }),
  ], opts)
  check('kept rows come back in time order', ids(kept) === 'early,late')
}

check('an empty or absent input yields nothing', splitResubmissions(undefined, opts).kept.length === 0)

// ── 3. Repeat naming ──────────────────────────────────────────────────────────

{
  const { name, repeats } = createRepeatNamer()
  const n1 = name('p1', 'gad7_baseline')
  const n2 = name('p1', 'gad7_baseline', { table: 'questionnaire_responses' })
  const n3 = name('p1', 'gad7_baseline')
  const other = name('p2', 'gad7_baseline')
  check('the first use of a block keeps its name', n1 === 'gad7_baseline')
  check('a second use becomes _r2', n2 === 'gad7_baseline_r2')
  check('a third use becomes _r3', n3 === 'gad7_baseline_r3')
  check('another participant starts from the plain name', other === 'gad7_baseline')
  check('every suffixed name is reported', repeats.length === 2 && repeats[0].table === 'questionnaire_responses')
}

// ── 4. Cells are never written over ───────────────────────────────────────────

{
  const target = {}
  const hits = []
  putCell(target, 'vas_stress_d1', 2, h => hits.push(h))
  putCell(target, 'vas_stress_d1', 5, h => hits.push(h))
  putCell(target, 'vas_stress_d1', 7, h => hits.push(h))
  check('the first value stays in its column', target.vas_stress_d1 === 2)
  check('a second value lands in _r2', target.vas_stress_d1_r2 === 5)
  check('a third value lands in _r3', target.vas_stress_d1_r3 === 7)
  check('each collision is reported', hits.length === 2 && hits[1].written_as === 'vas_stress_d1_r3')
}

{
  const target = { q_1: undefined }
  putCell(target, 'q_1', 4)
  check('an existing empty cell is still not overwritten', target.q_1 === undefined && target.q_1_r2 === 4)
}

console.log(`# export integrity: ${pass}/${pass + fail} checks passed`)
if (fail) process.exit(1)
