// check_schedule — cron-triggered scheduler.
// Queries for due pending schedule rows and sends (or suppresses) each one.
//
// Schedule: every 15 minutes, via a pg_cron job calling this over net.http_post
// (see `cron.job` in the database — not deployed with `--schedule`).
//
// Also callable manually via HTTP POST for testing.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { materializeSchedule, baselineTimeOfDay } from '../_shared/materializeSchedule.ts'
import type { Graph } from '../_shared/materializeSchedule.ts'
import { processAdherenceWithdrawal } from '../_shared/processAdherenceWithdrawal.ts'
import { criticalSessionKind, reminderAction } from '../_shared/criticalSession.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LAB_TIMEZONE = 'America/Toronto'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** date ('YYYY-MM-DD') + time ('HH:MM:SS') for an instant, in a given IANA time zone. */
function formatInTimeZone(instant: Date, timeZone: string): { date: string; time: string } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(instant)

  return { date, time }
}

/** Lexicographically comparable key for a (scheduled_date, send_time) pair. */
function scheduleKey(date: string, time: string): string {
  return `${date}T${time}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const db: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const now = new Date()
    const { date: todayStr, time: nowTime } = formatInTimeZone(now, LAB_TIMEZONE)
    const nowKey = scheduleKey(todayStr, nowTime)

    // Rows scheduled within the past hour count as "on time" (the cron ticks
    // every 15 min, so an on-time row is normally processed well inside this
    // window). Only rows older than this are eligible for the late-row
    // suppression in step 2c.
    const { date: graceDate, time: graceTime } = formatInTimeZone(
      new Date(now.getTime() - 60 * 60 * 1000),
      LAB_TIMEZONE,
    )
    const onTimeKey = scheduleKey(graceDate, graceTime)

    // 0. Auto-expire any active links whose expires_at has passed.
    //    Prevents stale manually-issued links from blocking automated sends indefinitely.
    await db
      .from('participant_links')
      .update({
        status: 'expired',
        ended_reason: 'timeout',
        ended_at: now.toISOString(),
      })
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lt('expires_at', now.toISOString())

    // 0b. Terminal-ize dead rows: sent/issued rows scheduled before today with
    // no remaining active link can never be completed — mark them 'missed' so
    // they stop blocking the fork advance pass (participants may miss daily
    // sessions and still advance; a missed fork-gating assessment simply never
    // resolves the fork). Rows with a still-active link (e.g. a 72h assessment
    // window spanning several days) are protected until step 0 expires it.
    let missed = 0
    {
      const { data: staleRows } = await db
        .from('participant_schedule')
        .select('id')
        .in('status', ['link_sent', 'unlocked'])
        .lt('scheduled_date', todayStr)

      if (staleRows && staleRows.length > 0) {
        const staleIds = staleRows.map((r) => r.id)
        const { data: activeForStale } = await db
          .from('participant_links')
          .select('schedule_id')
          .eq('status', 'active')
          .in('schedule_id', staleIds)

        const protectedIds = new Set((activeForStale ?? []).map((l) => l.schedule_id))
        const deadIds = staleIds.filter((id) => !protectedIds.has(id))
        if (deadIds.length > 0) {
          await db.from('participant_schedule').update({ status: 'missed' }).in('id', deadIds)
          missed = deadIds.length
        }
      }
    }

    // 0c. Withdrawn enrollments (adherence termination, or the manual admin
    // "Withdraw" action) — fetched once and honored by every pass below:
    // due-row sends (1b), reminders (3b), and the advance pass (4). None of
    // these checked withdrawal at all before 2026-07-15.
    const { data: withdrawnEnrollments } = await db
      .from('study_enrollments')
      .select('profile_id, study_id')
      .eq('status', 'withdrawn')
    const withdrawnSet = new Set(
      (withdrawnEnrollments ?? []).map((w) => `${w.profile_id}:${w.study_id}`),
    )

    // 1. Fetch pending rows scheduled today or earlier (date-only filter; the
    // send_time cutoff is applied below since Postgres can't compare it
    // against "now" without knowing which rows are for today).
    const { data: candidateRows, error: fetchErr } = await db
      .from('participant_schedule')
      .select('id, participant_id, study_id, scheduled_date, send_time, attempts')
      .eq('status', 'pending')
      .lte('scheduled_date', todayStr)

    if (fetchErr) {
      console.error('Failed to fetch due rows:', fetchErr.message)
      return json({ error: fetchErr.message }, 500)
    }

    // 1b. Time cutoff + withdrawn filter.
    const dueRows = (candidateRows ?? []).filter(
      (r) =>
        scheduleKey(r.scheduled_date, r.send_time) <= nowKey &&
        !withdrawnSet.has(`${r.participant_id}:${r.study_id}`),
    )

    let processed = 0
    let suppressed = 0
    let failed = 0
    let deferred = 0

    // Steps 2-3 only apply when something is actually due to send — the
    // advance pass (step 4) below must still run every tick regardless,
    // so this is a conditional block rather than an early return.
    if (dueRows.length > 0) {
      // Fetch reminder settings in bulk (keyed by study_id)
      const studyIds = [...new Set(dueRows.map((r) => r.study_id))]
      const studyMap: Record<string, { max_attempts: number; reminder_interval_hours: number | null }> = {}

      const { data: studies } = await db
        .from('studies')
        .select('id, max_attempts, reminder_interval_hours')
        .in('id', studyIds)

      for (const s of studies ?? []) {
        studyMap[s.id] = {
          max_attempts: s.max_attempts ?? 1,
          reminder_interval_hours: s.reminder_interval_hours ?? null,
        }
      }

      for (const row of dueRows) {
        const settings = studyMap[row.study_id] ?? { max_attempts: 1, reminder_interval_hours: null }

        // 2a. Max attempts check
        if ((row.attempts ?? 0) >= settings.max_attempts) {
          await suppressRow(db, row.id, row.participant_id, 'max_attempts_reached')
          suppressed++
          continue
        }

        // 2b. Active link check — participant already has an active link for
        // a different row. This is TRANSIENT (step 0 expires the stale link
        // on a later tick), so defer: leave the row 'pending' and retry next
        // tick. It must NOT suppressRow — 'blocked' is permanent, and a
        // missed day's link is routinely still nominally 'active' at the
        // instant the next day's 06:00 row is processed (confirmed live
        // 2026-07-15: a real dry-run participant's day-3 session was
        // permanently blocked this way and never emailed).
        const { data: activeLink } = await db
          .from('participant_links')
          .select('id, schedule_id')
          .eq('participant_id', row.participant_id)
          .eq('status', 'active')
          .maybeSingle()

        if (activeLink && activeLink.schedule_id !== row.id) {
          deferred++
          continue
        }

        // 2c. New link imminent check — LATE rows only: a backlogged row
        // (due over an hour ago, e.g. held up by an active link or downtime)
        // is skipped when the participant's next row is due within
        // reminder_interval_hours anyway. An on-time row must NEVER be
        // suppressed here: in a 3-check-ins-per-day study every same-day
        // sibling is "imminent", and applying this check to on-time rows
        // permanently blocked every 09:00 and 14:00 check-in of the Zerin
        // study — only the 20:00 send survived (confirmed live 2026-07-24).
        if (
          settings.reminder_interval_hours &&
          scheduleKey(row.scheduled_date, row.send_time) < onTimeKey
        ) {
          const cutoffInstant = new Date(now.getTime() + settings.reminder_interval_hours * 60 * 60 * 1000)
          const { date: cutoffDate, time: cutoffTime } = formatInTimeZone(cutoffInstant, LAB_TIMEZONE)
          const cutoffKey = scheduleKey(cutoffDate, cutoffTime)

          const { data: candidates } = await db
            .from('participant_schedule')
            .select('id, scheduled_date, send_time')
            .eq('participant_id', row.participant_id)
            .eq('status', 'pending')
            .neq('id', row.id)
            .lte('scheduled_date', cutoffDate)

          const imminentRow = (candidates ?? []).find((c) => {
            const key = scheduleKey(c.scheduled_date, c.send_time)
            return key > nowKey && key <= cutoffKey
          })

          if (imminentRow) {
            await suppressRow(db, row.id, row.participant_id, 'new_link_imminent')
            suppressed++
            continue
          }
        }

        // 3. Not suppressed — send the message
        try {
          const sendRes = await fetch(`${supabaseUrl}/functions/v1/send_message`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ schedule_id: row.id }),
          })

          const sendBody = await sendRes.json()

          if (sendBody?.suppressed) {
            // Consent suppressed — log it
            await suppressRow(db, row.id, row.participant_id, sendBody.reason ?? 'consent_not_given')
            suppressed++
          } else if (sendBody?.success) {
            // Increment attempts + stamp send time (reminder cadence anchor)
            await db
              .from('participant_schedule')
              .update({ attempts: (row.attempts ?? 0) + 1, last_sent_at: now.toISOString() })
              .eq('id', row.id)
            processed++
          } else {
            console.error(`send_message failed for row ${row.id}:`, sendBody?.error)
            failed++
          }
        } catch (sendErr) {
          console.error(`send_message fetch error for row ${row.id}:`, sendErr)
          failed++
        }
      }
    }

    // Design graphs, fetched once and used by both the reminder pass (3b, to
    // decide which sessions are critical) and the advance pass (4).
    const { data: graphStudies } = await db
      .from('studies')
      .select('id, design_graph')
      .not('design_graph', 'is', null)
    const graphByStudyId = new Map((graphStudies ?? []).map((s) => [s.id, s.design_graph as Graph]))

    // 3b. Reminders: re-send rows that were sent but not completed while
    // their link is still ACTIVE (an expired link is never re-emailed here —
    // dead rows become 'missed' in step 0b instead). Cadence is the study's
    // reminder_interval_hours, falling back to a link-lifetime heuristic when
    // unset: 12 h for daily sessions (<= 24 h links), 24 h for assessment
    // windows (72 h links). Reminder count (attempts - 1, the initial send is
    // attempt 1) is capped by studies.reminder_max when set; attempts overall
    // stay capped by studies.max_attempts; gated on studies.reminders_enabled.
    // A reminder never fires for a link shorter than the cadence — short
    // check-in windows (e.g. 4 h EMA links) simply get no reminder.
    //
    // 'unlocked' rows are included alongside 'link_sent' (2026-08-01). A row
    // becomes 'unlocked' the moment get_session_by_token is called, i.e. as
    // soon as the participant OPENS the link — so filtering to 'link_sent'
    // alone silently excluded everyone who started a session and abandoned it
    // partway, which is precisely the person a reminder is for. Two live rows
    // were in that state when this was found.
    //
    // Final notice (2026-08-01): on a critical session — one gating a fork, or
    // ending the study — an extra reminder fires FINAL_NOTICE_LEAD_HOURS before
    // the link closes, regardless of cadence. On a 72 h window at 12 h cadence
    // and reminder_max 2 the last cadence reminder lands 48 h before the
    // deadline, so "last chance" copy on it would simply be false. Any cadence
    // reminder due within FINAL_NOTICE_MERGE_HOURS of the notice is dropped in
    // its favour rather than sent beside it. See _shared/criticalSession.ts.
    let reminded = 0
    let finalNotices = 0
    {
      const { data: activeLinkRows } = await db
        .from('participant_links')
        .select('schedule_id, expires_at')
        .eq('status', 'active')

      const expiresByScheduleId = new Map(
        (activeLinkRows ?? []).map((l) => [l.schedule_id, l.expires_at as string | null]),
      )
      const activeIds = [...expiresByScheduleId.keys()]
      if (activeIds.length > 0) {
        const { data: remRows } = await db
          .from('participant_schedule')
          .select('id, participant_id, study_id, study_session_id, attempts, last_sent_at, final_notice_sent_at')
          .in('id', activeIds)
          .in('status', ['link_sent', 'unlocked'])
          .is('completed_at', null)
          .not('last_sent_at', 'is', null)

        if (remRows && remRows.length > 0) {
          const remStudyIds = [...new Set(remRows.map((r) => r.study_id))]
          const { data: remStudies } = await db
            .from('studies')
            .select('id, max_attempts, reminders_enabled, reminder_interval_hours, reminder_max')
            .in('id', remStudyIds)
          const remStudyMap = new Map((remStudies ?? []).map((s) => [s.id, s]))

          const sessIds = [...new Set(remRows.map((r) => r.study_session_id).filter(Boolean))]
          const { data: sessRows } = sessIds.length > 0
            ? await db.from('study_sessions').select('id, node_key, link_expires_hours').in('id', sessIds)
            : { data: [] }
          const sessMap = new Map((sessRows ?? []).map((s) => [s.id, s]))

          for (const row of remRows) {
            if (withdrawnSet.has(`${row.participant_id}:${row.study_id}`)) continue
            const study = remStudyMap.get(row.study_id)
            if (!study || study.reminders_enabled === false) continue

            const session = sessMap.get(row.study_session_id)
            const expires = session?.link_expires_hours ?? 48

            // Is this a critical session? Needs the study's graph, so a study
            // without one (legacy, or a hand-built schedule) simply gets no
            // final notices.
            const graph = graphByStudyId.get(row.study_id)
            const expiresAt = expiresByScheduleId.get(row.id)
            const noticeKind = graph && session?.node_key
              ? criticalSessionKind(graph, session.node_key, expires)
              : null

            const cadenceHours = study.reminder_interval_hours ?? (expires <= 24 ? 12 : 24)
            const action = reminderAction({
              nowMs: now.getTime(),
              expiresAtMs: expiresAt ? new Date(expiresAt).getTime() : null,
              lastSentAtMs: new Date(row.last_sent_at).getTime(),
              cadenceHours,
              noticeKind,
              finalNoticeAlreadySent: !!row.final_notice_sent_at,
            })
            if (action === 'none') continue

            // The notice is exempt from reminder_max / max_attempts. Those caps
            // exist to bound routine nudging; letting one swallow the single
            // email that warns about withdrawal would invert their purpose —
            // which is why this branch sits ahead of them.
            if (action === 'final_notice') {
              try {
                const sendRes = await fetch(`${supabaseUrl}/functions/v1/send_message`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ schedule_id: row.id, final_notice: noticeKind }),
                })
                const sendBody = await sendRes.json()
                if (sendBody?.success) {
                  await db
                    .from('participant_schedule')
                    .update({
                      attempts: (row.attempts ?? 0) + 1,
                      last_sent_at: now.toISOString(),
                      final_notice_sent_at: now.toISOString(),
                    })
                    .eq('id', row.id)
                  finalNotices++
                }
              } catch (noticeErr) {
                console.error(`final notice send failed for row ${row.id}:`, noticeErr)
              }
              continue
            }

            // Ordinary cadence reminder — the attempt caps apply here and only
            // here.
            if ((row.attempts ?? 0) >= (study.max_attempts ?? 1)) continue
            const remindersSent = Math.max(0, (row.attempts ?? 0) - 1)
            if (study.reminder_max != null && remindersSent >= study.reminder_max) continue

            try {
              const sendRes = await fetch(`${supabaseUrl}/functions/v1/send_message`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ schedule_id: row.id, is_reminder: true }),
              })
              const sendBody = await sendRes.json()
              if (sendBody?.success) {
                await db
                  .from('participant_schedule')
                  .update({ attempts: (row.attempts ?? 0) + 1, last_sent_at: now.toISOString() })
                  .eq('id', row.id)
                reminded++
              }
            } catch (remErr) {
              console.error(`reminder send failed for row ${row.id}:`, remErr)
            }
          }
        }
      }
    }

    // 4. Advance pass (Phase 2): participants who've completed everything
    // materialized so far, for studies with a design_graph — re-walking
    // resolves any fork they've now reached and materializes the next
    // segment. materializeSchedule is idempotent, so this is safe to run
    // every cron tick even for participants with nothing new to do.
    let advanced = 0
    let withdrawn = 0
    let completedStudies = 0
    let adherenceShortfalls = 0

    if (graphStudies && graphStudies.length > 0) {
      const graphStudyIds = graphStudies.map((s) => s.id)

      const { data: allRows } = await db
        .from('participant_schedule')
        .select('participant_id, study_id, status, scheduled_date')
        .in('study_id', graphStudyIds)

      // Participants already withdrawn (see withdrawnSet above) must not be
      // re-walked — materializeSchedule is idempotent for schedule rows, but
      // a repeat "withdrawal detected" result would re-run
      // processAdherenceWithdrawal (and re-email) on every cron tick.
      const byParticipantStudy = new Map<string, { statuses: string[]; minDate: string }>()
      for (const r of allRows ?? []) {
        const key = `${r.participant_id}:${r.study_id}`
        const entry = byParticipantStudy.get(key) ?? { statuses: [], minDate: r.scheduled_date }
        entry.statuses.push(r.status)
        if (r.scheduled_date < entry.minDate) entry.minDate = r.scheduled_date
        byParticipantStudy.set(key, entry)
      }

      for (const [key, entry] of byParticipantStudy) {
        if (withdrawnSet.has(key)) continue

        const hasOutstanding = entry.statuses.some((s) => s === 'unlocked' || s === 'pending' || s === 'link_sent')
        const hasCompleted = entry.statuses.some((s) => s === 'completed')
        if (hasOutstanding || !hasCompleted) continue

        const [participantId, studyId] = key.split(':')
        const graph = graphByStudyId.get(studyId)
        if (!graph) continue

        try {
          // unlockFirst deliberately omitted (false): nobody is in the
          // browser during a cron tick, so new rows must be 'pending' for
          // the due-row sender above to email them — an 'unlocked' row
          // would never be sent (this exact bug stranded the Phase 2 day-1
          // email for every fork-advanced participant until 2026-07-15).
          const result = await materializeSchedule(db, {
            participantId,
            studyId,
            graph,
            t0Date: entry.minDate,
            baselineSendTime: baselineTimeOfDay(graph),
          })
          if (result.inserted > 0) advanced++

          if (result.withdrawal) {
            try {
              await processAdherenceWithdrawal(db, { participantId, studyId, withdrawal: result.withdrawal })
              withdrawn++
            } catch (withdrawErr) {
              console.error(`adherence withdrawal failed for participant ${participantId} study ${studyId}:`, withdrawErr)
            }
          }

          // Below the threshold on a check authored `on_fail: 'continue'` —
          // no side effect by design (the participant keeps the rest of the
          // study, including the final assessment), but the pass is otherwise
          // silent about it, and there is no withdrawal_reason to read it off
          // later. Logged, not persisted: the analysis-time classification
          // comes from liliana_phase_adherence, which recounts.
          for (const s of result.adherenceShortfalls ?? []) {
            adherenceShortfalls++
            console.log(
              `adherence shortfall (not enforced) participant ${participantId} study ${studyId} ` +
              `node ${s.nodeId} ${s.phase}: ${s.completed}/${s.ofTotal}, minimum ${s.minRequired}`,
            )
          }

          // Whole study finished (final assessment completed) — mark the
          // enrollment. The status filter makes this idempotent across
          // ticks and never touches withdrawn enrollments.
          if (result.completedStudy) {
            const { data: compRows, error: compErr } = await db
              .from('study_enrollments')
              .update({ status: 'completed' })
              .eq('study_id', studyId)
              .eq('profile_id', participantId)
              .in('status', ['enrolled', 'in_progress'])
              .select('id')
            if (compErr) {
              console.error(`completion mark failed for participant ${participantId} study ${studyId}:`, compErr.message)
            } else if (compRows && compRows.length > 0) {
              completedStudies++
            }
          }
        } catch (advanceErr) {
          console.error(`advance pass failed for participant ${participantId} study ${studyId}:`, advanceErr)
        }
      }
    }

    return json({ processed, suppressed, deferred, failed, missed, reminded, finalNotices, advanced, withdrawn, completed: completedStudies, adherenceShortfalls })

  } catch (err) {
    console.error('check_schedule unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function suppressRow(db: SupabaseClient, rowId: string, participantId: string, reason: string) {
  const [logRes, schedRes] = await Promise.all([
    db.from('message_log').insert({
      participant_id: participantId,
      sent_at: new Date().toISOString(),
      channel: 'email',
      status: 'suppressed',
      suppressed_reason: reason,
      is_test: false,
    }),
    db.from('participant_schedule').update({ status: 'blocked' }).eq('id', rowId),
  ])
  if (logRes.error) console.error('Failed to log suppression:', logRes.error.message)
  if (schedRes.error) console.error('Failed to update schedule status:', schedRes.error.message)
}
