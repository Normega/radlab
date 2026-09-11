import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPlaceholderExternalId } from './externalIdGuard.ts'

test('real ids pass', () => {
  for (const id of ['808081', '99999999', '5f2a9c1b7e4d3a0012345678', 'pilot-808081', 'test-99999999', 'dryrun-3', 'SIM_001']) {
    assert.equal(isPlaceholderExternalId(id), false, id)
  }
})

test('unsubstituted SONA placeholder is refused, in any case', () => {
  for (const id of ['%SURVEY_CODE%', '%survey_code%', '%Survey_Code%', ' %SURVEY_CODE% ']) {
    assert.equal(isPlaceholderExternalId(id), true, id)
  }
})

test('unsubstituted Prolific placeholder is refused', () => {
  for (const id of ['{{%PROLIFIC_PID%}}', '{{PROLIFIC_PID}}', '%PROLIFIC_PID%']) {
    assert.equal(isPlaceholderExternalId(id), true, id)
  }
})

test('bare token names are refused', () => {
  for (const id of ['SURVEY_CODE', 'survey_code', 'PROLIFIC_PID']) {
    assert.equal(isPlaceholderExternalId(id), true, id)
  }
})

test('template-ish angle brackets are refused', () => {
  assert.equal(isPlaceholderExternalId('<participant id>'), true)
})

test('non-strings do not throw', () => {
  assert.equal(isPlaceholderExternalId(null), false)
  assert.equal(isPlaceholderExternalId(808081), false)
})
