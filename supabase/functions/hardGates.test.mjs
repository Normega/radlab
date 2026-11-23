// Run directly:  node supabase/functions/hardGates.test.mjs
//
// Regression guard for the hard-gate rule (CLAUDE.md "Hard gates";
// supabase/migrations/20261007_hard_gates.sql).
//
// Whether a session may reach a participant -- screened out, no consent,
// baseline or midpoint not done, enrollment full, withdrawn -- is decided in ONE
// place, the database function schedule_row_block_reason(). Until 2026-10-07
// each gate lived in whichever code happened to be sending, and every path
// that forgot one leaked: screened-out students were emailed daily study links,
// unconsented sign-ups were scheduled into Phase 1, and 27 people started the
// intervention with no baseline. This test fails CI if a path that emails or
// opens a session stops asking.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { sep, join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}${detail ? ' -- ' + detail : ''}`) }
}

// 1. Every Edge Function that puts a session link (/s/<token>) in an email asks
//    the gate before it issues the link. Found by scanning, so a new sender is
//    covered the day it is written.
const fnDir = join(ROOT, 'supabase', 'functions')
const senders = []
for (const name of readdirSync(fnDir, { withFileTypes: true })) {
  if (!name.isDirectory() || name.name.startsWith('_')) continue
  const file = join('supabase', 'functions', name.name, 'index.ts')
  if (!existsSync(join(ROOT, file))) continue
  const src = read(file)
  if (!/\/s\/\$\{/.test(src)) continue
  senders.push(file.split(sep).join('/'))   // forward slashes on Windows too
  const gate = src.indexOf("rpc('schedule_row_block_reason'")
  const linkBuilt = src.search(/\/s\/\$\{/)
  check(`${file} asks schedule_row_block_reason`, gate !== -1)
  check(`${file} asks the gate before building the emailed link`, gate !== -1 && gate < linkBuilt,
    `gate at ${gate}, link built at ${linkBuilt}`)
}

// 1b. send_message, the scheduler's sender, asks before it even mints a link:
//     a refused participant must not be left holding a live one.
{
  const src = read('supabase/functions/send_message/index.ts')
  const gate = src.indexOf("rpc('schedule_row_block_reason'")
  const issue = src.indexOf('issueLink(')
  check('send_message asks the gate before issueLink', gate !== -1 && issue !== -1 && gate < issue)
}
// 1c. auto-enroll's multi-session path (20261123_sf2b_retest_session.sql, the
//     Sense Foraging 2b retest) hands back a session link without emailing it,
//     so the /s/ scan above cannot see it. It asks the gate before issueLink,
//     like send_message, and fails closed if the check errors.
{
  const src = read('supabase/functions/auto-enroll/index.ts')
  const start = src.indexOf('if ((allSessions ?? []).length > 1)')
  const block = start === -1 ? '' : src.slice(start, src.indexOf('// 6b. Legacy single-shot path', start))
  const gate = block.indexOf("rpc('schedule_row_block_reason'")
  const issue = block.indexOf('issueLink(')
  check('auto-enroll has its multi-session path', start !== -1 && block.length > 0)
  check('auto-enroll multi-session path asks the gate before issueLink', gate !== -1 && issue !== -1 && gate < issue,
    `gate at ${gate}, issueLink at ${issue}`)
  check('auto-enroll multi-session path fails closed on a gate error',
    /if \(gateErr\) \{[\s\S]{0,200}return json\(/.test(block))
  check('auto-enroll multi-session path refuses on a block reason before any link',
    /if \(blockReason\) \{[\s\S]{0,800}return json\(/.test(block) && block.indexOf('if (blockReason)') < issue)
}
// 1d. create_anonymous_participant (the RA's "Generate link") hands the token back instead of
//     emailing it, so the /s/ scan cannot see it either. It asks before it inserts the link.
{
  const src = read('supabase/functions/create_anonymous_participant/index.ts')
  const gate = src.indexOf("rpc('schedule_row_block_reason'")
  const link = src.indexOf(".from('participant_links')")
  check('create_anonymous_participant asks the gate before inserting the link', gate !== -1 && link !== -1 && gate < link,
    `gate at ${gate}, link insert at ${link}`)
  check('create_anonymous_participant fails closed on a gate error or a block reason',
    /if \(gateErr \|\| blockReason\) \{[\s\S]{0,400}return /.test(src))
}
check('the scan found the session-link senders', senders.includes('supabase/functions/send_message/index.ts'),
  senders.join(', '))

// 2. send_message refuses, rather than sends, when the gate check itself fails.
{
  const src = read('supabase/functions/send_message/index.ts')
  check('send_message fails closed on a gate error', /if \(gateErr\) return json\(/.test(src))
}

// 3. SessionEntry asks session_entry_block before the screener, the consent
//    form or any step can render, and fails closed.
{
  const src = read('src/pages/SessionEntry.jsx')
  const gate = src.indexOf("rpc('session_entry_block'")
  check('SessionEntry asks session_entry_block', gate !== -1)
  for (const later of ["setState('needs_screener')", "setState('needs_consent')", "setState('running')"]) {
    const at = src.indexOf(later)
    check(`SessionEntry gates before ${later}`, gate !== -1 && at !== -1 && gate < at, `gate ${gate}, ${later} ${at}`)
  }
  check('SessionEntry fails closed on a gate error', /if \(gateErr\) \{ setState\('gate_error'\)/.test(src))
}

// 4. The decision itself still covers every gate. Read from the newest
//    migration that (re)defines it, so a later redefinition is what is checked.
{
  const migDir = join(ROOT, 'supabase', 'migrations')
  const defs = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
    .filter((f) => /FUNCTION public\.schedule_row_block_reason/.test(read(join('supabase', 'migrations', f))))
  check('a migration defines schedule_row_block_reason', defs.length > 0)
  if (defs.length > 0) {
    const sql = read(join('supabase', 'migrations', defs[defs.length - 1]))
    for (const reason of ['study_inactive', 'withdrawn', 'screened_out', 'no_consent', 'enrollment_full', 'gate_incomplete']) {
      check(`schedule_row_block_reason returns '${reason}'`, sql.includes(`RETURN '${reason}'`))
    }
    check('schedule_row_block_reason is not callable by participants',
      /REVOKE ALL ON FUNCTION public\.schedule_row_block_reason\(uuid\) FROM PUBLIC, anon, authenticated/.test(sql))
  }
}

console.log(`# hard gates: ${pass}/${pass + fail} checks passed`)
if (fail) process.exit(1)
