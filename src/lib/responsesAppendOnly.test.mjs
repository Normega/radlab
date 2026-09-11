// Run directly:  node src/lib/responsesAppendOnly.test.mjs
//
// Regression guard for the never-overwrite policy (CLAUDE.md, participant data
// rule 5; supabase/migrations/20260911_responses_never_overwrite.sql).
//
// On 2026-08-26/27 a duplicate-submit trigger that UPDATEd the earlier row and
// returned NULL on the insert destroyed 1,895 slider ratings in Sandy Study 3,
// with no error anywhere. Nothing in lint, the tests or the build could see it.
// This test is the thing that can: it fails CI if code or a migration brings back
// a way to overwrite or discard a collected response.

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Tables whose rows are collected responses. Every row is a datum; none is ever
// updated in place or dropped on insert. A new response table is added here.
const RESPONSE_TABLES = [
  'questionnaire_responses',
  'vas_responses',
  'instrument_responses',
  'zerin_daily_checkins',
  'pond_watch_results',
  'intervention_responses',
  'screener_results',
]

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}${detail ? ' -- ' + detail : ''}`) }
}

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

// ── 1. No client or edge-function code overwrites a response ─────────────────
//
// An update or upsert chained onto `.from('<response table>')` is an overwrite.
// A repeat is inserted as a new row; the database flags provable copies.

function overwritingWrites(text) {
  const found = []
  for (const table of RESPONSE_TABLES) {
    const fromRe = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`, 'g')
    for (const m of text.matchAll(fromRe)) {
      const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 800)
      const next = tail.search(/\.from\(/)
      const chain = next >= 0 ? tail.slice(0, next) : tail
      const hit = chain.match(/\.(upsert|update)\(/)
      if (hit) found.push({ table, op: hit[1], line: text.slice(0, m.index).split('\n').length })
    }
  }
  return found
}

const codeFiles = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'supabase', 'functions'))]
const writers = []
for (const file of codeFiles) {
  for (const w of overwritingWrites(readFileSync(file, 'utf8'))) {
    writers.push(`${file.slice(ROOT.length + 1)}:${w.line} ${w.table}.${w.op}()`)
  }
}
check('no code updates or upserts a response table', writers.length === 0, writers.join('; '))
check('the code scan covered the codebase', codeFiles.length > 50, `${codeFiles.length} files`)

// The scan must be able to see what it guards against.
check('the scan detects an upsert onto a response table',
  overwritingWrites(`db.from('screener_results').upsert({ a: 1 }, { onConflict: 'x' })`).length === 1)
check('the scan detects an update onto a response table',
  overwritingWrites(`db\n  .from("vas_responses")\n  .update({ value: 2 })\n  .eq('id', id)`).length === 1)
check('the scan leaves an insert alone',
  overwritingWrites(`db.from('vas_responses').insert({ value: 2 })`).length === 0)
check('the scan does not blame a later statement on another table',
  overwritingWrites(`db.from('vas_responses').insert(r); db.from('profiles').update(p)`).length === 0)

// ── 2. No migration leaves a discarding trigger on a response table ──────────
//
// Replays every migration in filename order, tracking CREATE/DROP TRIGGER and the
// latest body of each function, then inspects what is left active.

const MIG = join(ROOT, 'supabase', 'migrations')
const migrations = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()
const cut = migrations.findIndex(f => f.endsWith('_responses_never_overwrite.sql'))
check('the never-overwrite migration is present', cut > 0)

const fnRe = /create\s+(?:or\s+replace\s+)?function\s+(?:[a-z_]+\.)?([a-z0-9_]+)\s*\(([^;]*?)\bas\s+(\$[a-z0-9_]*\$)([\s\S]*?)\3/gi
const evRe = /(create\s+trigger\s+([a-z0-9_]+)\s+(before|after|instead\s+of)\s+([^;]*?)\bon\s+(?:public\.)?([a-z0-9_]+)[^;]*?execute\s+(?:function|procedure)\s+(?:[a-z_]+\.)?([a-z0-9_]+))|(drop\s+trigger\s+(?:if\s+exists\s+)?([a-z0-9_]+)\s+on\s+(?:public\.)?([a-z0-9_]+))/gi

function discardingTriggers(files) {
  const fnBodies = new Map()
  const active = new Map()   // table -> Map(trigger -> { fn, timing, events, file })
  for (const f of files) {
    const sql = readFileSync(join(MIG, f), 'utf8')
    for (const m of sql.matchAll(fnRe)) fnBodies.set(m[1].toLowerCase(), m[4])
    for (const m of sql.matchAll(evRe)) {
      if (m[1]) {
        const table = m[5].toLowerCase()
        if (!active.has(table)) active.set(table, new Map())
        active.get(table).set(m[2].toLowerCase(), {
          fn: m[6].toLowerCase(), timing: m[3].toLowerCase(), events: m[4].toLowerCase(), file: f,
        })
      } else {
        active.get(m[9].toLowerCase())?.delete(m[8].toLowerCase())
      }
    }
  }
  const found = []
  for (const table of RESPONSE_TABLES) {
    for (const [trigger, t] of active.get(table) ?? []) {
      const body = fnBodies.get(t.fn) ?? ''
      const drops = t.timing === 'before' && /insert/.test(t.events) && /return\s+null/i.test(body)
      const overwrites = /\bupdate\s+(?:public\.)?[a-z_]+\s+set\b/i.test(body)
      if (drops || overwrites) found.push({ table, trigger, fn: t.fn, file: t.file, drops, overwrites })
    }
  }
  return found
}

const now = discardingTriggers(migrations)
check('no active trigger on a response table discards an insert or overwrites a row',
  now.length === 0,
  now.map(d => `${d.table}.${d.trigger} -> ${d.fn}() from ${d.file}`
    + `${d.drops ? ' [returns NULL on insert]' : ''}${d.overwrites ? ' [UPDATE ... SET]' : ''}`).join('; '))

// The replay must be capable of seeing the failure: stopping just before the
// never-overwrite migration, the four guards it retired are still active.
if (cut > 0) {
  const earlierTables = new Set(discardingTriggers(migrations.slice(0, cut)).map(d => d.table))
  for (const t of ['questionnaire_responses', 'instrument_responses', 'zerin_daily_checkins', 'pond_watch_results']) {
    check(`the replay detects the retired guard on ${t}`, earlierTables.has(t))
  }
}

console.log(`# responses append-only: ${pass}/${pass + fail} checks passed`)
if (fail) process.exit(1)
