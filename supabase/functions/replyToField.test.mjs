// Run directly:  node supabase/functions/replyToField.test.mjs
//
// Guards a naming split that fails SILENTLY in the one direction that matters.
//
// The Reply-To field has two spellings on this platform, and which one is
// correct depends on HOW the mail is sent, not on where the code lives:
//
//   Edge Functions  ->  resend.emails.send({ replyTo })   -- the npm SDK
//   api/*.js        ->  POST api.resend.com/emails { reply_to }  -- raw REST
//
// The SDK's parseEmailToApiOptions() builds its outgoing payload by picking
// named keys (`reply_to: email.replyTo`). It does not spread unknown keys. So
// passing snake_case `reply_to` to the SDK is not an error and is not a
// warning: the key is dropped, the send succeeds, and the message simply goes
// out with no Reply-To header. Nothing anywhere surfaces it.
//
// That is exactly what shipped on 2026-08-31 — four Edge Functions deployed,
// versions bumped, bundles verified, and every one of them a no-op. Caught
// only by reading the SDK's own source. The api/ side was correct the whole
// time, because raw REST really does want snake_case, which is what makes the
// mistake so easy: both spellings are right somewhere in this repo.
//
// Both directions are checked. Using camelCase against the REST endpoint fails
// the same silent way.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FUNCTIONS_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT     = join(FUNCTIONS_DIR, '..', '..')
const API_DIR       = join(REPO_ROOT, 'api')

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++ } else {
    fail++
    console.error(`  FAIL: ${name}`)
    if (detail) console.error(`        ${detail}`)
  }
}

function walk(dir, ext) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, ext))
    else if (entry.endsWith(ext)) out.push(full)
  }
  return out
}

const rel = (p) => p.slice(REPO_ROOT.length + 1).split('\\').join('/')

// ── Edge Functions: SDK, so camelCase ──────────────────────────────────────

const edgeFiles = walk(FUNCTIONS_DIR, '.ts')
const sdkSenders = edgeFiles.filter(f => readFileSync(f, 'utf8').includes('resend.emails.send('))

check(
  'found the Edge Function send sites',
  sdkSenders.length > 0,
  'no resend.emails.send( call found — did the send path move?',
)

for (const f of sdkSenders) {
  const src = readFileSync(f, 'utf8')
  check(
    `${rel(f)} sets a reply address`,
    /\breplyTo\s*:/.test(src),
    'no replyTo: found on an SDK send',
  )
  check(
    `${rel(f)} does not use snake_case with the SDK`,
    !/\breply_to\s*:/.test(src),
    'reply_to: is silently dropped by the SDK — use replyTo:',
  )
}

// ── api/: raw REST, so snake_case ──────────────────────────────────────────

const apiFiles = walk(API_DIR, '.js')
const restSenders = apiFiles.filter(f => readFileSync(f, 'utf8').includes('api.resend.com/emails'))

check(
  'found the api/ send sites',
  restSenders.length > 0,
  'no api.resend.com/emails POST found — did the send path move?',
)

for (const f of restSenders) {
  const src = readFileSync(f, 'utf8')
  check(
    `${rel(f)} sets a reply address`,
    /\breply_to\s*:/.test(src),
    'no reply_to: found on a REST send',
  )
  check(
    `${rel(f)} does not use camelCase against REST`,
    !/\breplyTo\s*:/.test(src),
    'replyTo: is ignored by the REST API — use reply_to:',
  )
}

console.log(`Reply-To field naming: ${pass}/${pass + fail} checks passed`)
process.exit(fail === 0 ? 0 : 1)
