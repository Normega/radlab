import { createClient } from '@supabase/supabase-js'
import {
  loadEnv, fail, parseArgs, sleep,
  SCRATCH_SLUG, SCRATCH_NAME, USER_PREFIX, USER_PASSWORD, userEmail,
  SCRIPTED_POSITIONS, MANUAL_POSITIONS,
} from './lib.mjs'

// Build the scratch class and the synthetic cohort. Idempotent: re-running
// tops up missing users and leaves existing ones alone, so a half-finished
// setup can simply be run again.
//
// Check-in shapes are copied from PSY240 L1 so the writes have the same cost:
// the mood/pacing/prompt trio every break uses, and a four-item quiz. Cheap
// synthetic rows would under-measure the thing being tested.

const args = parseArgs(process.argv)
const wanted = Number(args.users ?? 300)
if (!Number.isInteger(wanted) || wanted < 1 || wanted > 1000) {
  fail('--users must be an integer between 1 and 1000.')
}

const { url, serviceKey } = loadEnv()
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const log = (...a) => console.log(...a)

// ── class + lecture ────────────────────────────────────────────────────────

let { data: cls } = await admin.from('classes').select('id, slug').eq('slug', SCRATCH_SLUG).maybeSingle()
if (!cls) {
  const { data, error } = await admin.from('classes')
    .insert({ slug: SCRATCH_SLUG, name: SCRATCH_NAME }).select('id, slug').single()
  if (error) fail(`Could not create the scratch class: ${error.message}`)
  cls = data
  log(`class      created  /${SCRATCH_SLUG}`)
} else {
  log(`class      exists   /${SCRATCH_SLUG}`)
}

let { data: lec } = await admin.from('lectures')
  .select('id, number').eq('class_id', cls.id).eq('number', 1).maybeSingle()
if (!lec) {
  const { data, error } = await admin.from('lectures')
    .insert({ class_id: cls.id, number: 1, title: 'Load test lecture', lecture_date: new Date().toISOString().slice(0, 10) })
    .select('id, number').single()
  if (error) fail(`Could not create the lecture: ${error.message}`)
  lec = data
  log('lecture    created  #1')
} else {
  log('lecture    exists   #1')
}

// ── check-ins ──────────────────────────────────────────────────────────────

const QUIZ_ITEMS = [
  { id: 'lt_q1', text: 'Load test item 1 — pick any option.', options: ['A', 'B', 'C', 'D'] },
  { id: 'lt_q2', text: 'Load test item 2 — pick any option.', options: ['A', 'B', 'C', 'D'] },
  { id: 'lt_q3', text: 'Load test item 3 — pick any option.', options: ['A', 'B', 'C', 'D'] },
  { id: 'lt_q4', text: 'Load test item 4 — pick any option.', options: ['A', 'B', 'C', 'D'] },
]

const trio = (label) => ({
  activities: ['mood', 'pacing', 'prompt'],
  prompt_text: `Load test (${label}) — type anything; this is synthetic.`,
})

const plan = [
  ...SCRIPTED_POSITIONS.map(p => ({ position: p, config: trio(`scripted p${p}`) })),
  { position: 2, config: { activities: ['quiz'], quiz_items: QUIZ_ITEMS } },
  ...MANUAL_POSITIONS.map(p => ({ position: p, config: trio(`manual p${p}`) })),
]

const { data: existing } = await admin.from('checkins')
  .select('id, position').eq('lecture_id', lec.id)
const have = new Set((existing ?? []).map(c => c.position))
const toAdd = plan.filter(p => !have.has(p.position))

if (toAdd.length) {
  const { error } = await admin.from('checkins').insert(
    toAdd.map(p => ({ lecture_id: lec.id, kind: 'live', status: 'planned', position: p.position, config: p.config }))
  )
  if (error) fail(`Could not create check-ins: ${error.message}`)
}
log(`check-ins  ${toAdd.length} created, ${have.size} already present  (scripted ${SCRIPTED_POSITIONS.join(',')} · manual ${MANUAL_POSITIONS.join(',')})`)

// ── users ──────────────────────────────────────────────────────────────────

// listUsers pages at 1000; one page covers any cohort this script allows.
const { data: page, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listErr) fail(`Could not list users: ${listErr.message}`)
const existingEmails = new Set(
  (page?.users ?? []).map(u => (u.email ?? '').toLowerCase()).filter(e => e.startsWith(USER_PREFIX))
)
log(`users      ${existingEmails.size} already exist`)

let created = 0, failed = 0
const ids = new Map() // email -> id, for membership below
for (const u of page?.users ?? []) {
  const e = (u.email ?? '').toLowerCase()
  if (e.startsWith(USER_PREFIX)) ids.set(e, u.id)
}

for (let n = 1; n <= wanted; n++) {
  const email = userEmail(n)
  if (existingEmails.has(email)) continue
  const { data, error } = await admin.auth.admin.createUser({
    email, password: USER_PASSWORD, email_confirm: true,
  })
  if (error) {
    failed++
    if (failed <= 3) console.error(`  create ${email}: ${error.message}`)
  } else {
    created++
    ids.set(email, data.user.id)
  }
  // Creating users is itself a burst of auth writes. Pace it so setup does
  // not become an unmeasured load test of its own, and so a rate limit shows
  // up as slowness rather than as a wall of failures.
  if (n % 25 === 0) { process.stdout.write(`\r           creating… ${created} new`); await sleep(250) }
}
process.stdout.write('\r')
log(`users      ${created} created, ${failed} failed, ${wanted} wanted`)
if (failed) log('           (re-run to top up; creation is idempotent)')

// ── membership ─────────────────────────────────────────────────────────────

const memberIds = []
for (let n = 1; n <= wanted; n++) {
  const id = ids.get(userEmail(n))
  if (id) memberIds.push(id)
}
if (memberIds.length) {
  // onConflict do-nothing: re-running must not duplicate membership.
  const { error } = await admin.from('class_members')
    .upsert(memberIds.map(user_id => ({ class_id: cls.id, user_id })), { onConflict: 'class_id,user_id', ignoreDuplicates: true })
  if (error) fail(`Could not add class members: ${error.message}`)
}
const { count } = await admin.from('class_members')
  .select('user_id', { count: 'exact', head: true }).eq('class_id', cls.id)
log(`members    ${count} in /${SCRATCH_SLUG}`)

log(`\nReady. Next: node scripts/loadtest/run.mjs --levels 25 --hold 120   (smoke test first)`)
