// Run directly:  node src/components/tasks/taskRegistry.test.mjs
//
// The Task Library (website.md §25a) states two things about each game that
// are really facts about other files: whether a study session can run it
// (GameStepWrapper's GAME_COMPONENTS) and whether it has a no-save preview
// (TaskPreviewPlayer's GAMES). Both are hand-written lists, so these checks
// exist to stop the registry drifting from them. The last group pins the stub
// client's answers to what the previewable games' save checks expect, and
// that it never reaches the network.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TASKS, PREVIEWABLE_SLUGS } from './taskRegistry.js'
import { makePreviewClient, PREVIEW_ROW_ID } from '../../lib/previewClient.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

const here = dirname(fileURLToPath(import.meta.url))
const src = rel => readFileSync(join(here, rel), 'utf8')

// Keys of an object literal `const NAME = { key: …, … }`, one key per line.
function literalKeys(text, name) {
  const m = text.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\}`))
  if (!m) return null
  return [...m[1].matchAll(/^\s+([a-z_]+):/gm)].map(x => x[1]).sort()
}

const sessionSlugs = literalKeys(src('../study/GameStepWrapper.jsx'), 'GAME_COMPONENTS')
const playerSlugs  = literalKeys(src('./TaskPreviewPlayer.jsx'), 'GAMES')
const runsInSessions = Object.keys(TASKS).filter(s => TASKS[s].runsInSessions).sort()

check('GameStepWrapper GAME_COMPONENTS parsed', Array.isArray(sessionSlugs) && sessionSlugs.length > 0)
check('TaskPreviewPlayer GAMES parsed', Array.isArray(playerSlugs) && playerSlugs.length > 0)
check(`runsInSessions matches GameStepWrapper (${runsInSessions} vs ${sessionSlugs})`,
  JSON.stringify(runsInSessions) === JSON.stringify(sessionSlugs))
check(`previewable matches TaskPreviewPlayer (${PREVIEWABLE_SLUGS} vs ${playerSlugs})`,
  JSON.stringify([...PREVIEWABLE_SLUGS].sort()) === JSON.stringify(playerSlugs))
for (const [slug, t] of Object.entries(TASKS)) {
  check(`${slug} has a name`, typeof t.name === 'string' && t.name.length > 0)
  check(`${slug} route is a path`, !t.route || t.route.startsWith('/'))
}

// ── stub client ────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch
let fetched = 0
globalThis.fetch = () => { fetched++; return Promise.reject(new Error('network')) }

const db = makePreviewClient()

// AptitudeSuite / ColorMax: insert(...).select('id').single() → data.id
const ins = await db.from('aptitude_sessions').insert({ a: 1 }).select('id').single()
check('insert…single resolves to { id }', ins.error === null && ins.data?.id === PREVIEW_ROW_ID)

// AptitudeSuite: update(...).eq(...).select('id') → non-empty array
const upd = await db.from('aptitude_sessions').update({ b: 2 }).eq('id', 'x').select('id')
check('update…select resolves to a one-row array', upd.error === null && Array.isArray(upd.data) && upd.data.length === 1)

// fire-and-forget .then on an insert (aptitude_events)
const evt = await new Promise(r => db.from('aptitude_events').insert([]).then(r))
check('bare insert .then gets no error', evt.error === null)

// WordMax: plain awaited insert
const wm = await db.from('word_max_sessions').insert({ c: 3 })
check('awaited insert gets no error', wm.error === null)

const user = await db.auth.getUser()
check('auth.getUser returns no user', user.data.user === null)

check('stub client never calls fetch', fetched === 0)
globalThis.fetch = realFetch

console.log(`taskRegistry: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
