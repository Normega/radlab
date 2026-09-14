import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { isFixedTimepoint, sessionsUnderTimepoint } from '../../lib/experimentGraph'

// ── CalendarDatesPanel ───────────────────────────────────────────────────────
// The one place a calendar-date timepoint's date is set, changed, or put back
// to "to be determined" — including after participants have enrolled, which
// the Experiment Builder cannot do (its save rebuilds study_sessions, which
// cascades to every participant's schedule, so it locks at first enrolment).
//
// Nothing is released without a confirmation that names the date and the
// number of people it goes to: the rule (Norm, 2026-09-11) is that an undated
// placeholder never fires until a person has checked the date. The confirmation
// comes from a dry run of the same database function that then applies it, so
// the count shown is the count that moves. The function refuses a date in the
// past, and refuses any change once the current date has arrived or anything
// under the timepoint has been sent (20260911_fixed_date_timepoints.sql).

const LAB_TZ = 'America/Toronto'

function labNowKey() {
  const d = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: LAB_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: LAB_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${date}T${time}`
}

function fmtLong(date, time) {
  if (!date) return 'To be determined'
  const d = new Date(`${date}T12:00:00`)
  const day = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return time ? `${day} at ${time}` : day
}

function useCalendarTimepoints(studyId) {
  return useQuery({
    queryKey: ['calendar-timepoints', studyId],
    enabled: !!studyId,
    queryFn: async () => {
      const { data: study, error } = await supabase
        .from('studies').select('design_graph').eq('id', studyId).single()
      if (error) throw error
      const graph = study?.design_graph
      const fixed = (graph?.nodes ?? []).filter(isFixedTimepoint)
      if (!fixed.length) return []

      const { data: rows, error: rowsErr } = await supabase
        .from('participant_schedule')
        .select('status, attempts, link_id, completed_at, study_sessions(node_key)')
        .eq('study_id', studyId)
      if (rowsErr) throw rowsErr

      return fixed.map(tp => {
        const keys = new Set(sessionsUnderTimepoint(graph, tp.id).map(s => s.nodeKey))
        const mine = (rows ?? []).filter(r => keys.has(r.study_sessions?.node_key))
        const waiting   = mine.filter(r => r.status === 'awaiting_date').length
        const skipped   = mine.filter(r => r.status === 'skipped').length
        const scheduled = mine.filter(r => r.status === 'pending' && !r.link_id && !r.attempts && !r.completed_at).length
        const sent      = mine.length - waiting - skipped - scheduled
        return {
          id: tp.id,
          label: tp.label || 'Untitled timepoint',
          date: tp.fixed_date ?? null,
          time: tp.time_of_day ?? null,
          sessions: keys.size,
          waiting, scheduled, sent, skipped,
        }
      })
    },
  })
}

export default function CalendarDatesPanel({ study }) {
  const studyId = study?.id
  const { data: timepoints = [], isLoading, refetch } = useCalendarTimepoints(studyId)
  if (!studyId || isLoading || timepoints.length === 0) return null

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={C.sectionTitle}>Calendar dates</h2>
      <p style={C.hint}>
        Timepoints pinned to one date for everyone. A timepoint without a date sends nothing until
        you set one here; you can move a date for as long as it is still in the future.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        {timepoints.map(tp => (
          <TimepointDateRow key={tp.id} studyId={studyId} tp={tp} onChanged={refetch} />
        ))}
      </div>
    </div>
  )
}

function TimepointDateRow({ studyId, tp, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [date, setDate]       = useState(tp.date ?? '')
  const [time, setTime]       = useState(tp.time ?? '09:00')
  const [preview, setPreview] = useState(null)   // { mode: 'set'|'clear', result }
  const [error, setError]     = useState(null)

  const arrived = tp.date != null && `${tp.date}T${tp.time ?? '00:00'}` <= labNowKey()
  const locked  = arrived || tp.sent > 0
  const stranded = tp.date != null && tp.waiting > 0

  const call = useMutation({
    mutationFn: async ({ pDate, pTime, dryRun }) => {
      const { data, error } = await supabase.rpc('set_timepoint_date', {
        p_study_id: studyId, p_node_id: tp.id, p_date: pDate, p_time: pTime, p_dry_run: dryRun,
      })
      if (error) throw error
      return data
    },
  })

  async function review(mode) {
    setError(null)
    if (mode === 'set') {
      if (!date || !time) { setError('Choose a date and a send time.'); return }
      if (`${date}T${time}` <= labNowKey()) { setError('The date and time must be in the future (Toronto time).'); return }
    }
    try {
      const result = await call.mutateAsync({
        pDate: mode === 'set' ? date : null, pTime: mode === 'set' ? time : null, dryRun: true,
      })
      setPreview({ mode, result })
    } catch (e) {
      setError(e.message)
    }
  }

  async function confirm() {
    setError(null)
    try {
      await call.mutateAsync({
        pDate: preview.mode === 'set' ? date : null, pTime: preview.mode === 'set' ? time : null, dryRun: false,
      })
      setPreview(null); setEditing(false)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  const people = preview?.result?.participants ?? 0

  return (
    <div style={C.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <div style={C.label}>{tp.label}</div>
          <div style={{ fontSize: 15, color: tp.date ? 'var(--tx)' : 'var(--pkd)', marginTop: 2 }}>
            {fmtLong(tp.date, tp.time)}
          </div>
          <div style={C.counts}>
            {tp.date == null
              ? `${tp.waiting} participant session${tp.waiting === 1 ? '' : 's'} waiting for a date`
              : `${tp.scheduled} scheduled · ${tp.sent} sent or done`}
            {tp.skipped > 0 && ` · ${tp.skipped} skipped (enrolled after the date)`}
          </div>
        </div>
        {!editing && !locked && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={C.btnPrimary} onClick={() => { setEditing(true); setPreview(null); setError(null) }}>
              {tp.date ? 'Change date' : 'Set date'}
            </button>
            {tp.date && (
              <button style={C.btnSecondary} onClick={() => { setEditing(true); review('clear') }}>
                Back to to be determined
              </button>
            )}
          </div>
        )}
        {locked && (
          <span style={C.counts}>
            {arrived ? 'This date has arrived and can no longer be changed.' : 'Already sent — the date can no longer be changed.'}
          </span>
        )}
      </div>

      {stranded && !locked && (
        <p style={{ ...C.hint, color: 'var(--err-tx)' }}>
          {tp.waiting} session{tp.waiting === 1 ? ' is' : 's are'} still waiting although a date is set — someone
          enrolled while the date was being saved. Use Change date and confirm the same date to release {tp.waiting === 1 ? 'it' : 'them'}.
        </p>
      )}

      {editing && !preview && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
          <label style={C.field}>Date
            <input type="date" style={C.input} value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label style={C.field}>Send time (Toronto)
            <input type="time" style={C.input} value={time} onChange={e => setTime(e.target.value)} />
          </label>
          <button style={C.btnPrimary} disabled={call.isPending} onClick={() => review('set')}>Review</button>
          <button style={C.btnSecondary} onClick={() => { setEditing(false); setError(null) }}>Cancel</button>
        </div>
      )}

      {preview && (
        <div style={C.confirm}>
          {preview.mode === 'set' ? (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--tx)' }}>
              <strong>{tp.label}</strong> will be sent on <strong>{fmtLong(date, time)}</strong> to{' '}
              <strong>{people} participant{people === 1 ? '' : 's'}</strong> enrolled now, and to everyone who
              enrols before then. {people > 0 && 'Their emails go out at that time.'}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--tx)' }}>
              <strong>{tp.label}</strong> goes back to <strong>to be determined</strong> for{' '}
              <strong>{people} participant{people === 1 ? '' : 's'}</strong>. Nothing is sent until a date is set again.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={C.btnPrimary} disabled={call.isPending} onClick={confirm}>
              {call.isPending ? 'Saving…' : preview.mode === 'set' ? 'Confirm date' : 'Confirm'}
            </button>
            <button style={C.btnSecondary} disabled={call.isPending} onClick={() => { setPreview(null); if (preview.mode === 'clear') setEditing(false) }}>
              Go back
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ ...C.hint, color: 'var(--err-tx)' }}>{error}</p>}
    </div>
  )
}

const C = {
  sectionTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 22, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  hint:         { fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '6px 0 0', maxWidth: 620 },
  card:         { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 20px', maxWidth: 720 },
  label:        { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--pkd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  counts:       { fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', marginTop: 4 },
  field:        { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  input:        { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '6px 10px', color: 'var(--tx)', background: '#fff' },
  confirm:      { marginTop: 14, padding: '12px 14px', background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 10 },
  btnPrimary:   { background: 'var(--pk)', color: '#fff', border: '1px solid var(--pk)', borderRadius: 8, padding: '7px 14px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnSecondary: { background: '#fff', color: 'var(--tx2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 14px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
