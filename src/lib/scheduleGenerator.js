import { supabase } from './supabase'

/**
 * generateSchedule(participantId, studyId, enrollmentDate)
 *
 * Reads study_sessions for the study, sorted by day_number asc.
 * Creates one participant_schedule row per study_session.
 * Day 1 row: scheduled_date = enrollmentDate (as date string).
 * All other rows: scheduled_date = null (filled in when prior session completes).
 * Returns array of inserted row ids.
 */
export async function generateSchedule(participantId, studyId, enrollmentDate) {
  const { data: sessions, error } = await supabase
    .from('study_sessions')
    .select('id, day_number, send_time, link_expires_hours, order_index')
    .eq('study_id', studyId)
    .order('day_number', { ascending: true })
  if (error) throw error
  if (!sessions?.length) return []

  const enrollDate = typeof enrollmentDate === 'string'
    ? enrollmentDate
    : enrollmentDate.toISOString().slice(0, 10)

  const rows = sessions.map((s, i) => ({
    participant_id:   participantId,
    study_id:         studyId,
    study_session_id: s.id,
    scheduled_date:   i === 0 ? enrollDate : null,
    send_time:        s.send_time,
    status:           'pending',
  }))

  const { data, error: insertErr } = await supabase
    .from('participant_schedule')
    .insert(rows)
    .select('id')
  if (insertErr) throw insertErr
  return data.map(r => r.id)
}

/**
 * advanceSchedule(participantId, studyId, completedScheduleId)
 *
 * Called when a participant completes a session.
 * Finds the next study_session by day_number and sets its scheduled_date
 * based on the day offset from the just-completed session's completion date.
 */
export async function advanceSchedule(participantId, studyId, completedScheduleId) {
  const { data: completedRow, error: rowErr } = await supabase
    .from('participant_schedule')
    .select('study_session_id, completed_at')
    .eq('id', completedScheduleId)
    .single()
  if (rowErr) throw rowErr

  const { data: completedSession, error: sessErr } = await supabase
    .from('study_sessions')
    .select('day_number')
    .eq('id', completedRow.study_session_id)
    .single()
  if (sessErr) throw sessErr

  const { data: nextScheduleRow, error: nextRowErr } = await supabase
    .from('participant_schedule')
    .select('id, study_sessions(day_number)')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
    .eq('status', 'pending')
    .is('scheduled_date', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (nextRowErr) throw nextRowErr
  if (!nextScheduleRow) return

  const completedAt = new Date(completedRow.completed_at)
  const dayOffset = (nextScheduleRow.study_sessions?.day_number ?? 1) - completedSession.day_number
  const nextDate = new Date(completedAt)
  nextDate.setDate(nextDate.getDate() + dayOffset)
  const scheduledDate = nextDate.toISOString().slice(0, 10)

  const { error: updateErr } = await supabase
    .from('participant_schedule')
    .update({ scheduled_date: scheduledDate })
    .eq('id', nextScheduleRow.id)
  if (updateErr) throw updateErr
}

/**
 * issueLink(scheduleRowId)
 *
 * Expires any existing active participant_links for this participant + study.
 * Creates a new participant_links row.
 * Updates participant_schedule status to 'link_sent'.
 * Returns the new link token.
 */
export async function issueLink(scheduleRowId) {
  const { data: schedRow, error: schedErr } = await supabase
    .from('participant_schedule')
    .select('participant_id, study_id, study_sessions(link_expires_hours)')
    .eq('id', schedRowId)
    .single()
  if (schedErr) throw schedErr

  const expiresHours = schedRow.study_sessions?.link_expires_hours ?? 48
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString()

  // Expire all existing active links for this participant + study.
  await supabase
    .from('participant_links')
    .update({ status: 'expired' })
    .eq('participant_id', schedRow.participant_id)
    .eq('study_id', schedRow.study_id)
    .eq('status', 'active')

  const { data: link, error: linkErr } = await supabase
    .from('participant_links')
    .insert({
      schedule_id:    schedRowId,
      participant_id: schedRow.participant_id,
      study_id:       schedRow.study_id,
      expires_at:     expiresAt,
    })
    .select('token')
    .single()
  if (linkErr) throw linkErr

  await supabase
    .from('participant_schedule')
    .update({ status: 'link_sent' })
    .eq('id', schedRowId)

  return link.token
}
