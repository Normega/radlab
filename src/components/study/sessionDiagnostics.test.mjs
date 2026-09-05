import { test } from 'node:test'
import assert from 'node:assert/strict'
import { viewportString, sessionStartRow, stepCrashRow } from './sessionDiagnostics.js'

const PID = '3e10c520-da53-4e22-bdff-7c57f85d848e'
const nav = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X)' }
const win = { innerWidth: 390, innerHeight: 844 }

test('viewport: rounds and formats, null where there is no window', () => {
  assert.equal(viewportString(win), '390x844')
  assert.equal(viewportString({ innerWidth: 390.6, innerHeight: 844.2 }), '391x844')
  assert.equal(viewportString(undefined), null)
  assert.equal(viewportString({}), null)
})

test('session_start carries the device and no step', () => {
  const row = sessionStartRow({ participantId: PID, studyId: 'S', scheduleId: 'SCH', nav, win })
  assert.equal(row.kind, 'session_start')
  assert.equal(row.participant_id, PID)
  assert.equal(row.schedule_id, 'SCH')
  assert.equal(row.step_index, null)
  assert.equal(row.viewport, '390x844')
  assert.match(row.user_agent, /iPhone/)
})

test('no participant id means no row — never write an unattributable one', () => {
  assert.equal(sessionStartRow({ participantId: null, nav, win }), null)
  assert.equal(stepCrashRow({ participantId: undefined, stepIndex: 4, nav, win }), null)
})

test('step_crash names where it broke, reading either node shape', () => {
  const row = stepCrashRow({
    participantId: PID, studyId: 'S', stepIndex: 16,
    node: { activity: { category: 'game', subcategory: 'color_max' } },
    error: new Error('Cannot read properties of undefined'),
    nav, win,
  })
  assert.equal(row.kind, 'step_crash')
  assert.equal(row.step_index, 16)
  assert.equal(row.step_category, 'game')
  assert.equal(row.step_subcategory, 'color_max')
  assert.match(row.error_message, /Cannot read properties/)

  // StepDispatcher nodes arrive as `activities` from some queries.
  const alt = stepCrashRow({
    participantId: PID, stepIndex: 5,
    node: { activities: { category: 'game', subcategory: 'aptitude_suite' } },
    error: new Error('x'), nav, win,
  })
  assert.equal(alt.step_subcategory, 'aptitude_suite')
})

test('step 0 is recorded as 0, not lost to a falsy check', () => {
  const row = stepCrashRow({ participantId: PID, stepIndex: 0, error: new Error('x'), nav, win })
  assert.equal(row.step_index, 0)
})

test('a missing node still yields a usable row', () => {
  const row = stepCrashRow({ participantId: PID, stepIndex: 9, error: new Error('boom'), nav, win })
  assert.equal(row.step_category, null)
  assert.equal(row.step_subcategory, null)
  assert.equal(row.error_message, 'boom')
})

test('runaway strings are clipped, not dropped', () => {
  const row = stepCrashRow({
    participantId: PID, stepIndex: 1,
    error: new Error('E'.repeat(900)),
    nav: { userAgent: 'U'.repeat(900) }, win,
  })
  assert.equal(row.user_agent.length, 400)
  assert.equal(row.error_message.length, 500)
})

test('a thrown non-Error still produces a message', () => {
  const row = stepCrashRow({ participantId: PID, stepIndex: 2, error: 'plain string throw', nav, win })
  assert.equal(row.error_message, 'plain string throw')
})
