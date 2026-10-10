// Join-link parameters: query (SONA, older Prolific) and fragment (separate-
// identity Prolific) give the same request; test=1 marks a staff run.
import test from 'node:test'
import assert from 'node:assert/strict'
import { joinParams, joinRequest } from './joinParams.js'

const S = '74cb6aa5-857c-408e-adfa-a5556acd62b7'
const PID = '5f2a9c1b7e4d3a0012345678'

test('a Prolific link in the fragment and one in the query give the same request', () => {
  const frag = joinRequest(joinParams({ search: '', hash: `#study_id=${S}&PROLIFIC_PID=${PID}&STUDY_ID=abc` }))
  const query = joinRequest(joinParams({ search: `?study_id=${S}&PROLIFIC_PID=${PID}&STUDY_ID=abc`, hash: '' }))
  assert.deepEqual(frag, { study_id: S, external_id: PID, source: 'prolific', prolific_study_id: 'abc' })
  assert.deepEqual(query, frag)
})

test('SONA links keep working from the query', () => {
  assert.deepEqual(joinRequest(joinParams({ search: `?study_id=${S}&id=808081` })),
    { study_id: S, external_id: '808081', source: 'sona' })
})

test('the fragment wins where both carry a key', () => {
  const p = joinParams({ search: `?study_id=${S}&PROLIFIC_PID=old`, hash: `#PROLIFIC_PID=${PID}` })
  assert.equal(joinRequest(p).external_id, PID)
})

test('test=1 marks a staff run, in either place; anything else does not', () => {
  assert.equal(joinRequest(joinParams({ hash: `#study_id=${S}&PROLIFIC_PID=${PID}&test=1` })).test, true)
  assert.equal(joinRequest(joinParams({ search: `?study_id=${S}&id=1&test=1` })).test, true)
  assert.equal('test' in joinRequest(joinParams({ search: `?study_id=${S}&id=1&test=yes` })), false)
})

test('a link missing the study or the participant id gives no request', () => {
  assert.equal(joinRequest(joinParams({ search: `?study_id=${S}` })), null)
  assert.equal(joinRequest(joinParams({ hash: `#PROLIFIC_PID=${PID}` })), null)
  assert.equal(joinRequest(joinParams({})), null)
})
