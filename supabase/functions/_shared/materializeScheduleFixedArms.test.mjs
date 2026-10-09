// Calendar-date arms behind a randomize fork, behind a held baseline: the shape
// of the PSY240 class trial (2026-10-09). The admin builder refuses this
// combination (experimentGraph.js), and the existing fixed-date tests never put a
// fork in front of a fixed timepoint, so this covers what the trial relies on:
//   - nothing after the baseline exists until it is completed (the hold);
//   - the fork then draws, and the drawn arm lands on the calendar: day N on
//     day 1's date + N - 1, study_day N, for everyone;
//   - a late joiner's days already gone are 'skipped' (never sent), and today's
//     and later days are pending: they pick the calendar up where it is;
//   - an assignment written ahead of the fork (Study 3 students) is used without
//     a draw.
//
// Run: node --experimental-strip-types supabase/functions/_shared/materializeScheduleFixedArms.test.mjs
import assert from 'node:assert'
import { materializeSchedule, SKIPPED } from './materializeSchedule.ts'

const LAB_TZ = 'America/Toronto'
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: LAB_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

const ARMS = ['nr', 'sm', 'sf']
const DAYS = 28

// The trial's graph, with day 1 and the final survey's dates as parameters.
function trialGraph(day1, finalDate) {
  const nodes = [
    { id: 't0', type: 'timepoint', day_offset: 0, time_of_day: '07:00' },
    { id: 's_base', type: 'session', hold: true },
    { id: 'rnd', type: 'randomize', arms: ARMS.map((k) => ({ group: k, weight: 1, entry: `t_${k}` })) },
  ]
  const edges = [['t0', 's_base'], ['s_base', 'rnd']]
  for (const k of ARMS) {
    const kids = Array.from({ length: DAYS }, (_, i) => `${k}_d${String(i + 1).padStart(2, '0')}`)
    nodes.push({ id: `t_${k}`, type: 'timepoint', timing: 'fixed', fixed_date: day1, day_offset: 0, time_of_day: '07:00' })
    nodes.push({ id: `b_${k}`, type: 'block', children: kids })
    for (const kid of kids) nodes.push({ id: kid, type: 'session' })
    edges.push(['rnd', `t_${k}`], [`t_${k}`, `b_${k}`], [`b_${k}`, 't_final'])
  }
  nodes.push({ id: 't_final', type: 'timepoint', timing: 'fixed', fixed_date: finalDate, day_offset: DAYS, time_of_day: '07:00' })
  nodes.push({ id: 's_final', type: 'session' })
  edges.push(['t_final', 's_final'])
  return { nodes, edges: edges.map(([from, to]) => ({ from, to })) }
}

const SESSION_KEYS = ['s_base', 's_final', ...ARMS.flatMap((k) => Array.from({ length: DAYS }, (_, i) => `${k}_d${String(i + 1).padStart(2, '0')}`))]
const SESSION_ROWS = SESSION_KEYS.map((k) => ({ id: `ss_${k}`, node_key: k, link_expires_hours: 23 }))

function makeDb({ schedule = [], assignments = [], draw = 'sm' } = {}) {
  const inserted = []
  const draws = []
  const result = (data) => {
    const b = {
      select: () => b, eq: () => b, in: () => b, not: () => b, is: () => b, maybeSingle: () => b, order: () => b, single: () => b,
      then: (ok, err) => Promise.resolve({ data, error: null }).then(ok, err),
    }
    return b
  }
  const tables = { study_sessions: SESSION_ROWS, participant_schedule: schedule, participant_assignments: assignments }
  return {
    inserted, draws,
    from: (t) => ({
      select: () => result(tables[t] ?? []),
      insert: (rows) => { inserted.push(...(Array.isArray(rows) ? rows : [rows])); return result(null) },
      update: () => result(null),
      upsert: () => result(null),
    }),
    rpc: async (name, args) => {
      assert.equal(name, 'draw_assignment')
      draws.push(args)
      return { data: { value: draw, draw_index: draws.length - 1 }, error: null }
    },
  }
}

const baselineDone = (completedAt = new Date().toISOString()) => [
  { status: 'completed', study_session_id: 'ss_s_base', scheduled_date: TODAY, completed_at: completedAt },
]
const key = (r) => r.study_session_id.slice(3)

async function run(opts, day1, finalDate) {
  const db = makeDb(opts)
  await materializeSchedule(db, { participantId: 'p1', studyId: 'trial', graph: trialGraph(day1, finalDate), t0Date: TODAY, baselineSendTime: '07:00' })
  return db
}

// 1. Joined, baseline not done: only the baseline exists, and nothing is drawn.
{
  const db = await run({}, addDays(TODAY, 8), addDays(TODAY, 36))
  assert.deepEqual(db.inserted.map(key), ['s_base'], 'the hold stops the walk at the baseline')
  assert.equal(db.draws.length, 0, 'no draw before the baseline is done')
}

// 2. Baseline done before day 1: the drawn arm, all 28 days pending on the calendar.
{
  const day1 = addDays(TODAY, 8)
  const db = await run({ schedule: baselineDone(), draw: 'sm' }, day1, addDays(TODAY, 36))
  assert.equal(db.draws.length, 1, 'the fork draws once')
  const days = db.inserted.filter((r) => key(r).startsWith('sm_d'))
  assert.equal(days.length, DAYS, 'every day of the drawn arm')
  assert.equal(db.inserted.filter((r) => /^(nr|sf)_d/.test(key(r))).length, 0, 'nothing from the other arms')
  days.forEach((r, i) => {
    assert.equal(r.scheduled_date, addDays(day1, i), `day ${i + 1} on its calendar date`)
    assert.equal(r.study_day, i + 1, `day ${i + 1} is study_day ${i + 1}`)
    assert.equal(r.status, 'pending')
    assert.equal(r.send_time, '07:00')
  })
  const fin = db.inserted.find((r) => key(r) === 's_final')
  assert.ok(fin, 'the final survey is scheduled')
  assert.equal(fin.scheduled_date, addDays(TODAY, 36))
  assert.equal(fin.study_day, DAYS + 1)
}

// 3. A late joiner: day 1 was three days ago. Days 1-3 skipped, today is day 4.
{
  const day1 = addDays(TODAY, -3)
  const db = await run({ schedule: baselineDone(), draw: 'nr' }, day1, addDays(TODAY, 25))
  const days = db.inserted.filter((r) => key(r).startsWith('nr_d'))
  assert.equal(days.length, DAYS)
  assert.deepEqual(days.slice(0, 3).map((r) => r.status), [SKIPPED, SKIPPED, SKIPPED], 'days already gone are never offered')
  assert.equal(days[3].status, 'pending', "today's day is open to them")
  assert.equal(days[3].scheduled_date, TODAY)
  assert.equal(days[3].study_day, 4, 'they join on the calendar day, not on day 1')
  assert.ok(days.slice(4).every((r) => r.status === 'pending'), 'and every day after it')
}

// 4. Assigned ahead of the fork (a Study 3 student): used as is, no draw.
{
  const db = await run({ schedule: baselineDone(), assignments: [{ node_id: 'rnd', value: 'sf' }] }, addDays(TODAY, 8), addDays(TODAY, 36))
  assert.equal(db.draws.length, 0, 'an existing assignment is never redrawn')
  assert.equal(db.inserted.filter((r) => key(r).startsWith('sf_d')).length, DAYS, 'the assigned arm is scheduled')
}

console.log('materializeSchedule, fixed-date arms behind a fork: all checks passed')
