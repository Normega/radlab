// Headless checks: the arm comes from the assignment slot in a study and only a preview reads the URL.
// Also the participant texts' shape.
// Run: node --test src/games/BcatThreshold/options.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARM_SLOT, armFromAssignments, previewOptions, initialChoice } from './options.js'
import { instructionPages, richParts, pacerReminder, releaseKeysCue, PRACTICE_FEEDBACK } from './texts.js'
import { makeConfig } from './config.js'

test('a study run takes the arm from bcat_arm and fails closed without a valid one', () => {
  assert.equal(ARM_SLOT, 'bcat_arm')
  for (const arm of ['vision', 'touch', 'breath']) assert.equal(armFromAssignments({ bcat_arm: arm }), arm)
  for (const bad of [null, undefined, {}, { bcat_arm: '' }, { bcat_arm: 'Touch' }, { bcat_arm: 'smell' }, { arm: 'touch' }, 'touch']) {
    assert.equal(armFromAssignments(bad), null, JSON.stringify(bad))
  }
  assert.deepStrictEqual(initialChoice({ studyMode: true, assignments: { bcat_arm: 'breath' } }), { arm: 'breath', demo: false, simulate: false, practice: true })
  assert.deepStrictEqual(initialChoice({ studyMode: true, assignments: null }), { error: 'no_arm' })
})

test('a study run ignores the URL entirely, even inside a preview client', () => {
  const c = initialChoice({ studyMode: true, preview: true, assignments: { bcat_arm: 'vision' }, search: '?arm=touch&demo=1&simulate=1&practice=0', quickDemo: true })
  assert.deepStrictEqual(c, { arm: 'vision', demo: false, simulate: false, practice: true })
  assert.deepStrictEqual(initialChoice({ studyMode: true, assignments: {}, search: '?arm=touch' }), { error: 'no_arm' })
})

test('a preview reads arm, demo, simulate and practice from the URL, or offers the chooser', () => {
  assert.deepStrictEqual(previewOptions('?arm=touch&demo=1'), { arm: 'touch', demo: true, simulate: false, practice: true })
  assert.deepStrictEqual(previewOptions('?arm=breath&simulate=1&practice=0'), { arm: 'breath', demo: false, simulate: true, practice: false })
  assert.deepStrictEqual(previewOptions('', { quickDemo: true }).demo, true, 'a short-version share link is the demo')
  assert.equal(previewOptions('?arm=TOUCH').arm, null)
  assert.deepStrictEqual(initialChoice({ preview: true, search: '?demo=1' }), { arm: null, demo: true, simulate: false, practice: true, chooser: true })
  assert.deepStrictEqual(initialChoice({ preview: false, studyMode: false, search: '?arm=touch' }), { error: 'no_arm' }, 'neither study nor preview')
})

test('instruction texts: three pages per arm, key caps parsed, the test build wording', () => {
  const keys = makeConfig().keys
  for (const arm of ['vision', 'touch', 'breath']) {
    const pages = instructionPages(arm, 5, keys)
    assert.equal(pages.length, 3)
    assert.equal(pages[0].heading, 'Welcome to the Sensory Attention Task')
    assert.match(pages[0].paragraphs[0], /grow and shrink 5 times in a row/)
    assert.match(pages[2].paragraphs[0], /slowed down \(\[\[left arrow\]\]\), stayed the same \(\[\[up arrow\]\]\), or sped up \(\[\[right arrow\]\]\)/)
    for (const p of pages.flatMap(x => x.paragraphs)) assert.doesNotMatch(p, /NORM|<|&[a-z]+;/, 'no markers or HTML left')
  }
  assert.match(instructionPages('touch', 5, keys)[1].paragraphs[0], /hold down the \[\[W\]\] key while the circle expands, and hold down the \[\[S\]\] key while the circle shrinks/)
  assert.match(instructionPages('breath', 5, keys)[1].paragraphs[1], /^As you breathe in, hold down the \[\[W\]\] key\. As you breathe out, hold down the \[\[S\]\] key\. Use your left hand\.$/)
  assert.match(instructionPages('vision', 5, keys)[1].paragraphs[3], /Do not press any keys while the circle is pulsing/)
  assert.throws(() => instructionPages('smell', 5, keys), /unknown arm/)
  assert.deepStrictEqual(richParts('Hold [[W]] now'), ['Hold ', { key: 'W' }, ' now'])
  assert.deepStrictEqual(richParts('[[W]]'), [{ key: 'W' }])
  assert.equal(pacerReminder('vision', keys), 'Just watch the circle.')
  assert.match(pacerReminder('touch', keys), /while the circle grows/)
  assert.match(releaseKeysCue(keys), /\[\[W\]\] and \[\[S\]\]/)
  assert.deepStrictEqual(Object.keys(PRACTICE_FEEDBACK).sort(), ['no_change', 'slowing', 'speeding'])
})
