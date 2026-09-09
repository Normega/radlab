import { createClient } from '@supabase/supabase-js'
import { userEmail, USER_PASSWORD, sleep } from './lib.mjs'

// One worker process runs a slice of the cohort. Sliced across processes
// because 300 websockets is an event-loop problem, not a CPU or RAM one: a
// single Node process serves them all from one thread, and once that thread
// saturates its queuing delay is indistinguishable from server latency in the
// numbers. Each worker therefore reports its own loop lag so a client-bound
// run can be thrown out rather than believed.

const cfg = { url: null, anonKey: null, classId: null, lectureId: null, from: 0, count: 0 }
const students = []           // { client, channel, id }
const samples = { signin: [], write: [], poll: [], fanout: [] }
const errors = new Map()
let opened = null             // { checkinId, at } — the current scripted open
const responded = new Set()   // checkin ids this worker has already answered

const note = (e) => {
  const key = String(e?.message ?? e).slice(0, 80)
  errors.set(key, (errors.get(key) ?? 0) + 1)
}

// ── event-loop lag ─────────────────────────────────────────────────────────
let lagMax = 0
{
  const every = 200
  let last = Date.now()
  setInterval(() => {
    const now = Date.now()
    lagMax = Math.max(lagMax, now - last - every)
    last = now
  }, every).unref()
}

// ── one simulated student ──────────────────────────────────────────────────

async function addStudent(n) {
  const client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  const t0 = Date.now()
  const { data, error } = await client.auth.signInWithPassword({
    email: userEmail(n), password: USER_PASSWORD,
  })
  if (error) { note(error); return null }
  samples.signin.push(Date.now() - t0)

  // The same subscription a student's browser holds: status changes on this
  // lecture's check-ins. REPLICA IDENTITY FULL means each of these events is
  // authorized per subscriber, which is the cost this test exists to find.
  const channel = client
    .channel(`lt-checkins-${n}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'checkins', filter: `lecture_id=eq.${cfg.lectureId}` },
      (payload) => {
        const row = payload?.new
        if (!row || row.status !== 'open') return
        if (opened && row.id === opened.checkinId) samples.fanout.push(Date.now() - opened.at)
        respond(client, row).catch(note)
      })
    .subscribe()

  const s = { client, channel, id: data.user.id, n }
  students.push(s)
  return s
}

// A student answering: a jittered human delay, then the same upsert the app
// does, then the points RPC. Jitter matters — 300 simultaneous identical
// writes is not what a room does, and would measure a thundering herd that
// never happens.
async function respond(client, row) {
  if (responded.has(row.id)) return
  responded.add(row.id)
  await sleep(3000 + Math.random() * 25000)

  const activities = row?.config?.activities ?? []
  const payload = { checkin_id: row.id, profile_id: null, updated_at: new Date().toISOString() }
  const { data: u } = await client.auth.getUser()
  payload.profile_id = u?.user?.id
  if (!payload.profile_id) return

  if (activities.includes('mood')) {
    // Scatter across wedges and rings — a centre cluster is what a missing
    // emotion_id looks like, and it also under-measures the payload size.
    payload.mood = {
      emotion_id: `e${1 + Math.floor(Math.random() * 24)}`,
      zone: ['high-pleasant', 'high-unpleasant', 'low-pleasant', 'low-unpleasant'][Math.floor(Math.random() * 4)],
      ring: 1 + Math.floor(Math.random() * 3),
    }
  }
  if (activities.includes('pacing')) payload.pacing = 1 + Math.floor(Math.random() * 3)
  if (activities.includes('prompt')) {
    payload.prompt_response = `Synthetic load-test response ${Math.random().toString(36).slice(2, 10)}. ` +
      'Padding to roughly the length a real student types in a break check-in so the write is not artificially cheap.'
  }
  if (activities.includes('quiz')) {
    payload.quiz_answers = Object.fromEntries(
      (row?.config?.quiz_items ?? []).map(it => [it.id, Math.floor(Math.random() * 4)]))
  }

  const t0 = Date.now()
  const { error } = await client.from('checkin_responses')
    .upsert(payload, { onConflict: 'checkin_id,profile_id' })
  samples.write.push(Date.now() - t0)
  if (error) { note(error); return }
  const { error: pErr } = await client.rpc('award_checkin_points', { p_checkin_id: row.id })
  if (pErr) note(pErr)
}

// The 20-second DB-authoritative backstop every ClassRoom holds, which is a
// real and constant part of lecture load.
setInterval(async () => {
  const s = students[Math.floor(Math.random() * students.length)]
  if (!s) return
  const t0 = Date.now()
  const { error } = await s.client.from('checkins')
    .select('id, status, config, position')
    .eq('lecture_id', cfg.lectureId).neq('status', 'planned').limit(5)
  samples.poll.push(Date.now() - t0)
  if (error) note(error)
}, Math.max(200, 20000 / Math.max(1, cfg.count))).unref()

// ── parent protocol ────────────────────────────────────────────────────────

process.on('message', async (msg) => {
  if (msg.type === 'config') {
    Object.assign(cfg, msg.cfg)
    process.send({ type: 'ready' })
  }
  if (msg.type === 'add') {
    // Stagger sign-ins: 300 at once trips auth rate limits and is not how a
    // room arrives anyway.
    for (let i = 0; i < msg.count; i++) {
      const n = cfg.from + students.length + 1
      await addStudent(n)
      await sleep(40 + Math.random() * 60)
    }
    process.send({ type: 'added', total: students.length })
  }
  if (msg.type === 'opened') { opened = { checkinId: msg.checkinId, at: msg.at } }
  if (msg.type === 'report') {
    process.send({
      type: 'metrics',
      live: students.length,
      lagMax,
      samples: {
        signin: samples.signin.splice(0),
        write: samples.write.splice(0),
        poll: samples.poll.splice(0),
        fanout: samples.fanout.splice(0),
      },
      errors: Object.fromEntries(errors),
    })
    lagMax = 0
    errors.clear()
  }
  if (msg.type === 'stop') {
    for (const s of students) { try { await s.client.removeChannel(s.channel) } catch { /* closing anyway */ } }
    process.exit(0)
  }
})
