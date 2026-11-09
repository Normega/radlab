import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSensingPauseRecord, sensingPauseColumns } from './sensingPauseColumns.js'

const taken = {
  v: 1, slot: 1, pause_button_side: 'left', device: 'phone', viewport_w: 390, local_hour: 14,
  choice: 'pause', decision_ms: 3456, decline_reason: null,
  pause: { total_ms: 61234, on_page_ms: 52000, unfocused_ms: 1234, hidden_ms: 8000, hidden_episodes: 1,
           unfocused_episodes: 1, taps: 0, keys: 0, scrolls: 2, ended_by: 'button', nudged: false },
  note: 'birds', setting: 'home', tired: 3, done: true,
}
const declined = { v: 1, slot: 1, choice: 'continue', decision_ms: 900, decline_reason: 'no_time', pause: null,
                   note: null, setting: 'work', tired: 'pna', done: true }

test('recognises a pause record and nothing else', () => {
  assert.equal(isSensingPauseRecord(taken), true)
  assert.equal(isSensingPauseRecord(declined), true)
  for (const v of [null, 3, 'pause', [1], { v: 1, slot: 1 }, { response_value: 2 }]) assert.equal(isSensingPauseRecord(v), false)
})

test('a taken pause: durations in seconds, one column per fact', () => {
  const c = Object.fromEntries(sensingPauseColumns(taken))
  assert.equal(c.choice, 'pause')
  assert.equal(c.decision_s, 3.5)
  assert.equal(c.on_page_s, 52)
  assert.equal(c.hidden_s, 8)
  assert.equal(c.total_s, 61.2)
  assert.equal(c.ended_by, 'button')
  assert.equal(c.nudged, 0)
  assert.equal(c.setting, 'home')
  assert.equal(c.button_side, 'left')
})

test('a declined offer has the same columns, blank where nothing was recorded', () => {
  const a = sensingPauseColumns(taken).map(([k]) => k)
  const b = sensingPauseColumns(declined).map(([k]) => k)
  assert.deepEqual(a, b)
  const c = Object.fromEntries(sensingPauseColumns(declined))
  assert.equal(c.choice, 'continue')
  assert.equal(c.decline_reason, 'no_time')
  assert.equal(c.on_page_s, '')
  assert.equal(c.nudged, '')
  assert.equal(c.tired, 'pna')
})
