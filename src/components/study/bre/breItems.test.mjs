import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_ITEMS, EMOTION_CHECK, BREATH, STRATEGY_CHECK, strategyCheckCorrect, isValidValue } from './breItems.js'

test('item ids are unique and the packet counts hold', () => {
  const ids = [...Object.keys(ALL_ITEMS)]
  assert.equal(ids.length, 1 + 5 + 2 + 3 + 6)
  assert.equal(EMOTION_CHECK.length, 5)
  assert.equal(BREATH.length, 6)
  assert.equal(STRATEGY_CHECK.options.length, 3)
})

test('the only percentage item is the one the database lets take 0–100', () => {
  const pct = Object.values(ALL_ITEMS).filter(i => i.percent).map(i => i.id)
  assert.deepEqual(pct, ['breath_adherence_pct'])
  const sql = readFileSync(new URL('../../../../supabase/migrations/20261123_bre_ratings_percent.sql', import.meta.url), 'utf8')
  assert.match(sql, /item_id = 'breath_adherence_pct' THEN value BETWEEN 0 AND 100/)
})

test('values: 1–7 for ratings, 0–100 by tens for adherence, nothing else', () => {
  assert.ok(isValidValue('upset', 1) && isValidValue('upset', 7))
  assert.ok(!isValidValue('upset', 0) && !isValidValue('upset', 8) && !isValidValue('upset', 3.5))
  assert.ok(isValidValue('breath_adherence_pct', 0) && isValidValue('breath_adherence_pct', 100))
  assert.ok(!isValidValue('breath_adherence_pct', 55))
  assert.ok(!isValidValue('nonsense', 3))
})

test('strategy check: own condition is correct, "slow" never is', () => {
  assert.ok(strategyCheckCorrect('sf', 'sf'))
  assert.ok(strategyCheckCorrect('em', 'em'))
  assert.ok(!strategyCheckCorrect('sf', 'em'))
  assert.ok(!strategyCheckCorrect('sf', 'slow') && !strategyCheckCorrect('em', 'slow'))
})
