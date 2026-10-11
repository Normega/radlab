// Participant-facing text that changes is written as one string, never as a
// conditional fragment beside other text: `question{n > 1 ? 's' : ''}`.
//
// Why: a browser translating the page replaces its text nodes with its own. When
// React later removes a fragment ('s' → ''), the node it remembers is no longer
// in the page and React throws "Failed to execute 'removeChild' on 'Node'". The
// missed-question note was written that way, and on 2026-10-11 it crashed 30
// Chrome/Edge participants of Sense Foraging Study 1 (src/lib/noTranslate.js now
// also turns translation off for sessions). A string built first and rendered as
// an element's only child is updated through textContent, which survives.
//
// The rule, for the participant-facing folders below: no line may put a
// conditional string fragment ({x ? 'a' : ''}, {x && 'a'}) next to literal text.
// A fragment that is never re-rendered with a different value can be ALLOWED
// with its reason.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

const PARTICIPANT_FACING = [
  'components/study', 'components/questionnaire', 'components/vas', 'components/ScreenerPage.jsx',
  'ripple', 'pages/SessionEntry.jsx', 'pages/StudyJoin.jsx', 'pages/OpenJoin.jsx', 'pages/StudySignup.jsx',
]

// {cond ? 'text' : ''} or {cond && 'text'} (either quote style) …
const FRAGMENT = /(?<!\$)\{[^{}]*(\?\s*(['"])[^'"]*\2\s*:\s*(['"])\3|&&\s*(['"])[^'"]+\4)\s*\}/
// … with literal text (a letter) outside braces on the same line.
const outsideText = line => /[A-Za-z]/.test(line.replace(/\{[^{}]*\}/g, '').replace(/<[^>]*>/g, ''))

const ALLOWED = {
  'components/study/MidpointStep.jsx:based on {r.n} session':
    'the midpoint summary is rendered once from fetched data; its counts never change while shown.',
  'components/study/MidpointStep.jsx:Midpoint{demoMode':
    'demoMode is fixed for the life of the screen.',
}

function files(rel) {
  const abs = join(SRC, rel)
  if (statSync(abs).isFile()) return [abs]
  return readdirSync(abs).flatMap(n => {
    const p = join(abs, n)
    if (statSync(p).isDirectory()) return files(relative(SRC, p))
    return /\.jsx$/.test(n) && !/\.test\./.test(n) ? [p] : []
  })
}

function offenders() {
  const out = []
  for (const f of PARTICIPANT_FACING.flatMap(files)) {
    const rel = relative(SRC, f).split(sep).join('/')
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.trim()
      if (code.startsWith('//') || code.startsWith('*') || /className=|style=|aria-|=\{`/.test(line)) return
      if (!FRAGMENT.test(line) || !outsideText(line)) return
      if (Object.keys(ALLOWED).some(k => k.startsWith(rel + ':') && line.includes(k.slice(rel.length + 1)))) return
      out.push(`${rel}:${i + 1}  ${code}`)
    })
  }
  return out
}

test('the rule catches the fragment that crashed Study 1', () => {
  const old = "            Please answer the highlighted question{stillMissing.length > 1 ? 's' : ''}"
  assert.ok(FRAGMENT.test(old) && outsideText(old))
  const fixed = '          <p className="cs-missing-note" role="status">{missingNote}</p>'
  assert.ok(!FRAGMENT.test(fixed))
})

test('no participant-facing line mixes a conditional text fragment into text', () => {
  assert.deepEqual(offenders(), [], 'build the string first and render it as the element\'s only child')
})
