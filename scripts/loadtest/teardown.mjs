import { createClient } from '@supabase/supabase-js'
import { loadEnv, fail, parseArgs, SCRATCH_SLUG, USER_PREFIX } from './lib.mjs'

// Remove everything the load test created, and nothing else.
//
// Two independent scopes, both narrow: rows reachable from the class whose
// slug is exactly SCRATCH_SLUG, and auth users whose email starts with exactly
// USER_PREFIX. A row that fails both tests is never touched, which is what
// keeps a cleanup script pointed at a production database honest.
//
// --dry-run prints the counts and changes nothing. Run it first, every time.

const args = parseArgs(process.argv)
const dry = !!args['dry-run']
const { url, serviceKey } = loadEnv()
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const log = (...a) => console.log(...a)
log(dry ? '\nDRY RUN — nothing will be deleted.\n' : '\nTEARDOWN\n')

// ── what is there ──────────────────────────────────────────────────────────

const { data: cls } = await admin.from('classes').select('id, slug').eq('slug', SCRATCH_SLUG).maybeSingle()
if (!cls) log(`class      /${SCRATCH_SLUG} not present`)

let lectureIds = [], checkinIds = []
if (cls) {
  const { data: lecs } = await admin.from('lectures').select('id').eq('class_id', cls.id)
  lectureIds = (lecs ?? []).map(l => l.id)
  if (lectureIds.length) {
    const { data: cis } = await admin.from('checkins').select('id').in('lecture_id', lectureIds)
    checkinIds = (cis ?? []).map(c => c.id)
  }
}

const countIn = async (table, col, ids) => {
  if (!ids.length) return 0
  const { count } = await admin.from(table).select(col, { count: 'exact', head: true }).in(col, ids)
  return count ?? 0
}
const responses = await countIn('checkin_responses', 'checkin_id', checkinIds)
const questions = await countIn('class_questions', 'checkin_id', checkinIds)
const members = cls
  ? (await admin.from('class_members').select('user_id', { count: 'exact', head: true }).eq('class_id', cls.id)).count ?? 0
  : 0

const { data: page, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listErr) fail(`Could not list users: ${listErr.message}`)
const synthetic = (page?.users ?? []).filter(u => (u.email ?? '').toLowerCase().startsWith(USER_PREFIX))

log(`class      ${cls ? 1 : 0}`)
log(`lectures   ${lectureIds.length}`)
log(`check-ins  ${checkinIds.length}`)
log(`responses  ${responses}`)
log(`questions  ${questions}`)
log(`members    ${members}`)
log(`users      ${synthetic.length}  (email starts with "${USER_PREFIX}")`)

// A refusal rather than a guess: if the cohort is implausibly large, something
// other than this script created those users and deleting them is not this
// script's call.
if (synthetic.length > 1000) fail(`\n${synthetic.length} users match the prefix — more than this script ever creates. Refusing to delete; inspect by hand.`)

if (dry) { log('\nNothing deleted. Re-run without --dry-run to apply.\n'); process.exit(0) }

// ── delete, children first ─────────────────────────────────────────────────

const del = async (table, col, ids, label) => {
  if (!ids.length) return
  const { error } = await admin.from(table).delete().in(col, ids)
  log(error ? `  ${label}: FAILED ${error.message}` : `  ${label}: deleted`)
}

log('\ndeleting…')
await del('checkin_responses', 'checkin_id', checkinIds, 'responses')
await del('class_questions', 'checkin_id', checkinIds, 'questions')
await del('checkins', 'id', checkinIds, 'check-ins')
await del('lectures', 'id', lectureIds, 'lectures')
if (cls) {
  await admin.from('class_members').delete().eq('class_id', cls.id)
  log('  members: deleted')
  await admin.from('classes').delete().eq('id', cls.id)
  log('  class: deleted')
}

let removed = 0, failed = 0
for (const u of synthetic) {
  const { error } = await admin.auth.admin.deleteUser(u.id)
  if (error) { failed++; if (failed <= 3) console.error(`  delete ${u.email}: ${error.message}`) } else removed++
  if (removed % 50 === 0) process.stdout.write(`\r  users: ${removed} removed`)
}
process.stdout.write('\r')
log(`  users: ${removed} removed, ${failed} failed`)

// ── verify ─────────────────────────────────────────────────────────────────

const { data: clsAfter } = await admin.from('classes').select('id').eq('slug', SCRATCH_SLUG).maybeSingle()
const { data: pageAfter } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
const leftover = (pageAfter?.users ?? []).filter(u => (u.email ?? '').toLowerCase().startsWith(USER_PREFIX)).length

log('\nafter:')
log(`class      ${clsAfter ? 1 : 0}`)
log(`users      ${leftover}`)
log(clsAfter || leftover ? '\nSomething remains — re-run to finish.\n' : '\nClean.\n')
