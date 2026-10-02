import { test } from 'node:test'
import assert from 'node:assert'
import { participantProgress, screenerOutcome, summarize, lookup } from './studyProgress.js'

const SESS = new Map([
  ['b', { node_key: 's_baseline', label: 'Baseline' }],
  ...Array.from({ length: 12 }, (_, i) => [`p1_${i}`, { node_key: `s_p1_ra_d${i + 1}`, label: `P1 ${i + 1}` }]),
  ['m', { node_key: 's_mid', label: 'Midpoint Assessment' }],
])

function row(sid, date, status, done = null) {
  return { id: `${sid}-${date}`, study_session_id: sid, scheduled_date: date, send_time: '06:00:00', status, completed_at: done }
}
const enr = (over = {}) => ({ id: 'e1', study_id: 's', profile_id: 'p', external_id: '12345', external_source: 'sona', status: 'enrolled', enrolled_at: '2026-09-20T14:00:00Z', consent_date: '2026-09-20T14:05:00Z', ...over })
const PASS = [{ phase1_passed: true, phase2_passed: true, phase2_outcome: 'pass', screened_at: '2026-09-20T14:02:00Z' }]

test('screener outcome reads the latest real attempt', () => {
  assert.equal(screenerOutcome([]), 'none')
  assert.equal(screenerOutcome([{ phase1_passed: false, screened_at: 'x' }]), 'fail_phase1')
  assert.equal(screenerOutcome([{ phase1_passed: true, phase2_passed: false, phase2_outcome: 'fail_high', screened_at: '2026-01-01' }]), 'fail_high')
})

test('phase 1 standing: cannot reach 10 once more than 2 are missed', () => {
  const rows = [row('b', '2026-09-20', 'completed', '2026-09-20T15:00:00Z')]
  for (let i = 0; i < 12; i++) {
    const st = i < 3 ? 'missed' : i < 6 ? 'completed' : 'pending'
    rows.push(row(`p1_${i}`, `2026-09-${21 + i}`, st, st === 'completed' ? '2026-09-25T10:00:00Z' : null))
  }
  const p = participantProgress(enr(), rows, SESS, PASS, 'feedback_choice', '2026-09-27')
  assert.equal(p.stage, 'Phase 1')
  assert.deepEqual([p.p1.done, p.p1.missed, p.p1.open], [3, 3, 6])
  assert.equal(p.p1Standing, 'cannot_reach')
  assert.equal(p.condition, null, 'condition is hidden until the midpoint is completed')
})

test('condition appears only after the midpoint', () => {
  const rows = [row('b', '2026-09-01', 'completed', 'x'), row('m', '2026-09-14', 'completed', '2026-09-14T12:00:00Z')]
  const p = participantProgress(enr(), rows, SESS, PASS, 'control_choice', '2026-09-27')
  assert.equal(p.condition, 'control_choice')
})

test('screened-out and unscreened people are staged before consent', () => {
  const out = participantProgress(enr({ consent_date: null }), [], SESS, [{ phase1_passed: true, phase2_passed: false, phase2_outcome: 'fail_low', screened_at: 'x' }], null, '2026-09-27')
  assert.equal(out.stage, 'Screened out')
  const none = participantProgress(enr({ consent_date: null }), [], SESS, [], null, '2026-09-27')
  assert.equal(none.stage, 'Not screened')
})

test('summary funnel and lookup', () => {
  const a = participantProgress(enr(), [], SESS, PASS, null, '2026-09-27')
  const b = participantProgress(enr({ id: 'e2', external_id: 'O-ABC123', external_source: 'open', contact_email: 'x.y@mail.utoronto.ca', consent_date: null }), [], SESS, [], null, '2026-09-27')
  const s = summarize([a, b])
  assert.equal(s.funnel.all.arrived, 2)
  assert.equal(s.funnel.sona.consented, 1)
  assert.equal(s.funnel.open.arrived, 1)
  assert.equal(lookup([a, b], '12345').length, 1)
  assert.equal(lookup([a, b], 'X.Y@mail').length, 1)
  assert.equal(lookup([a, b], 'o-abc').length, 1)
})
