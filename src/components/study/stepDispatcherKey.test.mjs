// Run directly:  node src/components/study/stepDispatcherKey.test.mjs
//
// StepDispatcher returns a different component per step CATEGORY, so two
// adjacent steps of the same category resolve to the same component type in the
// same position -- and React then reuses the instance, handing it new props
// instead of mounting it fresh. Any state the previous step left behind comes
// with it.
//
// That is not theoretical and it is not cheap. SessionEntry learned it first
// (a carry-forward flag survived into the next step and hung the Zerin
// baseline). StudySessionRunner had not, and on 2026-08-20 two live Breath Belt
// sessions froze on PHQ-4, the second of five questionnaires in a row: the
// wrapper instance carried PANAS's held submit lock, so the final tap on PHQ-4
// produced no insert, no advance, and no network request at all. Both
// participants were lost mid-session.
//
// A per-step key is the whole fix, and its absence is invisible until a
// template happens to put two same-category steps side by side -- which is a
// content decision made in the admin UI, not in code. So it is asserted here
// rather than left to review.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

function jsxFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...jsxFiles(full))
    else if (entry.endsWith('.jsx')) out.push(full)
  }
  return out
}

// Every place StepDispatcher is rendered, with the attribute list that follows.
const sites = []
for (const file of jsxFiles(SRC)) {
  const src = readFileSync(file, 'utf8')
  let at = src.indexOf('<StepDispatcher')
  while (at !== -1) {
    const end = src.indexOf('/>', at)
    sites.push({
      file:  relative(SRC, file).split(sep).join('/'),
      line:  src.slice(0, at).split('\n').length,
      props: end === -1 ? src.slice(at) : src.slice(at, end),
    })
    at = src.indexOf('<StepDispatcher', at + 1)
  }
}

// Guard the guard: if the component is ever renamed this test must fail loudly
// rather than pass by finding nothing to check.
check(`found the call sites (${sites.length})`, sites.length >= 3)

for (const site of sites) {
  check(
    `${site.file}:${site.line} keys StepDispatcher per step`,
    /\bkey=\{/.test(site.props),
  )
}

console.log(`stepDispatcherKey: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
