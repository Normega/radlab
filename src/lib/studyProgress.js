// Where each participant is in a longitudinal study, derived from the rows the
// platform already keeps: the enrollment, the latest screener attempt, and the
// participant_schedule rows. Pure functions, no fetching: StudyReportsPage loads
// the rows and this module turns them into one record per participant and a
// study-level summary.
//
// Phase membership comes from the session's design-graph node key. Liliana
// Study 3 names them s_baseline, s_p1_*, s_mid, s_p2_*, s_final; a study whose
// keys don't follow that shape still gets completed/missed totals and a next
// session, just no phase breakdown.
//
// Blinding: the midpoint condition is drawn at consent but no condition exists
// for the participant until the midpoint (prereg B.1). `condition` is therefore
// reported only once the midpoint session is completed.

const OPEN = new Set(['pending', 'link_sent', 'unlocked'])

export const PHASE_MIN = 10   // Liliana: 10 of 12 Phase 1 sessions (ac_p1)
export const PHASE_DAYS = 12

export function phaseOf(nodeKey) {
  if (!nodeKey) return 'other'
  if (nodeKey === 's_baseline') return 'baseline'
  if (nodeKey.startsWith('s_p1_')) return 'p1'
  if (nodeKey === 's_mid') return 'mid'
  if (nodeKey.startsWith('s_p2_')) return 'p2'
  if (nodeKey === 's_final') return 'final'
  return 'other'
}

/** Latest real screener attempt -> 'pass' | 'fail_phase1' | 'fail_low' | 'fail_high' | 'fail' | 'none' */
export function screenerOutcome(attempts) {
  const real = (attempts ?? []).filter((a) => !a.resubmission_of)
  if (!real.length) return 'none'
  const latest = real.reduce((a, b) => (new Date(a.screened_at) >= new Date(b.screened_at) ? a : b))
  if (latest.phase1_passed === false) return 'fail_phase1'
  if (latest.phase2_passed === true || (latest.phase1_passed === true && latest.phase2_passed == null)) return 'pass'
  return latest.phase2_outcome || 'fail'
}

export const ROUTE_LABEL = { sona: 'SONA', open: 'Paid (poster/ads)', prolific: 'Prolific', self: 'Self sign-up' }

/**
 * One record per enrollment.
 * @param {object}   e          study_enrollments row
 * @param {object[]} rows       that participant's participant_schedule rows in that study
 * @param {Map}      sessionKey study_session_id -> { node_key, label }
 * @param {object[]} screens    that participant's screener_results in that study
 * @param {string?}  drawn      midpoint_group assignment value, if any
 * @param {string}   todayStr   YYYY-MM-DD, lab-local
 */
export function participantProgress(e, rows, sessionKey, screens, drawn, todayStr) {
  const timeline = (rows ?? [])
    .map((r) => {
      const s = sessionKey.get(r.study_session_id) ?? {}
      return {
        id: r.id,
        day: r.study_day,
        date: r.scheduled_date,
        time: r.send_time,
        status: r.completed_at ? 'completed' : r.status,
        completed_at: r.completed_at,
        last_sent_at: r.last_sent_at,
        node_key: s.node_key ?? null,
        label: s.label ?? s.node_key ?? '—',
        phase: phaseOf(s.node_key),
      }
    })
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || String(a.time ?? '').localeCompare(String(b.time ?? '')))

  const count = (phase, status) => timeline.filter((t) => (phase ? t.phase === phase : true) && (status ? t.status === status : true)).length
  const done = (phase) => count(phase, 'completed')
  const p1 = { done: done('p1'), missed: timeline.filter((t) => t.phase === 'p1' && (t.status === 'missed' || t.status === 'blocked')).length, open: timeline.filter((t) => t.phase === 'p1' && OPEN.has(t.status)).length, total: count('p1') }
  const p2 = { done: done('p2'), missed: timeline.filter((t) => t.phase === 'p2' && (t.status === 'missed' || t.status === 'blocked')).length, open: timeline.filter((t) => t.phase === 'p2' && OPEN.has(t.status)).length, total: count('p2') }
  const baselineDone = done('baseline') > 0
  const midDone = done('mid') > 0
  const finalDone = done('final') > 0
  const next = timeline.find((t) => OPEN.has(t.status)) ?? null
  const completedAts = timeline.map((t) => t.completed_at).filter(Boolean).sort()
  const lastActivity = completedAts.length ? completedAts[completedAts.length - 1] : null

  const screener = screenerOutcome(screens)
  const consented = !!e.consent_date

  // Phase 1 adherence: can they still reach the minimum?
  let p1Standing = null
  if (consented && p1.total > 0 && !midDone && e.status !== 'withdrawn') {
    const best = p1.done + p1.open
    if (p1.done >= PHASE_MIN) p1Standing = 'met'
    else if (best < PHASE_MIN) p1Standing = 'cannot_reach'
    else if (best === PHASE_MIN) p1Standing = 'no_more_misses'
    else p1Standing = 'on_track'
  }

  let stage
  if (e.status === 'withdrawn') stage = 'Withdrawn'
  else if (e.status === 'completed' || finalDone) stage = 'Completed'
  else if (screener === 'none' && !consented) stage = 'Not screened'
  else if (screener !== 'pass' && !consented) stage = 'Screened out'
  else if (!consented) stage = 'Eligible, not consented'
  else if (!baselineDone) stage = 'Baseline pending'
  else if (!midDone && p1.total && (p1.done + p1.missed) < p1.total) stage = 'Phase 1'
  else if (!midDone) stage = 'Midpoint'
  else if (p2.total && (p2.done + p2.missed) < p2.total) stage = 'Phase 2'
  else stage = 'Final assessment'

  return {
    enrollment_id: e.id,
    study_id: e.study_id,
    profile_id: e.profile_id,
    external_id: e.external_id,
    route: e.external_source ?? null,
    src: e.external_meta?.src ?? null,
    email: e.contact_email ?? null,
    is_test: !!e.is_test,
    status: e.status,
    enrolled_at: e.enrolled_at,
    consent_date: e.consent_date,
    withdrawal_reason: e.withdrawal_reason ?? null,
    screener,
    consented,
    stage,
    baselineDone, midDone, finalDone,
    p1, p2, p1Standing,
    next,
    nextOverdue: !!(next && next.date && next.date < todayStr),
    lastActivity,
    condition: midDone ? (drawn ?? null) : null,
    timeline,
  }
}

const STAGES = ['Not screened', 'Screened out', 'Eligible, not consented', 'Baseline pending', 'Phase 1', 'Midpoint', 'Phase 2', 'Final assessment', 'Completed', 'Withdrawn']

export function summarize(people) {
  const by = (fn) => people.reduce((m, p) => { const k = fn(p); m[k] = (m[k] ?? 0) + 1; return m }, {})
  const routes = [...new Set(people.map((p) => p.route ?? 'other'))]
  const funnelFor = (list) => ({
    arrived: list.length,
    screened: list.filter((p) => p.screener !== 'none').length,
    eligible: list.filter((p) => p.screener === 'pass').length,
    consented: list.filter((p) => p.consented).length,
    baseline: list.filter((p) => p.baselineDone).length,
    midpoint: list.filter((p) => p.midDone).length,
    completed: list.filter((p) => p.stage === 'Completed').length,
    withdrawn: list.filter((p) => p.consented && p.stage === 'Withdrawn').length,
  })
  const consented = people.filter((p) => p.consented)
  return {
    funnel: { all: funnelFor(people), ...Object.fromEntries(routes.map((r) => [r, funnelFor(people.filter((p) => (p.route ?? 'other') === r))])) },
    routes,
    screener: by((p) => p.screener),
    stages: STAGES.map((s) => [s, people.filter((p) => p.stage === s).length]).filter(([, n]) => n > 0),
    p1Standing: by((p) => p.p1Standing ?? 'n/a'),
    conditions: consented.filter((p) => p.condition).reduce((m, p) => {
      const k = `${p.route ?? 'other'}|${p.condition}`; m[k] = (m[k] ?? 0) + 1; return m
    }, {}),
    byWeek: weekly(people),
  }
}

// Monday-start weeks, lab-local date of enrolment.
function weekly(people) {
  const rows = {}
  for (const p of people) {
    const d = new Date(p.enrolled_at)
    const local = new Date(d.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
    const dow = (local.getDay() + 6) % 7
    local.setDate(local.getDate() - dow)
    const key = local.toISOString().slice(0, 10)
    rows[key] ??= { week: key, arrived: 0, eligible: 0, consented: 0 }
    rows[key].arrived++
    if (p.screener === 'pass') rows[key].eligible++
    if (p.consented) rows[key].consented++
  }
  return Object.values(rows).sort((a, b) => a.week.localeCompare(b.week))
}

/** Find people by SONA id / O- id / email fragment (case-insensitive). */
export function lookup(people, q) {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return people.filter((p) =>
    (p.external_id ?? '').toLowerCase() === s
    || (p.email ?? '').toLowerCase().includes(s)
    || ((p.external_id ?? '').toLowerCase().startsWith(s) && s.length >= 3))
}
