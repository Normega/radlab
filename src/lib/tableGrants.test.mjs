// Run directly:  node src/lib/tableGrants.test.mjs
//
// Regression guard for explicit table grants (CLAUDE.md "Every new table gets
// explicit grants").
//
// Until 2026-10-30 Supabase's default privileges opened every new table in
// `public` to anon, authenticated and service_role, and RLS did the protecting.
// From that date new tables get no grants at all, and a table without them is
// unreachable through the Data API: supabase-js, PostgREST and Edge Functions
// get "permission denied" while the migration itself applies cleanly. The lab
// creates ~7 tables a week (53 between Sep 1 and Oct 20, 2026), and only 2 of
// the 26 migrations that made them granted anything explicitly. This test fails
// CI if a migration dated 2026-10-30 or later creates a table or view in
// `public` without granting it to authenticated and service_role in the same
// file -- or marking it `-- no-api-grants: public.<name>` with a reason.

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MIG_DIR = join(ROOT, 'supabase', 'migrations')
const CUTOFF = '20261030'
const REQUIRED_ROLES = ['authenticated', 'service_role']

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}${detail ? ' -- ' + detail : ''}`) }
}

const IDENT = String.raw`"?[A-Za-z_][A-Za-z0-9_$]*"?`
const QUALIFIED = String.raw`(?:${IDENT}\s*\.\s*)?${IDENT}`

/** 'public.Foo' / '"public"."foo"' / 'foo' -> { schema, name }, lower-cased, unquoted. */
function splitName(raw) {
  const parts = raw.replace(/\s+/g, '').split('.').map((p) => p.replace(/"/g, '').toLowerCase())
  return parts.length === 2 ? { schema: parts[0], name: parts[1] } : { schema: 'public', name: parts[0] }
}

/**
 * Relations a migration creates in `public`, the roles granted on each, and the
 * ones marked no-api-grants. Function bodies (dollar-quoted) and comments are
 * stripped first, so neither a CREATE TABLE inside a function nor a GRANT in a
 * comment counts.
 */
export function analyse(sqlText) {
  const exempt = new Set()
  for (const m of sqlText.matchAll(new RegExp(String.raw`--\s*no-api-grants:\s*(${QUALIFIED})`, 'gi'))) {
    exempt.add(splitName(m[1]).name)
  }

  const sql = sqlText
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ')   // dollar-quoted bodies
    .replace(/\/\*[\s\S]*?\*\//g, ' ')                  // block comments
    .replace(/--[^\n]*/g, ' ')                          // line comments

  const created = []
  const createRe = new RegExp(
    String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:unlogged\s+)?(?:(materialized\s+view|view|table))\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`,
    'gi')
  for (const m of sql.matchAll(createRe)) {
    const { schema, name } = splitName(m[2])
    if (schema !== 'public') continue
    created.push({ name, kind: m[1].toLowerCase().replace(/\s+/g, ' ') })
  }

  const granted = new Map() // name -> Set(role)
  const schemaWide = new Set()
  const grantRe = /\bgrant\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+to\s+([\s\S]+?)(?:\s+with\s+grant\s+option)?\s*;/gi
  for (const m of sql.matchAll(grantRe)) {
    const objects = m[2].trim()
    const roles = m[3].split(',').map((r) => r.trim().replace(/"/g, '').toLowerCase())
    if (/^(function|functions|procedure|routine|sequence|schema|database|type|domain|all\s+(functions|sequences|procedures|routines))\b/i.test(objects)) continue
    if (/^all\s+tables\s+in\s+schema\s+/i.test(objects)) {
      if (/\bpublic\b/i.test(objects)) roles.forEach((r) => schemaWide.add(r))
      continue
    }
    const list = objects.replace(/^table\s+/i, '').split(',')
    for (const raw of list) {
      const { schema, name } = splitName(raw.trim())
      if (schema !== 'public') continue
      const set = granted.get(name) ?? new Set()
      roles.forEach((r) => set.add(r))
      granted.set(name, set)
    }
  }

  const missing = []
  for (const { name, kind } of created) {
    if (exempt.has(name)) continue
    const roles = new Set([...(granted.get(name) ?? []), ...schemaWide])
    const lacking = REQUIRED_ROLES.filter((r) => !roles.has(r))
    if (lacking.length > 0) missing.push({ name, kind, lacking })
  }
  return { created, granted, exempt, missing }
}

// ─── The parser can see what it must see ────────────────────────────────────
// A check whose regex silently matched nothing would pass forever, so these
// fixtures pin both directions.

const missingOf = (sql) => analyse(sql).missing.map((m) => `${m.name}:${m.lacking.join('+')}`)

const CASES = [
  ['table with both grants', `
    create table public.t1 (id uuid);
    alter table public.t1 enable row level security;
    grant select, insert on public.t1 to authenticated;
    grant select, insert, update, delete on public.t1 to service_role;`, []],
  ['table with no grants', `create table public.t2 (id uuid);`, ['t2:authenticated+service_role']],
  ['service_role forgotten', `
    CREATE TABLE IF NOT EXISTS t3 (id uuid);
    GRANT SELECT ON TABLE t3 TO authenticated;`, ['t3:service_role']],
  ['one grant naming several tables and roles', `
    create table public.a (id int); create table public.b (id int);
    grant select on public.a, public.b to authenticated, service_role;`, []],
  ['quoted and qualified names', `
    create unlogged table "public"."Q" (id int);
    grant all on "public"."Q" to "authenticated", service_role;`, []],
  ['no-api-grants marker', `
    -- no-api-grants: public.secret_keys -- reached only via load_secret()
    create table public.secret_keys (k text);`, []],
  ['CREATE TABLE inside a function body is not a table', `
    create function public.f() returns void language plpgsql as $fn$
    begin execute 'create table public.dyn (id int)'; create table public.dyn2 (id int); end $fn$;`, []],
  ['another schema is not checked', `create table private.internal (id int);`, []],
  ['a view needs grants too', `create or replace view public.v as select 1;`, ['v:authenticated+service_role']],
  ['schema-wide grant covers the file', `
    create table public.c (id int);
    grant select on all tables in schema public to authenticated, service_role;`, []],
  ['a grant inside a comment does not count', `
    create table public.d (id int);
    -- grant select on public.d to authenticated, service_role;`, ['d:authenticated+service_role']],
  ['function grants are not table grants', `
    create table public.e (id int);
    grant execute on function public.e_rpc() to authenticated, service_role;`, ['e:authenticated+service_role']],
]
for (const [name, sql, expected] of CASES) {
  const got = missingOf(sql)
  check(`parser: ${name}`, JSON.stringify(got) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`)
}

// ─── Every migration from the cutoff on ─────────────────────────────────────

const files = readdirSync(MIG_DIR).filter((f) => /^\d{8}_.*\.sql$/.test(f)).sort()
const checked = files.filter((f) => f.slice(0, 8) >= CUTOFF)
for (const f of checked) {
  const { missing } = analyse(readFileSync(join(MIG_DIR, f), 'utf8'))
  check(`${f} grants every table and view it creates`, missing.length === 0,
    missing.map((m) => `${m.kind} public.${m.name} lacks ${m.lacking.join(', ')}`).join('; ')
    + ' -- add GRANTs (CLAUDE.md "Every new table gets explicit grants") or a `-- no-api-grants: public.<name>` line saying why not')
}
check('the migrations directory was found and read', files.length > 0, MIG_DIR)

console.log(`# table grants: ${pass}/${pass + fail} checks passed (${checked.length} migration(s) on or after ${CUTOFF})`)
if (fail) process.exit(1)
