// scrollToTop: resets every marked scroll panel and the window, and lets go of a
// focused button (which can drag the viewport back down) but never of an input
// the new page focused on purpose.
import test from 'node:test'
import assert from 'node:assert/strict'
import { scrollToTop } from './scrollToTop.js'

function fakeDoc(active) {
  const panels = [{ scrollTop: 640 }, { scrollTop: 0 }, { scrollTop: 75 }]
  return { panels, doc: { body: {}, activeElement: active, querySelectorAll: sel => (sel === '[data-scroll-root]' ? panels : []) } }
}

test('every marked panel and the window go back to the top', () => {
  const calls = []
  const { panels, doc } = fakeDoc(null)
  scrollToTop(doc, { scrollTo: (x, y) => calls.push([x, y]) })
  assert.deepEqual(panels.map(p => p.scrollTop), [0, 0, 0])
  assert.deepEqual(calls, [[0, 0]])
})

test('a focused button is released; a focused input keeps its focus', () => {
  let blurred = 0
  const button = { tagName: 'BUTTON', blur: () => { blurred++ } }
  scrollToTop(fakeDoc(button).doc, { scrollTo() {} })
  assert.equal(blurred, 1)
  const input = { tagName: 'INPUT', blur: () => { blurred++ } }
  scrollToTop(fakeDoc(input).doc, { scrollTo() {} })
  assert.equal(blurred, 1, 'an autofocused input is left alone')
})

test('no document (server render, tests) is a no-op, not a crash', () => {
  assert.doesNotThrow(() => scrollToTop(undefined, undefined))
})
