import { test } from 'node:test'
import assert from 'node:assert/strict'
import { breWideByProfile, emotionKeyed, BRE_COLUMN_NOTES } from './breExport.js'
import { createRepeatNamer, putCell } from './exportIntegrity.js'

const tools = () => ({ namer: createRepeatNamer(), put: (t, c, v) => putCell(t, c, v) })
const r = (id, position, value, extra = {}) => ({ id, user_id: 'p1', position, value, rt_ms: 900, answered_at: `2026-11-23T10:00:${String(id).padStart(2, '0')}Z`, ...extra })

test('emotion-keyed names come only from the two emotion blocks', () => {
  assert.equal(emotionKeyed('upset_b1_m2', 'b1', 'sad'), 'upset_sadfilms_m2')
  assert.equal(emotionKeyed('emo_b2_anger', 'b2', 'anger'), 'emo_angerfilms_anger')
  assert.equal(emotionKeyed('upset_n1_clip', 'n1', 'neutral'), null)
  assert.equal(emotionKeyed('upset_baseline', 'baseline', null), null)
})

test('a rating lands under its position and, in an emotion block, under the film emotion', () => {
  const t = tools()
  const w = breWideByProfile([
    r(1, 'upset_b1_m2', 5, { block: 'b1', block_emotion: 'anger', version: 'main', condition: 'sf', clip_ids: ['A1', 'A3'] }),
    r(2, 'upset_b2_m2', 3, { block: 'b2', block_emotion: 'sad', clip_ids: ['S4', 'S5'] }),
  ], [], t)
  assert.equal(w.p1.bre_upset_b1_m2, 5)
  assert.equal(w.p1.bre_upset_angerfilms_m2, 5)
  assert.equal(w.p1.bre_upset_sadfilms_m2, 3)
  assert.equal(w.p1.bre_upset_b1_m2_rt_ms, 900)
  assert.equal(w.p1.bre_version, 'main')
  assert.equal(w.p1.bre_condition, 'sf')
  assert.equal(w.p1.bre_clips_b1, 'A1+A3')
  assert.equal(w.p1.bre_block_emotion_b2, 'sad')
})

test('a second rating at the same position is kept as _r2 and listed as a repeat', () => {
  const t = tools()
  const w = breWideByProfile([
    r(1, 'upset_b1_m0', 6, { block: 'b1', block_emotion: 'sad' }),
    r(2, 'upset_b1_m0', 4, { block: 'b1', block_emotion: 'sad' }),
  ], [], t)
  assert.equal(w.p1.bre_upset_b1_m0, 6)
  assert.equal(w.p1.bre_upset_b1_m0_r2, 4)
  assert.equal(w.p1.bre_upset_sadfilms_m0_r2, 4)
  assert.equal(t.namer.repeats.length, 1)
})

test('the strategy check and the end screen come from the events', () => {
  const t = tools()
  const ev = [
    { user_id: 'p1', event: 'strategy_check', detail: { correct: false } },
    { user_id: 'p1', event: 'strategy_check', detail: { correct: true } },
    { user_id: 'p1', event: 'task_end', step: 'bre_end' },
  ]
  const w = breWideByProfile([], ev, t)
  assert.deepEqual([w.p1.bre_check_attempts, w.p1.bre_check_first_correct, w.p1.bre_check_failed_twice, w.p1.bre_reached_end], [2, false, false, true])
})

test('every column the block can write has a codebook note', () => {
  const cols = ['bre_version', 'bre_condition', 'bre_clips_n1', 'bre_block_emotion_b1', 'bre_check_attempts', 'bre_check_first_correct',
    'bre_check_failed_twice', 'bre_reached_end', 'bre_upset_b1_m2_rt_ms', 'bre_upset_sadfilms_m2', 'bre_upset_practice', 'bre_emo_b1_sad',
    'bre_strat_b1_explore', 'bre_appr_b2_rumination', 'bre_breath_w_adherence_pct', 'bre_breath_b1_aware']
  for (const c of cols) assert.ok(BRE_COLUMN_NOTES.some(([re]) => re.test(c)), c)
  assert.match(BRE_COLUMN_NOTES.find(([re]) => re.test('bre_breath_b1_adherence_pct'))[1], /percent/)
})
