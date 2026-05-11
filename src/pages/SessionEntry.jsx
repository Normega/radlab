import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Resolution states: loading | not_found | revoked | completed | expired | too_early | running | session_complete
export default function SessionEntry() {
  const { token } = useParams()
  const [state,          setState]          = useState('loading')
  const [link,           setLink]           = useState(null)
  const [scheduleRow,    setScheduleRow]    = useState(null)
  const [nextScheduled,  setNextScheduled]  = useState(null)
  const [activities,     setActivities]     = useState([])
  const [currentIndex,   setCurrentIndex]   = useState(0)

  useEffect(() => { resolveToken() }, [token])

  async function resolveToken() {
    const { data: linkData } = await supabase
      .from('participant_links')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (!linkData) { setState('not_found'); return }
    setLink(linkData)

    if (linkData.status === 'revoked')   { setState('revoked');   return }
    if (linkData.status === 'completed') { setState('completed'); return }

    if (linkData.status === 'expired') {
      await fetchNextPendingSlot(linkData.participant_id)
      setState('expired')
      return
    }

    // Fetch the schedule row
    let sched = null
    if (linkData.schedule_instance_id) {
      const { data } = await supabase
        .from('participant_schedule')
        .select('*')
        .eq('id', linkData.schedule_instance_id)
        .single()
      sched = data
    }
    setScheduleRow(sched)

    // Too early check
    if (sched?.scheduled_for && new Date(sched.scheduled_for) > new Date()) {
      setState('too_early')
      return
    }

    // Record first access
    await recordFirstAccess(linkData, sched)

    // Load session activities
    const templateId = sched?.session_template_id
    if (templateId) {
      const { data: nodes } = await supabase
        .from('session_template_nodes')
        .select('*, activities(*)')
        .eq('session_template_id', templateId)
        .order('order_index')
      setActivities(nodes ?? [])
    }

    setState('running')
  }

  async function fetchNextPendingSlot(participantId) {
    const { data } = await supabase
      .from('participant_schedule')
      .select('scheduled_for')
      .eq('participant_id', participantId)
      .eq('status', 'pending')
      .not('scheduled_for', 'is', null)
      .order('scheduled_for')
      .limit(1)
      .maybeSingle()
    setNextScheduled(data?.scheduled_for ?? null)
  }

  async function recordFirstAccess(linkData, sched) {
    const now = new Date().toISOString()

    if (!linkData.used_at) {
      await supabase
        .from('participant_links')
        .update({ used_at: now })
        .eq('id', linkData.id)
    }

    if (sched && !sched.enrolled_at) {
      await supabase
        .from('participant_schedule')
        .update({ enrolled_at: now, status: 'unlocked', unlocked_at: now })
        .eq('id', sched.id)
    }
  }

  async function handleActivityComplete() {
    const node = activities[currentIndex]
    const now  = new Date().toISOString()

    await supabase.from('participant_activity_log').insert({
      participant_id:       link.participant_id,
      schedule_instance_id: scheduleRow?.id ?? null,
      activity_id:          node.activity_id,
      completed_at:         now,
      order_index:          node.order_index,
      result_table:         null,
      result_id:            null,
    })

    if (currentIndex === activities.length - 1) {
      await completeSession(now)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  async function completeSession(now = new Date().toISOString()) {
    await supabase
      .from('participant_links')
      .update({ status: 'completed' })
      .eq('id', link.id)

    if (scheduleRow) {
      await supabase
        .from('participant_schedule')
        .update({ status: 'completed', completed_at: now })
        .eq('id', scheduleRow.id)
    }

    // If single_shot with a downstream protocol, generate its schedule now
    if (scheduleRow?.protocol_id) {
      const { data: protocol } = await supabase
        .from('study_protocols')
        .select('protocol_type, enrollment_protocol_id')
        .eq('id', scheduleRow.protocol_id)
        .single()

      if (protocol?.protocol_type === 'single_shot' && protocol?.enrollment_protocol_id) {
        const { generateSchedule } = await import('../lib/scheduleGenerator')
        await generateSchedule(
          link.participant_id,
          protocol.enrollment_protocol_id,
          new Date()
        )
      }
    }

    setState('session_complete')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <FullScreen>
        <p className="text-gray-400 text-sm">Loading…</p>
      </FullScreen>
    )
  }

  if (state === 'not_found') {
    return (
      <FullScreen>
        <StatusCard>This link is not valid.</StatusCard>
      </FullScreen>
    )
  }

  if (state === 'revoked') {
    return (
      <FullScreen>
        <StatusCard>This link is no longer active. Please contact your researcher.</StatusCard>
      </FullScreen>
    )
  }

  if (state === 'completed' || state === 'session_complete') {
    return (
      <FullScreen>
        <StatusCard>You have already completed this session.</StatusCard>
      </FullScreen>
    )
  }

  if (state === 'expired') {
    return (
      <FullScreen>
        <StatusCard>
          This session window has closed.{' '}
          {nextScheduled
            ? <>Your next check-in is scheduled for {fmt(nextScheduled)}.</>
            : 'Please contact your researcher for more information.'
          }
        </StatusCard>
      </FullScreen>
    )
  }

  if (state === 'too_early') {
    return (
      <FullScreen>
        <StatusCard>
          Your session opens on {scheduleRow?.scheduled_for ? fmt(scheduleRow.scheduled_for) : 'a scheduled date'}.
        </StatusCard>
      </FullScreen>
    )
  }

  if (state === 'running') {
    const node = activities[currentIndex]

    if (!node) {
      return (
        <FullScreen>
          <p className="text-gray-400 text-sm">No activities in this session.</p>
        </FullScreen>
      )
    }

    const activityLabel = node.label ?? node.activities?.label ?? 'Activity'
    const category      = node.activities?.category    ?? ''
    const subcategory   = node.activities?.subcategory ?? ''

    return (
      <FullScreen>
        <div className="max-w-lg w-full mx-auto px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-2">
            Activity {currentIndex + 1} of {activities.length}
          </p>

          <h1 className="text-2xl font-semibold text-gray-800 mb-2">{activityLabel}</h1>

          {(category || subcategory) && (
            <p className="text-sm text-gray-400 mb-10">
              {category}{subcategory ? ` · ${subcategory}` : ''}
            </p>
          )}

          <button
            onClick={handleActivityComplete}
            className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium transition-colors"
          >
            Complete
          </button>
        </div>
      </FullScreen>
    )
  }

  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FullScreen({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  )
}

function StatusCard({ children }) {
  return (
    <p className="max-w-md px-6 text-gray-700 text-lg text-center leading-relaxed">
      {children}
    </p>
  )
}

function fmt(ts) {
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
