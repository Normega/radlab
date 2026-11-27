// Run directly: node --test src/games/AptitudeSuite/letterBoard.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { letterStates, BOARD_ROWS } from './letterBoard.js'

const g = (word, statuses) => word.split('').map((letter, i) => ({ letter, status: statuses[i] }))

test('a new word starts with an empty board', () => {
  assert.deepEqual(letterStates([]), {})
})

test('each tried letter takes its status', () => {
  const s = letterStates([g('crane', ['gray', 'yellow', 'gray', 'gray', 'green'])])
  assert.deepEqual(s, { c: 'gray', r: 'yellow', a: 'gray', n: 'gray', e: 'green' })
})

test('the best status wins across copies and guesses: green > yellow > grey', () => {
  // "geese" against "sheep": one e green, one yellow, one grey in the same guess
  const s = letterStates([
    g('geese', ['gray', 'yellow', 'green', 'yellow', 'gray']),
    g('slept', ['green', 'gray', 'green', 'yellow', 'gray']),
  ])
  assert.equal(s.e, 'green')
  assert.equal(s.s, 'green')
  assert.equal(s.p, 'yellow')
  assert.equal(s.g, 'gray')
})

test('the board covers all 26 letters once', () => {
  const all = BOARD_ROWS.join('')
  assert.equal(all.length, 26)
  assert.equal(new Set(all).size, 26)
})
