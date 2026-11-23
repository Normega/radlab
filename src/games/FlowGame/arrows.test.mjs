// Headless checks for the arrow task's trial lists and scoring.
// Run: node --test src/games/FlowGame/arrows.test.mjs
import { test } from 'node:test'
import assert from 'node:assert'
import { ARROW_DEFAULTS, buildTrials, scoreBlock, stimulusOf } from './arrows.js'

test('stimuli: the middle arrow is the target, flankers agree only when congruent', () => {
  assert.equal(stimulusOf('left', 'congruent'), '<<<<<')
  assert.equal(stimulusOf('left', 'incongruent'), '>><>>')
  assert.equal(stimulusOf('right', 'congruent'), '>>>>>')
  assert.equal(stimulusOf('right', 'incongruent'), '<<><<')
})

test('a block has equal counts of each type and no long runs', () => {
  for (const seed of [1, 2, 3, 42, 9001]) {
    const ts = buildTrials(48, seed)
    assert.equal(ts.length, 48)
    const count = (k, v) => ts.filter(t => t[k] === v).length
    assert.equal(count('congruency', 'congruent'), 24)
    assert.equal(count('target', 'left'), 24)
    for (const s of ['<<<<<', '>><>>', '>>>>>', '<<><<']) assert.equal(count('stimulus', s), 12)
    let run = 1
    for (let i = 1; i < ts.length; i++) {
      run = ts[i].stimulus === ts[i - 1].stimulus ? run + 1 : 1
      assert.ok(run <= ARROW_DEFAULTS.maxRun, `seed ${seed}: run of ${run} at trial ${i + 1}`)
    }
    for (const t of ts) assert.ok(t.itiMs >= ARROW_DEFAULTS.itiMinMs && t.itiMs <= ARROW_DEFAULTS.itiMaxMs)
  }
})

test('the same seed gives the same block, a different seed a different one', () => {
  assert.deepEqual(buildTrials(48, 7), buildTrials(48, 7))
  assert.notDeepEqual(buildTrials(48, 7).map(t => t.stimulus), buildTrials(48, 8).map(t => t.stimulus))
})

test('trial counts that are not a multiple of 4 are refused', () => {
  assert.throws(() => buildTrials(50, 1))
})

test('scoring: accuracy, correct-trial RT means, congruency effect, exclusions', () => {
  const trials = [
    { congruency: 'congruent', correct: true, rtMs: 400, timeout: false },
    { congruency: 'congruent', correct: true, rtMs: 500, timeout: false },
    { congruency: 'congruent', correct: true, rtMs: 100, timeout: false }, // anticipation
    { congruency: 'incongruent', correct: true, rtMs: 520, timeout: false },
    { congruency: 'incongruent', correct: false, rtMs: 300, timeout: false },
    { congruency: 'incongruent', correct: false, rtMs: null, timeout: true },
  ]
  const s = scoreBlock(trials)
  assert.equal(s.n, 6)
  assert.equal(s.timeouts, 1)
  assert.equal(s.anticipations, 1)
  assert.equal(s.accuracy, 4 / 6)
  assert.equal(s.accuracyIncongruent, 1 / 3)
  assert.equal(s.meanRtCongruentMs, 450)
  assert.equal(s.meanRtIncongruentMs, 520)
  assert.equal(s.congruencyEffectMs, 70)
})
