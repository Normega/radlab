// Run directly:  node src/lib/responseInsertsChecked.test.mjs
//
// Every insert into a response table must read its result.
//
// supabase-js never throws on a database error: it returns { data, error }. A
// bare `await db.from('vas_responses').insert(row)` therefore discards an RLS
// denial or a dropped connection exactly as it discards success, and the
// participant is moved on while the answer is lost. The 2026-09-23 review
// found this in VAS, every Liliana intervention block, the screener result
// and the screener carry-forward flush, all silently. This fails CI if a new
// one appears.
//
// Accepted: the statement destructures `error` from the result, or the write
// goes through dbWrite (src/lib/dbWrite.js), which reports every failure.

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Keep in step with RESPONSE_TABLES in responsesAppendOnly.test.mjs.
const RESPONSE_TABLES = [
  'questionnaire_responses',
  'vas_responses',
  'instrument_responses',
  'zerin_daily_checkins',
  'pond_watch_results',
  'intervention_responses',
  'screener_results',
  'experience_factory_trials',
  'buddy_goals',
  'buddy_outcomes',
]

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(js|jsx|ts|mjs)$/.test(ent.name) && !/\.test\./.test(ent.name)) out.push(p)
  }
  return out
}

// The text of the statement that leads up to `.from(...)`: back to the
// previous statement boundary, which is enough to see `const { error } =` or
// `dbWrite(` even when the chain is split across lines.
function statementLead(text, index) {
  const start = Math.max(
    text.lastIndexOf(';', index - 1),
    text.lastIndexOf('{\n', index - 1),
    text.lastIndexOf('}\n', index - 1),
  )
  return text.slice(Math.max(start, index - 300), index)
}

export function uncheckedInserts(text) {
  const found = []
  for (const table of RESPONSE_TABLES) {
    const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)\\s*\\.insert\\(`, 'g')
    for (const m of text.matchAll(re)) {
      const lead = statementLead(text, m.index)
      const checked = /\{[^}]*\berror\b[^}]*\}\s*=/.test(lead) || /\bdbWrite\(/.test(lead)
      if (!checked) found.push({ table, line: text.slice(0, m.index).split('\n').length })
    }
  }
  return found
}

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}${detail ? ' -- ' + detail : ''}`) }
}

// The detector itself.
check('bare insert is caught',
  uncheckedInserts(`async function f() {\n  await db.from('vas_responses').insert(row)\n}`).length === 1)
check('destructured error passes',
  uncheckedInserts(`async function f() {\n  const { error } = await db\n    .from('vas_responses').insert(row)\n}`).length === 0)
check('renamed error passes',
  uncheckedInserts(`async function f() {\n  const { error: e } = await db.from('vas_responses').insert(row)\n}`).length === 0)
check('dbWrite passes',
  uncheckedInserts(`function f() {\n  dbWrite(db.from('vas_responses').insert(row), 'x')\n}`).length === 0)
check('an earlier statement\'s error does not count',
  uncheckedInserts(`async function f() {\n  const { error } = await a();\n  await db.from('vas_responses').insert(row)\n}`).length === 1)

// The codebase.
const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'supabase', 'functions'))]
const offenders = []
for (const file of files) {
  for (const u of uncheckedInserts(readFileSync(file, 'utf8'))) {
    offenders.push(`${file.slice(ROOT.length + 1)}:${u.line} ${u.table}.insert()`)
  }
}
check('every response-table insert reads its error', offenders.length === 0,
  `unchecked: ${offenders.join(', ')}`)

console.log(`responseInsertsChecked: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
