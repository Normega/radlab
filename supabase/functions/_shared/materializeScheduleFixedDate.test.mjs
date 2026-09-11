// Calendar-date timepoints in materializeSchedule — a timepoint pinned to one
// date for every participant, whose date may be left to be determined. Run on
// a graph shaped like Dana's course studies (baseline at enrolment, then
// check-ins tied to the course calendar), plus a relative timepoint after them
// to show the two kinds of timing do not disturb each other.
//
// Run: node --experimental-strip-types supabase/functions/_shared/materializeScheduleFixedDate.test.mjs
import assert from 'node:assert'
import { materializeSchedule, AWAITING_DATE, SKIPPED } from './materializeSchedule.ts'

const LAB_TZ = 'America/Toronto'
const labToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: LAB_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

const TODAY = labToday()

/**
 * Baseline (relative day 0) → Time 1 (date TBD) → Time 2 (a future date, a
 * two-day block) → Time 3 (a date already gone) → Follow-up (relative day 30).
 */
function buildGraph({ t1Date = null, entryFixed = false } = {}) {
  const nodes = [
    { id: 't0', type: 'timepoint', day_offset: 0, time_of_day: '09:00', label: 'Time 0',
      ...(entryFixed ? { timing: 'fixed', fixed_date: null } : {}) },
    { id: 's0', type: 'session', label: 'Baseline' },
    { id: 't1', type: 'timepoint', timing: 'fixed', fixed_date: t1Date, day_offset: 7, time_of_day: '10:30', label: 'Time 1' },
    { id: 's1', type: 'session', label: 'After test 1' },
    { id: 't2', type: 'timepoint', timing: 'fixed', fixed_date: addDays(TODAY, 20), day_offset: 14, label: 'Time 2' },
    { id: 'b2', type: 'block', children: ['s2a', 's2b'] },
    { id: 's2a', type: 'session' },
    { id: 's2b', type: 'session' },
    { id: 't3', type: 'timepoint', timing: 'fixed', fixed_date: addDays(TODAY, -3), day_offset: 21, label: 'Time 3' },
    { id: 's3', type: 'session', label: 'Grade release' },
    { id: 't4', type: 'timepoint', day_offset: 30, time_of_day: '08:00', label: 'Follow-up' },
    { id: 's4', type: 'session', label: 'Follow-up' },
  ]
  const edges = [
    ['t0', 's0'], ['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 'b2'],
    ['b2', 't3'], ['t3', 's3'], ['s3', 't4'], ['t4', 's4'],
  ].map(([from, to]) => ({ from, to }))
  return { nodes, edges }
}

const SESSION_KEYS = ['s0', 's1', 's2a', 's2b', 's3', 's4']
const SESSION_ROWS = SESSION_KEYS.map((k) => ({ id: `ss_${k}`, node_key: k, link_expires_hours: 48 }))

function makeDb(schedule = []) {
  const inserted = []
  let singleCalls = 0
  const result = (data) => {
    const b = {
      select: () => b, eq: () => b, in: () => b, not: () => b, is: () => b, maybeSingle: () => b, order: () => b,
      single: () => { singleCalls++; return b },
      then: (ok, err) => Promise.resolve({ data, error: null }).then(ok, err),
    }
    return b
  }
  const tables = { study_sessions: SESSION_ROWS, participant_schedule: schedule, participant_assignments: [] }
  return {
    inserted,
    get singleCalls() { return singleCalls },
    from: (t) => ({
      select: () => result(tables[t] ?? []),
      insert: (rows) => { inserted.push(...rows); return result(null) },
      update: () => result(null),
    }),
    rpc: async () => { throw new Error('no forks in this graph') },
  }
}

const byKey = (db) => Object.fromEntries(db.inserted.map((r) => [r.study_session_id.slice(3), r]))

async function run(graph, schedule = [], extra = {}) {
  const db = makeDb(schedule)
  const result = await materializeSchedule(db, {
    participantId: 'p1', studyId: 'st1', graph, t0Date: TODAY, baselineSendTime: '09:00', ...extra,
  })
  return { db, result, rows: byKey(db) }
}

// 1. Enrolment today: every kind of timing lands where it should, in one pass.
{
  const { rows, result } = await run(buildGraph())

  assert.equal(Object.keys(rows).length, 6, 'the whole linear study materializes at enrolment')

  assert.equal(rows.s0.status, 'pending')
  assert.equal(rows.s0.scheduled_date, TODAY)

  assert.equal(rows.s1.status, AWAITING_DATE, 'a to-be-determined date is held, not sent')
  assert.equal(rows.s1.scheduled_date, null)
  assert.equal(rows.s1.send_time, '10:30', 'send_time is NOT NULL, so the timepoint time rides along')
  assert.equal(rows.s1.study_day, 8, 'study_day is the design day, the same for every participant')

  assert.equal(rows.s2a.status, 'pending')
  assert.equal(rows.s2a.scheduled_date, addDays(TODAY, 20), 'on the calendar date, whatever the enrolment day')
  assert.equal(rows.s2b.scheduled_date, addDays(TODAY, 21), "a block's children still run on consecutive days")
  assert.equal(rows.s2a.send_time, '09:00', 'a blank time inherits the baseline time')

  assert.equal(rows.s3.status, SKIPPED, 'a date gone before enrolment is not offered')
  assert.equal(rows.s3.scheduled_date, addDays(TODAY, -3), 'the date it had is kept, for the record')

  assert.equal(rows.s4.status, 'pending')
  assert.equal(rows.s4.scheduled_date, addDays(TODAY, 30), 'a relative timepoint after fixed ones still counts from enrolment')
  assert.equal(rows.s4.send_time, '08:00')

  assert.equal(result.completedStudy, false)
}

// 2. A later enrolment against the same graph: a date that has passed since
//    the first participant joined is skipped for this one, and nothing else
//    moves.
{
  const graph = buildGraph({ t1Date: addDays(TODAY, -1) })
  const { rows } = await run(graph)
  assert.equal(rows.s1.status, SKIPPED)
  assert.equal(rows.s2a.status, 'pending')
}

// 3. The date is set to today: still to come, so still offered (the scheduler
//    compares the send time).
{
  const { rows } = await run(buildGraph({ t1Date: TODAY }))
  assert.equal(rows.s1.status, 'pending')
  assert.equal(rows.s1.scheduled_date, TODAY)
}

// 4. Repeat passes insert nothing and never overwrite an awaiting row.
{
  const graph = buildGraph()
  const first = await run(graph)
  const schedule = first.db.inserted.map((r) => ({
    status: r.status, study_session_id: r.study_session_id, scheduled_date: r.scheduled_date, completed_at: null,
  }))
  const { db } = await run(graph, schedule)
  assert.equal(db.inserted.length, 0)
}

// 5. Completion. A row awaiting its date holds the study open even when every
//    session around it is done...
{
  const row = (k, status, date = TODAY) => ({
    status, study_session_id: `ss_${k}`, scheduled_date: date, completed_at: status === 'completed' ? `${TODAY}T15:00:00Z` : null,
  })
  const open = [
    row('s0', 'completed'), row('s1', AWAITING_DATE, null), row('s2a', 'completed'), row('s2b', 'completed'),
    row('s3', SKIPPED), row('s4', 'completed'),
  ]
  assert.equal((await run(buildGraph(), open)).result.completedStudy, false, 'awaiting_date is outstanding')

  // ...and a skipped final timepoint does not: the participant finished
  // everything they were offered.
  const graph = buildGraph()
  graph.nodes = graph.nodes.filter((n) => n.id !== 't4' && n.id !== 's4')
  graph.edges = graph.edges.filter((e) => e.from !== 's3' && e.from !== 't4')
  const done = [
    row('s0', 'completed'), row('s1', 'completed'), row('s2a', 'completed'), row('s2b', 'completed'),
    row('s3', SKIPPED),
  ]
  assert.equal((await run(graph, done)).result.completedStudy, true, 'a skipped last session does not block completion')
}

// 6. unlockFirst never serves a session that is waiting for its date. The
//    builder refuses a fixed entry timepoint; this is the guard behind it.
{
  const { db, rows } = await run(buildGraph({ entryFixed: true }), [], { unlockFirst: true })
  assert.equal(rows.s0.status, AWAITING_DATE)
  assert.ok(!db.inserted.some((r) => r.status === 'unlocked'), 'nothing unlocked')
  assert.equal(db.singleCalls, 0, 'no unlocked-row lookup, so no link is issued')
}

console.log('materializeSchedule fixed-date: 6/6 checks passed')
