import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Shared vocabulary for the load test. Everything that names the scratch
// class or the synthetic users lives here, because teardown's safety depends
// on setup and teardown agreeing on exactly one prefix and one slug.

export const SCRATCH_SLUG   = 'loadtest'
export const SCRATCH_NAME   = 'Load test (synthetic)'
export const USER_PREFIX    = 'loadtest+'
export const USER_DOMAIN    = '@radlab.zone'
export const USER_PASSWORD  = 'loadtest-only-not-a-real-account'

export const userEmail = (n) => `${USER_PREFIX}${String(n).padStart(3, '0')}${USER_DOMAIN}`

// Positions 1–65 are driven by the SCRIPT. Positions 70+ are left free for
// the instructor to drive by hand during the live windows, so a manual Play
// never contends with a scripted one for the single-live-checkin slot.
export const SCRIPTED_POSITIONS = [1, 20, 40]
export const MANUAL_POSITIONS   = [70, 71]

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')

// .env.local is the developer's file; parse it directly rather than adding a
// dotenv dependency for one script.
export function loadEnv() {
  let raw = ''
  try {
    raw = readFileSync(resolve(repoRoot, '.env.local'), 'utf8')
  } catch {
    fail('.env.local not found at the repo root.')
  }
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  const serviceKey = env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_KEY

  if (!url || !anonKey) fail('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env.local.')
  if (!serviceKey) {
    fail([
      'SUPABASE_SERVICE_KEY missing.',
      '',
      'Get one from the Supabase dashboard: Settings -> API -> sb_secret_...',
      'Add it to .env.local as:',
      '',
      '  SUPABASE_SERVICE_KEY=sb_secret_...',
      '',
      'Remove it when the test is done. Legacy service_role JWTs are disabled',
      'on this project, so it must be an sb_secret_ key.',
    ].join('\n'))
  }
  // A legacy JWT starts 'eyJ' — catch it here rather than as a 401 at 11pm.
  if (serviceKey.startsWith('eyJ')) {
    fail('SUPABASE_SERVICE_KEY looks like a legacy service_role JWT, which is disabled on this project. Use the sb_secret_ key.')
  }
  return { url, anonKey, serviceKey }
}

export function fail(msg) {
  console.error(`\n${msg}\n`)
  process.exit(1)
}

// Percentiles from an unsorted array of numbers; null when there is no data,
// so an empty bucket prints as '—' rather than as a misleading 0.
export function pct(values, p) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))])
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Args as --key value / --flag. Small enough not to want a dependency.
export function parseArgs(argv) {
  const out = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { out[key] = next; i++ } else { out[key] = true }
  }
  return out
}
