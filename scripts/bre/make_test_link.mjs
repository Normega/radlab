// A test participant and session link for a dry run of Breath Attention and Emotional Recovery, made the
// way the RA's "Generate link" makes them (create_anonymous_participant), but from a terminal with the
// service key and always flagged is_test (not counted towards baseline_cap, test data in the export).
// Like every path that hands out a session link, it asks schedule_row_block_reason first and makes no
// link if the session is closed or the check fails (CLAUDE.md "Hard gates").
//
//   node scripts/bre/make_test_link.mjs            # prints the study code and the /s/<token> path
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const STUDY_ID = 'a227145d-a66b-4053-be1f-169c825081ab'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const { data: study, error: sErr } = await db.from('studies').select('study_code_prefix').eq('id', STUDY_ID).single()
if (sErr) throw sErr
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = `${study.study_code_prefix}-T${Array.from({ length: 4 }, () => ALPHA[randomInt(ALPHA.length)]).join('')}`

const { data: { user }, error: uErr } = await db.auth.admin.createUser({
  email: `anon-${randomUUID()}@radlab.internal`, email_confirm: true, user_metadata: { display_name: code },
})
if (uErr) throw uErr
const pid = user.id
const steps = [
  db.from('profiles').upsert({ id: pid, role: 'participant', is_anonymous: true, display_name: code, sona_id: null }),
]
for (const s of steps) { const { error } = await s; if (error) throw error }
{
  const { error } = await db.from('study_enrollments').insert({
    study_id: STUDY_ID, profile_id: pid, external_id: code, enrolled_at: new Date().toISOString(), status: 'enrolled', is_test: true,
  })
  if (error) throw error
}
const { data: sessions, error: ssErr } = await db.from('study_sessions').select('id, send_time, link_expires_hours').eq('study_id', STUDY_ID).order('day_number')
if (ssErr) throw ssErr
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
const { data: sched, error: schErr } = await db.from('participant_schedule').insert({
  participant_id: pid, study_id: STUDY_ID, study_session_id: sessions[0].id, scheduled_date: today, send_time: sessions[0].send_time, status: 'pending',
}).select('id').single()
if (schErr) throw schErr

const { data: reason, error: gErr } = await db.rpc('schedule_row_block_reason', { p_schedule_id: sched.id })
if (gErr || reason) {
  await db.from('participant_schedule').update({ status: 'blocked' }).eq('id', sched.id)
  console.error(gErr ? `gate check failed, no link made: ${gErr.message}` : `session closed (${reason}), no link made`)
  process.exit(1)
}

const token = randomBytes(24).toString('base64url')
const expires = new Date(Date.now() + (sessions[0].link_expires_hours ?? 48) * 3600e3).toISOString()
const { error: lErr } = await db.from('participant_links').insert({ schedule_id: sched.id, participant_id: pid, study_id: STUDY_ID, expires_at: expires, token })
if (lErr) throw lErr
await db.from('participant_schedule').update({ status: 'link_sent' }).eq('id', sched.id)
console.log(JSON.stringify({ studyCode: code, participantId: pid, scheduleId: sched.id, path: `/s/${token}` }))
