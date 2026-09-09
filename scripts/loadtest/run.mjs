import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  loadEnv, fail, parseArgs, pct, sleep,
  SCRATCH_SLUG, SCRIPTED_POSITIONS, MANUAL_POSITIONS,
} from './lib.mjs'

// The ramp. Steps the cohort up through concurrency levels, runs a check-in
// open + response burst at each, and prints one row per level so the knee is
// visible as it happens rather than only in the analysis.
//
// The point is NOT pass/fail. It is the shape of the curve: latency that stays
// flat to 300 means real headroom; latency that bends at 120 tells you the
// size to buy and why. Watch p95 write and p95 fan-out — those are the two
// numbers a room actually feels.

const args = parseArgs(process.argv)
const levels = String(args.levels ?? '25,50,100,150,200,250,300').split(',').map(n => Number(n.trim()))
const holdSec = Number(args.hold ?? 480)
const perWorker = Number(args['per-worker'] ?? 50)
const liveWindow = args['no-live'] ? 0 : Number(args['live'] ?? 60)
if (levels.some(n => !Number.isInteger(n) || n < 1)) fail('--levels must be a comma-separated list of integers.')

const here = dirname(fileURLToPath(import.meta.url))
const { url, anonKey, serviceKey } = loadEnv()
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

// ── scratch class ──────────────────────────────────────────────────────────

const { data: cls } = await admin.from('classes').select('id').eq('slug', SCRATCH_SLUG).maybeSingle()
if (!cls) fail(`No /${SCRATCH_SLUG} class. Run setup.mjs first.`)
const { data: lec } = await admin.from('lectures').select('id').eq('class_id', cls.id).eq('number', 1).maybeSingle()
if (!lec) fail('No lecture #1 on the scratch class. Run setup.mjs first.')
const { data: checkins } = await admin.from('checkins').select('id, position').eq('lecture_id', lec.id)
const byPos = new Map((checkins ?? []).map(c => [c.position, c.id]))
for (const p of SCRIPTED_POSITIONS) if (!byPos.has(p)) fail(`Missing scripted check-in at position ${p}. Re-run setup.mjs.`)

const { count: cohort } = await admin.from('class_members')
  .select('user_id', { count: 'exact', head: true }).eq('class_id', cls.id)
const peak = Math.max(...levels)
if ((cohort ?? 0) < peak) fail(`Only ${cohort} synthetic members exist but --levels peaks at ${peak}. Run: node scripts/loadtest/setup.mjs --users ${peak}`)

console.log(`\nLoad test · /${SCRATCH_SLUG} · levels ${levels.join(' → ')} · ${holdSec}s hold · ${liveWindow}s live window`)
console.log(`cohort ${cohort} synthetic members · ${Math.ceil(peak / perWorker)} worker processes\n`)

// ── workers ────────────────────────────────────────────────────────────────

const workerCount = Math.ceil(peak / perWorker)
const workers = []
for (let w = 0; w < workerCount; w++) {
  const child = fork(resolve(here, 'worker.mjs'), { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
  child.__live = 0
  workers.push(child)
  child.send({ type: 'config', cfg: { url, anonKey, classId: cls.id, lectureId: lec.id, from: w * perWorker, count: perWorker } })
}
await Promise.all(workers.map(w => new Promise(r => w.once('message', r))))

const collect = () => Promise.all(workers.map(w => new Promise(resolveOne => {
  const onMsg = (m) => { if (m.type === 'metrics') { w.off('message', onMsg); resolveOne(m) } }
  w.on('message', onMsg)
  w.send({ type: 'report' })
})))

const rampTo = async (target) => {
  const per = Math.ceil(target / workerCount)
  await Promise.all(workers.map((w, i) => new Promise(resolveOne => {
    const want = Math.max(0, Math.min(per, target - i * per))
    const add = want - w.__live
    if (add <= 0) return resolveOne()
    w.__live = want
    const onMsg = (m) => { if (m.type === 'added') { w.off('message', onMsg); resolveOne() } }
    w.on('message', onMsg)
    w.send({ type: 'add', count: add })
  })))
}

let aborted = false
const shutdown = async () => {
  if (aborted) return
  aborted = true
  console.log('\n\nStopping — closing the open check-in and disconnecting clients…')
  for (const p of SCRIPTED_POSITIONS) {
    await admin.from('checkins').update({ status: 'planned', opened_at: null, closed_at: null }).eq('id', byPos.get(p))
  }
  for (const w of workers) { try { w.send({ type: 'stop' }) } catch { /* already gone */ } }
  await sleep(1500)
  console.log('Stopped. Rows remain until you run teardown.mjs.\n')
  process.exit(0)
}
process.on('SIGINT', shutdown)

// ── the ramp ───────────────────────────────────────────────────────────────

const header = ['level', 'live', 'signin p95', 'fanout p50', 'fanout p95', 'write p50', 'write p95', 'poll p95', 'errors', 'client lag']
console.log(header.map((h, i) => h.padEnd(i === 0 ? 6 : 11)).join(''))
console.log('-'.repeat(108))

const results = []
for (const [idx, level] of levels.entries()) {
  if (aborted) break
  await rampTo(level)
  await sleep(8000)                 // let subscriptions settle before measuring
  await collect()                   // drain sign-in noise from the burst window

  // Open a scripted check-in, let the room answer, then close it. Rotating
  // positions keeps each level's burst on a check-in with no stale responses.
  const pos = SCRIPTED_POSITIONS[idx % SCRIPTED_POSITIONS.length]
  const checkinId = byPos.get(pos)
  const at = Date.now()
  for (const w of workers) w.send({ type: 'opened', checkinId, at })
  const { error: openErr } = await admin.from('checkins')
    .update({ status: 'open', opened_at: new Date().toISOString() }).eq('id', checkinId)
  if (openErr) console.error(`  open failed: ${openErr.message}`)

  await sleep(holdSec * 1000)

  await admin.from('checkins').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', checkinId)
  const m = await collect()

  const merge = (k) => m.flatMap(x => x.samples[k])
  const errs = {}
  for (const x of m) for (const [k, v] of Object.entries(x.errors)) errs[k] = (errs[k] ?? 0) + v
  const errTotal = Object.values(errs).reduce((a, b) => a + b, 0)
  const lag = Math.max(...m.map(x => x.lagMax))
  const live = m.reduce((a, x) => a + x.live, 0)

  const row = {
    level, live,
    signin95: pct(merge('signin'), 95),
    fanout50: pct(merge('fanout'), 50),
    fanout95: pct(merge('fanout'), 95),
    write50: pct(merge('write'), 50),
    write95: pct(merge('write'), 95),
    poll95: pct(merge('poll'), 95),
    errors: errTotal, lag, errDetail: errs,
  }
  results.push(row)

  const cell = (v, unit = 'ms') => (v == null ? '—' : `${v}${unit}`)
  console.log([
    String(level).padEnd(6),
    String(live).padEnd(11),
    cell(row.signin95).padEnd(11),
    cell(row.fanout50).padEnd(11),
    cell(row.fanout95).padEnd(11),
    cell(row.write50).padEnd(11),
    cell(row.write95).padEnd(11),
    cell(row.poll95).padEnd(11),
    String(errTotal).padEnd(11),
    `${lag}ms${lag > 50 ? ' ⚠' : ''}`,
  ].join(''))
  if (errTotal) {
    for (const [k, v] of Object.entries(errs).slice(0, 3)) console.log(`        ${v}× ${k}`)
  }

  // Reset so the next level starts from an empty check-in.
  await admin.rpc('reset_checkin', { p_checkin_id: checkinId }).catch(() => {})
  await admin.from('checkins').update({ status: 'planned', opened_at: null, closed_at: null }).eq('id', checkinId)

  if (liveWindow && idx < levels.length - 1) {
    console.log(`\n  ▸ LIVE WINDOW ${liveWindow}s at ${level} students — drive the console yourself now.`)
    console.log(`    radlab.zone/academic/${SCRATCH_SLUG}/lounge/console  ·  use positions ${MANUAL_POSITIONS.join(' or ')}`)
    console.log('    (the script is idle; how it FEELS here is the observation)\n')
    await sleep(liveWindow * 1000)
  }
}

// ── summary ────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(108))
const clientBound = results.filter(r => r.lag > 50)
if (clientBound.length) {
  console.log(`⚠  CLIENT-BOUND at ${clientBound.map(r => r.level).join(', ')} — event-loop lag over 50ms.`)
  console.log('   Those rows measure this machine, not the server. Re-run with a smaller --per-worker.\n')
}

// The knee: first level where p95 write more than doubles the best earlier one.
const best = Math.min(...results.map(r => r.write95 ?? Infinity))
const knee = results.find(r => (r.write95 ?? 0) > best * 2 && r.write95 != null)
if (knee) {
  console.log(`Knee at ~${knee.level} concurrent: p95 write ${knee.write95}ms against a floor of ${best}ms.`)
  console.log(`Headroom for a ${peak}-student lecture is ${knee.level > 220 ? 'adequate' : 'NOT adequate'} at this compute size.`)
} else {
  console.log(`No knee found through ${Math.max(...levels)} concurrent — p95 write stayed within 2× of its ${best}ms floor.`)
  console.log('This compute size holds the tested range. Confirm the soak separately: watch the CPU-credit slope.')
}
console.log('\nNow check the dashboard: Reports → Database → CPU, and the burst-credit slope at the top level.')
console.log('Then clean up:  node scripts/loadtest/teardown.mjs\n')

for (const w of workers) { try { w.send({ type: 'stop' }) } catch { /* already gone */ } }
await sleep(1500)
process.exit(0)
