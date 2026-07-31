// Run directly:  node supabase/functions/verifyJwtConfig.test.mjs
//
// Guards the one thing supabase/config.toml exists to guarantee: that every
// Edge Function's verify_jwt is DECLARED rather than defaulted.
//
// Why this needs a test at all. The CLI defaults verify_jwt to true. Seven of
// the ten functions run with it false — pg_cron, server-side callers,
// unauthenticated links — so a function missing from config.toml deploys
// JWT-required and its caller starts 401-ing. Nothing surfaces that: the
// deploy succeeds, the function is ACTIVE, and the only symptom is a cron job
// quietly doing nothing. That exact shape cost 15 days of undelivered Ripple
// reminders in July 2026, from a different cause but the same silence.
//
// Checks 1-4 are offline and need no credentials. Check 5 compares against
// what is actually deployed and runs only when SUPABASE_ACCESS_TOKEN is set,
// so this stays useful on a laptop and in CI without secrets.
//
// The TOML parsing here is deliberately strict and narrow rather than a real
// parser: it understands exactly the shape this file is allowed to take, and
// throws on anything else. A lenient parser that silently skipped an entry it
// did not understand would report a false PASS, which is the one outcome that
// would make this test worse than useless.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FUNCTIONS_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT     = join(FUNCTIONS_DIR, '..', '..')
const CONFIG_PATH   = join(REPO_ROOT, 'supabase', 'config.toml')

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++ } else {
    fail++
    console.error(`  FAIL: ${name}`)
    if (detail) console.error(`        ${detail}`)
  }
}

// ── Parse config.toml ──────────────────────────────────────────────────────
// Accepts only: comments, blank lines, top-level `key = value`, and
// `[functions.<name>]` sections containing `verify_jwt = true|false`.
// Anything else throws — see the note above.

function parseFunctionConfig(text) {
  const out = new Map()
  let section = null

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    const at   = `config.toml line ${i + 1}: ${raw}`

    if (line === '' || line.startsWith('#')) return

    const header = line.match(/^\[([^\]]+)\]$/)
    if (header) {
      const name = header[1]
      if (name.startsWith('functions.')) {
        section = name.slice('functions.'.length)
        if (out.has(section)) throw new Error(`duplicate [functions.${section}] — ${at}`)
        out.set(section, {})
      } else {
        section = null   // some other section; its keys are not ours to read
      }
      return
    }

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/)
    if (!kv) throw new Error(`unparseable line — ${at}`)
    if (section === null) return   // top-level key such as project_id

    const [, key, rawVal] = kv
    if (key !== 'verify_jwt') {
      throw new Error(
        `unknown key "${key}" under [functions.${section}] — this test only ` +
        `understands verify_jwt. Teach it the new key before using it. — ${at}`,
      )
    }
    if (rawVal !== 'true' && rawVal !== 'false') {
      throw new Error(`verify_jwt must be literal true or false — ${at}`)
    }
    out.get(section).verify_jwt = rawVal === 'true'
  })

  return out
}

// ── Gather ─────────────────────────────────────────────────────────────────

check('supabase/config.toml exists', existsSync(CONFIG_PATH), CONFIG_PATH)
if (!existsSync(CONFIG_PATH)) {
  console.log(`verify_jwt config: ${pass}/${pass + fail} checks passed`)
  process.exit(1)
}

let configured
try {
  configured = parseFunctionConfig(readFileSync(CONFIG_PATH, 'utf8'))
} catch (err) {
  console.error(`  FAIL: config.toml could not be parsed strictly`)
  console.error(`        ${err.message}`)
  console.log('verify_jwt config: 0/1 checks passed')
  process.exit(1)
}

// A function is anything with its own directory, except the shared bundle.
const onDisk = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== '_shared')
  .map(d => d.name)
  .sort()

// ── 1. Every function on disk is declared ──────────────────────────────────
// The gap this file exists for: add a function, forget the config entry, and
// it deploys JWT-required.
const undeclared = onDisk.filter(n => !configured.has(n))
check(
  'every function directory has a [functions.<name>] entry',
  undeclared.length === 0,
  undeclared.length ? `missing from config.toml: ${undeclared.join(', ')}` : '',
)

// ── 2. Every declared function exists on disk ──────────────────────────────
// Catches a typo'd or renamed section. `[functions.send_mesage]` looks fine in
// review while the real send_message silently falls back to the default.
const orphaned = [...configured.keys()].filter(n => !onDisk.includes(n))
check(
  'every config entry names a real function directory',
  orphaned.length === 0,
  orphaned.length ? `no such function: ${orphaned.join(', ')} (typo, or deleted without cleaning up?)` : '',
)

// ── 3. Every entry states verify_jwt explicitly ────────────────────────────
// An empty section is worse than no section: it reads as deliberate.
const silent = [...configured.entries()]
  .filter(([, v]) => typeof v.verify_jwt !== 'boolean')
  .map(([n]) => n)
check(
  'every entry sets verify_jwt explicitly',
  silent.length === 0,
  silent.length ? `declared but no verify_jwt: ${silent.join(', ')}` : '',
)

// ── 4. Nothing relies on the CLI default ───────────────────────────────────
// Restating 1+3 as the property that actually matters, so a failure reads as
// the consequence rather than the mechanism.
const covered = onDisk.filter(n => typeof configured.get(n)?.verify_jwt === 'boolean')
check(
  `all ${onDisk.length} functions pinned (none left to the CLI default of true)`,
  covered.length === onDisk.length,
  `${covered.length}/${onDisk.length} pinned`,
)

// ── 5. Deployed state matches the config (opt-in) ──────────────────────────
// Needs a Supabase personal access token. Skipped silently when absent so this
// file stays runnable offline and in CI without secrets.

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref   = process.env.SUPABASE_PROJECT_REF ?? 'qajrlfqoicfcfhthsfay'

if (!token) {
  console.log('  (skipping live drift check — set SUPABASE_ACCESS_TOKEN to enable)')
} else {
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Management API returned ${res.status}`)
    const deployed = await res.json()

    const drift = deployed
      .filter(f => configured.has(f.slug))
      .filter(f => f.verify_jwt !== configured.get(f.slug).verify_jwt)
      .map(f => `${f.slug}: deployed=${f.verify_jwt} config=${configured.get(f.slug).verify_jwt}`)

    check(
      'deployed verify_jwt matches config.toml',
      drift.length === 0,
      drift.join('; '),
    )

    // A deployed function with no directory and no entry is invisible to
    // checks 1-3 but is still live and still defaulted.
    const undeclaredLive = deployed.map(f => f.slug).filter(s => !configured.has(s))
    check(
      'every deployed function is declared in config.toml',
      undeclaredLive.length === 0,
      undeclaredLive.length ? `live but undeclared: ${undeclaredLive.join(', ')}` : '',
    )
  } catch (err) {
    check('live drift check completed', false, err.message)
  }
}

console.log(`verify_jwt config: ${pass}/${pass + fail} checks passed`)
process.exit(fail === 0 ? 0 : 1)
