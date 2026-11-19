// The database store against a fake supabase-js client: rows built from the column lists, every insert's error
// read, retries with backoff, duplicates treated as saved, permanent failures surfaced at once, flush().
// Run: node --test src/games/BcatThreshold/dbStore.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createDatabaseStore, toRow, classify, COLUMNS, TABLES, StoreError } from './dbStore.js'
import { makeRunRecord, makeTrialRecord, makeResultRecord } from './records.js'
import { makeConfig } from './config.js'
import { practiceTrials } from './trialPlan.js'

const CTX = { userId: 'u-1', studyId: 's-1', scheduleId: 'p-1' }

/** A fake client: `script(table, row, n)` returns the { error } of the n-th insert into that table (or throws). */
export function fakeDb(script = () => ({ error: null })) {
  const inserts = []
  const counts = {}
  return {
    inserts,
    from(table) {
      return {
        insert(row) {
          counts[table] = (counts[table] || 0) + 1
          inserts.push({ table, row: structuredClone(row) })
          return Promise.resolve().then(() => script(table, row, counts[table]))
        },
      }
    },
  }
}
const noSleep = async () => {}

function records() {
  const cfg = makeConfig({ demo: true })
  const run = makeRunRecord({ id: 'run-1', arm: 'touch', cfg, seed: 7, kind: 'study', plannedTrials: 9 })
  const spec = practiceTrials(cfg)[0]
  const pres = { t_end: 9000, planned_boundaries_ms: [0], delivered_boundaries_ms: [0], boundary_error_ms: [0], delivered_pulses_ms: [] }
  const trial = seq => makeTrialRecord({ runId: 'run-1', seq, phase: 'practice', spec, pres, answer: { response: 'same', key: 'ArrowUp', rtMs: 500, questionOnsetMs: 9000 },
    interrupted: false, focusEvents: [], keys: { events: [], repeats: 0, blurs: 0, summary: null }, tStartMs: 0, practiceSet: 1 })
  const result = makeResultRecord({ runId: 'run-1', trials: [trial(1)], readout: null, status: 'practice_failed', session: { practice: { completed: false, passed: false, sets_used: 3 } } })
  return { run, trial, result }
}

test('rows: today\'s records map onto the draft\'s columns with nothing left over in extra', () => {
  const { run, trial, result } = records()
  for (const [table, rec] of [[TABLES.runs, run], [TABLES.trials, trial(1)], [TABLES.results, result]]) {
    const { row, extraKeys } = toRow(table, rec, CTX)
    assert.deepStrictEqual(extraKeys, [], `${table}: every record field has a column (${extraKeys.join(', ')})`)
    assert.deepStrictEqual([row.user_id, row.study_id, row.schedule_id], ['u-1', 's-1', 'p-1'])
    assert.equal('is_test' in row, false, 'is_test is the enrollment\'s, set by the database')
    assert.deepStrictEqual(Object.keys(row).sort(), [...COLUMNS[table], 'user_id', 'study_id', 'schedule_id', 'extra'].sort(), 'an explicit column list')
  }
})

test('rows: an unknown field goes to extra, never to the insert; identity in a record is refused', () => {
  const { row, extraKeys } = toRow(TABLES.trials, { run_id: 'r', seq: 1, brand_new_fact: 3 }, CTX)
  assert.deepStrictEqual(extraKeys, ['brand_new_fact'])
  assert.deepStrictEqual(row.extra, { brand_new_fact: 3 })
  assert.equal('brand_new_fact' in row, false)
  assert.throws(() => toRow(TABLES.runs, { id: 'r', is_test: true }, CTX), /is_test/)
  assert.throws(() => toRow(TABLES.runs, { id: 'r', user_id: 'x' }, CTX), /user_id/)
})

test('the column lists match the migration draft (when the draft is reachable)', () => {
  let sql
  try { sql = readFileSync('I:/Shared drives/Interoception 2025/NextStudy/Thresholds/7_radlab_site_plan/stage_c_migration_draft/20261112_bcat_threshold_tables.sql', 'utf8') } catch { return }
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const body = sql.slice(sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`))
    const block = body.slice(0, body.indexOf('\n);'))
    for (const c of [...cols, 'user_id', 'study_id', 'schedule_id', 'extra']) assert.match(block, new RegExp(`\\n  ${c}\\s`), `${table}.${c} in the draft`)
  }
})

test('classify: duplicates of this row are saved; other duplicates, missing tables and RLS are not retried', () => {
  const dup = name => ({ code: '23505', message: `duplicate key value violates unique constraint "${name}"` })
  assert.equal(classify(TABLES.trials, dup('bcat_threshold_trials_run_id_seq_key')), 'saved')
  assert.equal(classify(TABLES.runs, dup('bcat_threshold_runs_pkey')), 'saved')
  assert.equal(classify(TABLES.runs, dup('bcat_threshold_runs_resumed_from_key')), 'conflict', 'a second tab resuming the same run')
  assert.equal(classify(TABLES.results, dup('bcat_threshold_results_root_run_id_key')), 'conflict')
  assert.equal(classify(TABLES.results, dup('bcat_threshold_results_run_id_key')), 'saved')
  assert.equal(classify(TABLES.runs, { code: 'PGRST205', message: "Could not find the table 'public.bcat_threshold_runs' in the schema cache" }), 'missing')
  assert.equal(classify(TABLES.runs, { code: '42P01' }), 'missing')
  assert.equal(classify(TABLES.runs, { code: '', message: 'TypeError: Failed to fetch' }), 'transient')
  assert.equal(classify(TABLES.runs, { code: '57014' }), 'transient')
  assert.equal(classify(TABLES.runs, { code: '42501' }), 'permanent')
  assert.equal(classify(TABLES.runs, { code: '23514', message: 'no enrollment' }), 'permanent')
})

test('insert success: run then trials then result, each saved once; flush reports nothing unsaved', async () => {
  const db = fakeDb()
  const s = createDatabaseStore({ db, ...CTX, sleep: noSleep })
  const { run, trial, result } = records()
  await s.saveRun(run)
  await s.saveTrial(trial(1)); await s.saveTrial(trial(2))
  await s.saveResult(result)
  assert.deepStrictEqual(await s.flush(), { unsaved: 0, failed: 0, problem: null })
  assert.deepStrictEqual(db.inserts.map(i => i.table), [TABLES.runs, TABLES.trials, TABLES.trials, TABLES.results])
})

test('a trial before its run is saved is refused; the run must be stored before anything else', async () => {
  const s = createDatabaseStore({ db: fakeDb(), ...CTX, sleep: noSleep })
  await assert.rejects(s.saveTrial(records().trial(1)), StoreError)
})

test('network failure: retried with growing backoff until it lands', async () => {
  const waits = []
  const db = fakeDb((table, row, n) => (table === TABLES.trials && n <= 2 ? { error: { message: 'Failed to fetch', code: '' } } : { error: null }))
  const s = createDatabaseStore({ db, ...CTX, sleep: async ms => { waits.push(ms) }, retry: { attempts: 5, baseMs: 100, maxMs: 1000 } })
  const { run, trial } = records()
  await s.saveRun(run)
  await s.saveTrial(trial(1))
  assert.deepStrictEqual(await s.flush(), { unsaved: 0, failed: 0, problem: null })
  assert.deepStrictEqual(waits, [100, 200])
  assert.equal(db.inserts.filter(i => i.table === TABLES.trials).length, 3)
})

test('a thrown fetch counts as a network failure too', async () => {
  const db = fakeDb((table, row, n) => { if (table === TABLES.runs && n === 1) throw new Error('offline'); return { error: null } })
  const s = createDatabaseStore({ db, ...CTX, sleep: noSleep })
  assert.deepStrictEqual(await s.saveRun(records().run), { id: 'run-1' })
})

test('a retried insert that had landed (23505 on run_id, seq) is treated as saved, not as a failure', async () => {
  const dup = { code: '23505', message: 'duplicate key value violates unique constraint "bcat_threshold_trials_run_id_seq_key"' }
  const db = fakeDb((table, row, n) => (table === TABLES.trials ? (n === 1 ? { error: { code: '', message: 'timeout' } } : { error: dup }) : { error: null }))
  const s = createDatabaseStore({ db, ...CTX, sleep: noSleep })
  const { run, trial } = records()
  await s.saveRun(run)
  await s.saveTrial(trial(1))
  assert.deepStrictEqual(await s.flush(), { unsaved: 0, failed: 0, problem: null })
})

test('retries used up: the row stays queued, the store says it is stalled, and flush sends it again', async () => {
  let down = true
  const db = fakeDb(table => (table === TABLES.trials && down ? { error: { code: '', message: 'offline' } } : { error: null }))
  const s = createDatabaseStore({ db, ...CTX, sleep: noSleep, retry: { attempts: 2 } })
  const { run, trial } = records()
  await s.saveRun(run)
  await s.saveTrial(trial(1))
  const first = await s.flush()
  assert.equal(first.unsaved, 1, 'not saved, and the step must not say it is done')
  assert.equal(s.stalled, true)
  down = false
  assert.deepStrictEqual(await s.flush(), { unsaved: 0, failed: 0, problem: null })
  assert.equal(s.stalled, false)
})

test('a permanent failure is surfaced at once as the store\'s problem and never retried', async () => {
  const db = fakeDb(table => (table === TABLES.trials ? { error: { code: '42501', message: 'new row violates row-level security policy' } } : { error: null }))
  const s = createDatabaseStore({ db, ...CTX, sleep: noSleep })
  const { run, trial } = records()
  await s.saveRun(run)
  await s.saveTrial(trial(1))
  await new Promise(r => setTimeout(r, 0))
  assert.ok(s.problem instanceof StoreError)
  assert.equal(s.problem.kind, 'permanent')
  const f = await s.flush()
  assert.equal(f.unsaved, 1)
  assert.equal(f.failed, 1)
  assert.equal(db.inserts.filter(i => i.table === TABLES.trials).length, 1, 'not retried')
})

test('tables missing (migration not applied): the run insert fails closed with kind missing', async () => {
  const db = fakeDb(() => ({ error: { code: 'PGRST205', message: "Could not find the table 'public.bcat_threshold_runs' in the schema cache" } }))
  const s = createDatabaseStore({ db, ...CTX, sleep: noSleep })
  await assert.rejects(s.saveRun(records().run), e => e instanceof StoreError && e.kind === 'missing')
})

test('no enrollment: the database refuses the run (23514) and the store does not retry it', async () => {
  const db = fakeDb(() => ({ error: { code: '23514', message: 'bcat_threshold_runs: no enrollment for this account in study s-1' } }))
  const s = createDatabaseStore({ db, ...CTX, sleep: noSleep })
  await assert.rejects(s.saveRun(records().run), e => e.kind === 'permanent')
  assert.equal(db.inserts.length, 1)
})

test('the store needs a client, a user, a study and a schedule', () => {
  assert.throws(() => createDatabaseStore({ db: null, ...CTX }), StoreError)
  assert.throws(() => createDatabaseStore({ db: fakeDb(), ...CTX, scheduleId: null }), /scheduleId/)
})

test('every insert in dbStore.js reads its error (the rule responseInsertsChecked.test.mjs enforces)', () => {
  const text = readFileSync(new URL('./dbStore.js', import.meta.url), 'utf8')
  const inserts = [...text.matchAll(/\.from\('(bcat_threshold_\w+)'\)\.insert\(/g)]
  assert.equal(inserts.length, 3, 'one literal insert per table')
  for (const m of inserts) {
    const lead = text.slice(Math.max(0, m.index - 120), m.index)
    assert.match(lead, /const \{ error \} = await db\s*$/, `${m[1]}: destructures error`)
  }
})

test('pickStore: previews and simulated runs use the memory store and write nothing; a real study step needs the database', async () => {
  const { pickStore } = await import('./dbStore.js')
  const db = fakeDb()
  const ctx = { userId: 'u', studyId: 's', scheduleId: 'p', enrollmentId: 'e', db }
  assert.equal(pickStore({ studyMode: false, ...ctx }).kind, 'memory')
  assert.equal(pickStore({ studyMode: true, isSimMode: true, ...ctx }).kind, 'memory', 'the admin runner\'s simulation')
  assert.equal(pickStore({ studyMode: true, simulate: true, ...ctx }).kind, 'memory', 'a simulated observer')
  for (const kind of ['memory']) {
    const { store } = pickStore({ studyMode: true, isSimMode: true, ...ctx })
    await store.saveRun({ id: 'r' }); await store.saveTrial({ run_id: 'r', seq: 1 }); await store.saveResult({ run_id: 'r' })
    assert.equal(db.inserts.length, 0, `${kind}: nothing reached the database`)
  }
  assert.equal(pickStore({ studyMode: true, ...ctx }).kind, 'database')
  assert.deepStrictEqual(pickStore({ studyMode: true, ...ctx, enrollmentId: null }), { error: 'no_enrollment' }, 'no enrollment: the run is refused')
  assert.deepStrictEqual(pickStore({ studyMode: true, ...ctx, db: null }), { error: 'no_database' }, 'a study step never runs on the memory store')
  assert.deepStrictEqual(pickStore({ studyMode: true, ...ctx, scheduleId: null }), { error: 'no_context' })
})
