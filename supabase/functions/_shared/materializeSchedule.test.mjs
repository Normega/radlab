// Calendar checks for materializeSchedule's early-gate pull-forward, on a
// graph shaped like Liliana Study 3 (baseline -> counterbalanced Phase 1 ->
// midpoint -> randomize -> Phase 2 arm -> final window).
//
// Run: node supabase/functions/_shared/materializeSchedule.test.mjs
// (Node >= 22.18 strips the .ts types on import; no build step.)
import assert from 'node:assert'
import { materializeSchedule } from './materializeSchedule.ts'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const LAB_TZ = 'America/Toronto'

function labToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LAB_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/** Midday Toronto on `dateStr`, as a timestamptz string. */
function completedAt(dateStr) {
  return `${dateStr}T17:00:00.000Z`
}

const PRACTICES = ['nr', 'ra', 'sc']

/**
 * Nominal calendar (the 31-day design): baseline day 1, Phase 1 days 2-13 as
 * three counterbalanced 4-day blocks, midpoint day 14 (window through 16),
 * Phase 2 days 17-28, final day 29.
 */
function buildGraph() {
  const nodes = [
    { id: 't_base', type: 'timepoint', day_offset: 0, time_of_day: '06:00', label: 'Baseline' },
    { id: 's_base', type: 'session', label: 'Baseline assessment' },
    { id: 't_p1', type: 'timepoint', day_offset: 1, label: 'Phase 1' },
    { id: 'cb_p1', type: 'counterbalance', block_ids: PRACTICES.map((p) => `b_p1_${p}`) },
    { id: 'ac_p1', type: 'adherence_check', phase: 'phase1', min_required: 10, of_total: 12 },
    { id: 't_mid', type: 'timepoint', day_offset: 13, label: 'Midpoint' },
    { id: 's_mid', type: 'session', label: 'Midpoint assessment', link_expires_hours: 72 },
    {
      id: 'rnd_mid',
      type: 'randomize',
      arms: [
        { group: 'feedback_choice', entry: 't_p2_nr' },
        { group: 'control_choice', entry: 't_p2_ra' },
        { group: 'control_assigned', entry: 't_p2_sc' },
      ],
    },
    { id: 'ac_p2', type: 'adherence_check', phase: 'phase2', min_required: 10, of_total: 12 },
    { id: 't_final', type: 'timepoint', day_offset: 28, label: 'Final' },
    { id: 's_final', type: 'session', label: 'Final assessment', link_expires_hours: 72 },
  ]

  const edges = [
    { from: 't_base', to: 's_base' },
    { from: 's_base', to: 't_p1' },
    { from: 't_p1', to: 'cb_p1' },
    { from: 'cb_p1', to: 'ac_p1' },
    { from: 'ac_p1', to: 't_mid' },
    { from: 't_mid', to: 's_mid' },
    { from: 's_mid', to: 'rnd_mid' },
    { from: 'ac_p2', to: 't_final' },
    { from: 't_final', to: 's_final' },
  ]

  for (const p of PRACTICES) {
    nodes.push({
      id: `b_p1_${p}`,
      type: 'block',
      children: [1, 2, 3, 4].map((i) => `s_p1_${p}${i}`),
    })
    for (const i of [1, 2, 3, 4]) nodes.push({ id: `s_p1_${p}${i}`, type: 'session' })

    nodes.push({ id: `t_p2_${p}`, type: 'timepoint', day_offset: 16, label: `Phase 2 ${p}` })
    nodes.push({
      id: `b_p2_${p}`,
      type: 'block',
      children: Array.from({ length: 12 }, (_, i) => `s_p2_${p}${i + 1}`),
    })
    for (let i = 1; i <= 12; i++) nodes.push({ id: `s_p2_${p}${i}`, type: 'session' })

    edges.push({ from: `t_p2_${p}`, to: `b_p2_${p}` })
    edges.push({ from: `b_p2_${p}`, to: 'ac_p2' })
  }

  return { nodes, edges }
}

const GRAPH = buildGraph()
const SESSION_NODES = GRAPH.nodes.filter((n) => n.type === 'session')

/** node_key <-> study_sessions.id, 1:1 and stable. */
const SESSION_ROWS = SESSION_NODES.map((n) => ({
  id: `ss_${n.id}`,
  node_key: n.id,
  link_expires_hours: n.link_expires_hours ?? 24,
}))

// ─── Minimal supabase-js stand-in ────────────────────────────────────────────
// Only the shapes materializeSchedule actually uses: a thenable builder for
// reads (filters are no-ops — every fixture holds one participant), a
// recording insert, and draw_assignment via rpc.

function makeDb({ schedule = [], assignments = [], draws = {}, phaseDays = { phase1: 12, phase2: 11 } }) {
  const inserted = []

  const result = (data) => {
    const b = {
      select: () => b, eq: () => b, in: () => b, not: () => b, is: () => b,
      maybeSingle: () => b, single: () => b, order: () => b,
      then: (onOk, onErr) => Promise.resolve({ data, error: null }).then(onOk, onErr),
    }
    return b
  }

  // Liliana-specific adherence counting (countCompletedPhaseDays).
  const modules = []
  for (const [phase, n] of Object.entries(phaseDays)) {
    for (let i = 1; i <= n; i++) modules.push({ module_id: `m_${phase}_${i}`, phase })
  }

  const tables = {
    study_sessions: () => SESSION_ROWS,
    participant_schedule: () => schedule,
    participant_assignments: () => assignments,
    liliana_participants: () => ({ id: 'lp1' }),
    liliana_day_data: () => modules.map((m) => ({ module_id: m.module_id })),
    intervention_modules: () => modules,
  }

  return {
    inserted,
    from(table) {
      return {
        select: () => result(tables[table] ? tables[table]() : []),
        insert: (rows) => { inserted.push(...rows); return result(null) },
        update: () => result(null),
      }
    },
    rpc: async (_fn, args) => ({ data: { value: draws[args.p_slot_key], draw_index: 0 }, error: null }),
  }
}

const DRAWS = {
  cb_p1: PRACTICES.map((p) => `b_p1_${p}`),
  rnd_mid: 'feedback_choice',
}

/** A materialized participant_schedule row for `nodeKey`. */
function row(nodeKey, scheduledDate, status, completed = null) {
  return {
    status,
    study_session_id: `ss_${nodeKey}`,
    scheduled_date: scheduledDate,
    completed_at: completed,
  }
}

/** Everything through the midpoint, with the midpoint completed on `midDate`. */
function throughMidpoint(t0, midDate, midStatus = 'completed') {
  const rows = [row('s_base', addDays(t0, 0), 'completed', completedAt(addDays(t0, 0)))]
  let offset = 1
  for (const p of PRACTICES) {
    for (const i of [1, 2, 3, 4]) {
      rows.push(row(`s_p1_${p}${i}`, addDays(t0, offset), 'completed', completedAt(addDays(t0, offset))))
      offset++
    }
  }
  rows.push(row('s_mid', addDays(t0, 13), midStatus, midStatus === 'completed' ? completedAt(midDate) : null))
  return rows
}

async function run(t0, schedule, opts = {}) {
  const db = makeDb({ schedule, draws: DRAWS, ...opts })
  const result = await materializeSchedule(db, {
    participantId: 'p1',
    studyId: 'study1',
    graph: GRAPH,
    t0Date: t0,
    baselineSendTime: '06:00',
  })
  return { db, result }
}

/** Inserted rows as { nodeKey, date, studyDay }, in scheduled order. */
function plan(db) {
  const byId = Object.fromEntries(SESSION_ROWS.map((s) => [s.id, s.node_key]))
  return db.inserted
    .map((r) => ({ nodeKey: byId[r.study_session_id], date: r.scheduled_date, studyDay: r.study_day }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// 1. Midpoint done on its first available day (day 14) — Phase 2 starts day 15,
//    not day 17. The 3-day window is a catch window, not a waiting period.
{
  const t0 = addDays(labToday(), -13) // today is study day 14
  const midDate = addDays(t0, 13)
  const { db, result } = await run(t0, throughMidpoint(t0, midDate))
  const p2 = plan(db)

  assert.equal(p2.length, 12, 'the whole Phase 2 arm materializes in one pass')
  assert.equal(p2[0].nodeKey, 's_p2_nr1')
  assert.equal(p2[0].date, addDays(t0, 14), 'Phase 2 day 1 is the day after the midpoint')
  assert.equal(p2[0].studyDay, 15)
  assert.equal(p2[11].date, addDays(t0, 25), 'Phase 2 day 12 lands 12 days later')
  assert.equal(result.stoppedAt, 'ac_p2', 'stops at the Phase 2 adherence gate')
  assert.equal(result.withdrawal, null)
}

// 2. The shift carries: a later pass materializes the final window two days
//    early too, and re-inserts nothing.
{
  const t0 = addDays(labToday(), -26) // today is study day 27
  const schedule = throughMidpoint(t0, addDays(t0, 13))
  for (let i = 1; i <= 12; i++) {
    // Phase 2 as it was actually materialized: days 15-26, one day missed.
    schedule.push(row(
      `s_p2_nr${i}`,
      addDays(t0, 13 + i),
      i === 5 ? 'missed' : 'completed',
      i === 5 ? null : completedAt(addDays(t0, 13 + i)),
    ))
  }

  const { db, result } = await run(t0, schedule, { assignments: [{ node_id: 'rnd_mid', value: 'feedback_choice' }] })
  const final = plan(db)

  assert.equal(final.length, 1, 'only the final assessment is new')
  assert.equal(final[0].nodeKey, 's_final')
  assert.equal(final[0].date, addDays(t0, 26), 'final window opens day 27, not day 29')
  assert.equal(final[0].studyDay, 27)
  assert.equal(result.withdrawal, null, '11 of 12 Phase 2 days clears the adherence gate')
}

// 3. Midpoint done on the last day of its window (day 16) — the nominal
//    calendar, unchanged. This is the behavior every earlier participant got.
{
  const t0 = addDays(labToday(), -15) // today is study day 16
  const { db } = await run(t0, throughMidpoint(t0, addDays(t0, 15)))
  const p2 = plan(db)

  assert.equal(p2[0].date, addDays(t0, 16), 'Phase 2 still starts day 17')
  assert.equal(p2[0].studyDay, 17)
  assert.equal(p2[11].date, addDays(t0, 27))
}

// 4. Fork resolved a day after the early completion (an upstream daily row
//    only fell to 'missed' at the next midnight) — the pull-forward is capped
//    at today, never back-dated into a burst of already-due sends.
{
  const t0 = addDays(labToday(), -14) // midpoint done day 14, resolving on day 15
  const { db } = await run(t0, throughMidpoint(t0, addDays(t0, 13)))
  const p2 = plan(db)

  assert.equal(p2[0].date, labToday(), 'first Phase 2 row is today, not yesterday')
  assert.equal(p2[0].studyDay, 15)
}

// 4b. Fork resolved long after the window (e.g. an admin clearing a 'blocked'
//     row on day 18): the nominal calendar is already in the past, and the
//     pull-forward stays inert rather than compounding it — check_schedule
//     sends those rows as due, which is the pre-existing behavior.
{
  const t0 = addDays(labToday(), -17) // today is study day 18
  const { db } = await run(t0, throughMidpoint(t0, addDays(t0, 13)))
  const p2 = plan(db)

  assert.equal(p2[0].date, addDays(t0, 16), 'nominal Phase 2 start, unshifted')
  assert.equal(p2[0].studyDay, 17)
}

// 5. A missed midpoint still withdraws — the pull-forward reads completed_at,
//    which is null here, and must not disturb that path.
{
  const t0 = addDays(labToday(), -16)
  const { db, result } = await run(t0, throughMidpoint(t0, null, 'missed'))

  assert.equal(db.inserted.length, 0, 'nothing materializes past a missed gate')
  assert.deepEqual(result.withdrawal, {
    kind: 'missed_assessment',
    nodeId: 'rnd_mid',
    gateLabel: 'Midpoint assessment',
  })
}

// 6. Enrollment (nothing materialized): baseline + all of Phase 1 on the
//    nominal calendar, with no pull-forward anywhere near it.
{
  const t0 = labToday()
  const { db, result } = await run(t0, [])
  const first = plan(db)

  assert.equal(first.length, 13, 'baseline + 12 Phase 1 days, stopping at the first gate')
  assert.equal(first[0].nodeKey, 's_base')
  assert.equal(first[0].date, t0)
  assert.equal(first[12].date, addDays(t0, 12), 'Phase 1 ends day 13')
  assert.equal(result.stoppedAt, 'ac_p1')
}

console.log('materializeSchedule: 7/7 calendar checks passed')
