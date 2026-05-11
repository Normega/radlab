import { supabase } from './supabase'

// Returns the next calendar date on or after baseDate that falls on dayOfWeek.
function nextOccurrence(baseDate, dayOfWeek) {
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  const target = dayMap[dayOfWeek]
  const date = new Date(baseDate)
  const current = date.getDay()
  const diff = (target - current + 7) % 7
  date.setDate(date.getDate() + diff)
  return date
}

function periodOfDay(sendTime) {
  const [hours] = sendTime.split(':').map(Number)
  if (hours < 12) return 'morning'
  if (hours < 17) return 'afternoon'
  return 'evening'
}

/**
 * Generate a participant schedule for a given protocol.
 *
 * single_shot  → one pending row with scheduled_for = null
 * scheduled    → one row per protocol_day_contact with computed scheduled_for
 *
 * Returns the inserted participant_schedule rows.
 */
export async function generateSchedule(participantId, protocolId, enrolledAt) {
  const { data: protocol, error: protocolErr } = await supabase
    .from('study_protocols')
    .select('*')
    .eq('id', protocolId)
    .single()
  if (protocolErr) throw protocolErr

  if (protocol.protocol_type === 'single_shot') {
    const { data, error } = await supabase
      .from('participant_schedule')
      .insert({
        participant_id:      participantId,
        protocol_id:         protocolId,
        session_template_id: protocol.session_template_id ?? null,
        scheduled_for:       null,
        status:              'pending',
        enrolled_at:         enrolledAt.toISOString(),
      })
      .select()
    if (error) throw error
    return data
  }

  // scheduled: build one row per study-day contact
  const { data: studyDays, error: daysErr } = await supabase
    .from('protocol_study_days')
    .select('*, protocol_day_contacts(*)')
    .eq('protocol_id', protocolId)
    .order('day_number')
  if (daysErr) throw daysErr

  const rows = []
  for (const studyDay of studyDays) {
    const contacts = (studyDay.protocol_day_contacts ?? [])
      .sort((a, b) => a.contact_order - b.contact_order)

    const calendarDate = nextOccurrence(enrolledAt, studyDay.day_of_week)
    const studyWeek = Math.ceil(studyDay.day_number / 7)

    for (const contact of contacts) {
      const [hours, minutes] = contact.send_time.split(':').map(Number)
      const scheduledFor = new Date(calendarDate)
      scheduledFor.setHours(hours, minutes, 0, 0)

      rows.push({
        participant_id:      participantId,
        protocol_id:         protocolId,
        study_day_id:        studyDay.id,
        day_contact_id:      contact.id,
        session_template_id: contact.session_template_id ?? null,
        study_day:           studyDay.day_number,
        study_week:          studyWeek,
        period_of_day:       periodOfDay(contact.send_time),
        contact_order:       contact.contact_order,
        condition_arm:       null,
        scheduled_for:       scheduledFor.toISOString(),
        status:              'pending',
        enrolled_at:         enrolledAt.toISOString(),
      })
    }
  }

  const { data, error } = await supabase
    .from('participant_schedule')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}

/**
 * Issue a participant link for a schedule instance.
 * Enforces the one-active-link-per-participant constraint.
 * Returns the inserted participant_links row.
 */
export async function issueLink(scheduleInstanceId) {
  const { data: scheduleRow, error: schedErr } = await supabase
    .from('participant_schedule')
    .select('participant_id, protocol_id, scheduled_for, day_contact_id')
    .eq('id', scheduleInstanceId)
    .single()
  if (schedErr) throw schedErr

  // Compute expiry from link_expires_hours on the day contact (default 48 h)
  let expiresAt = null
  if (scheduleRow.scheduled_for) {
    let expiresHours = 48
    if (scheduleRow.day_contact_id) {
      const { data: contact } = await supabase
        .from('protocol_day_contacts')
        .select('link_expires_hours')
        .eq('id', scheduleRow.day_contact_id)
        .single()
      expiresHours = contact?.link_expires_hours ?? 48
    }
    expiresAt = new Date(
      new Date(scheduleRow.scheduled_for).getTime() + expiresHours * 60 * 60 * 1000
    ).toISOString()
  }

  const token = crypto.randomUUID()

  const { data: link, error: linkErr } = await supabase
    .from('participant_links')
    .insert({
      token,
      participant_id:       scheduleRow.participant_id,
      protocol_id:          scheduleRow.protocol_id,
      schedule_instance_id: scheduleInstanceId,
      status:               'active',
      expires_at:           expiresAt,
    })
    .select()
    .single()

  if (linkErr) {
    if (linkErr.code === '23505') {
      throw new Error(
        'Participant already has an active link. Revoke it before issuing a new one.'
      )
    }
    throw linkErr
  }

  const { error: updateErr } = await supabase
    .from('participant_schedule')
    .update({ link_id: link.id, status: 'link_sent' })
    .eq('id', scheduleInstanceId)
  if (updateErr) throw updateErr

  return link
}

/**
 * Check whether a reminder message should be suppressed for a participant.
 *
 * upcomingLinkWithinHours  — if a pending slot opens within this window, suppress.
 *
 * Returns { suppress: boolean, reason?: string }
 */
export async function shouldSuppressReminder(participantId, upcomingLinkWithinHours) {
  // 1. Must have an active link
  const { data: activeLink } = await supabase
    .from('participant_links')
    .select('id')
    .eq('participant_id', participantId)
    .eq('status', 'active')
    .maybeSingle()

  if (!activeLink) return { suppress: true, reason: 'no_active_link' }

  // 2. A new link is imminent
  const windowEnd = new Date(
    Date.now() + upcomingLinkWithinHours * 60 * 60 * 1000
  ).toISOString()

  const { data: imminent } = await supabase
    .from('participant_schedule')
    .select('id')
    .eq('participant_id', participantId)
    .eq('status', 'pending')
    .not('scheduled_for', 'is', null)
    .gt('scheduled_for', new Date().toISOString())
    .lte('scheduled_for', windowEnd)
    .limit(1)
    .maybeSingle()

  if (imminent) return { suppress: true, reason: 'new_link_imminent' }

  // 3. Max attempts reached on the currently-sent schedule row
  const { data: sentRow } = await supabase
    .from('participant_schedule')
    .select('attempts, study_protocols(max_attempts)')
    .eq('participant_id', participantId)
    .eq('status', 'link_sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sentRow) {
    const maxAttempts = sentRow.study_protocols?.max_attempts ?? 1
    if (sentRow.attempts >= maxAttempts) {
      return { suppress: true, reason: 'max_attempts_reached' }
    }
  }

  return { suppress: false }
}
