import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── ParticipantsAdminTab ──────────────────────────────────────────────────────
// The "Participants" tab of /admin/users: every study enrollment, nested in
// collapsible study folders. Per participant: external id / name / enrolled
// date, schedule progress (completed·missed·remaining), the CURRENT session
// (next actionable schedule row), a manual "Send reminder" for that session's
// link (send_message accepts a lab JWT), and participant-level export links.
// Study folders link to study-level export. Reads are all lab-RLS tables —
// no new backend.

const ACTIONABLE = new Set(['unlocked', 'link_sent', 'pending'])

function useParticipantData() {
  return useQuery({
    queryKey: ['admin-participants'],
    queryFn: async () => {
      const [{ data: enrollments, error: e1 }, { data: schedule, error: e2 }] = await Promise.all([
        supabase
          .from('study_enrollments')
          .select('id, study_id, profile_id, external_id, external_source, enrolled_at, status, email_reminders, studies(id, name), profiles!study_enrollments_profile_id_fkey(display_name)')
          .order('enrolled_at', { ascending: false }),
        supabase
          .from('participant_schedule')
          .select('id, participant_id, study_id, status, scheduled_date, send_time, study_day, study_sessions(label, node_key)'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      return { enrollments: enrollments ?? [], schedule: schedule ?? [] }
    },
  })
}

function summarizeSchedule(rows) {
  const total     = rows.length
  const completed = rows.filter(r => r.status === 'completed').length
  const missed    = rows.filter(r => r.status === 'missed').length
  const blocked   = rows.filter(r => r.status === 'blocked').length
  const actionable = rows
    .filter(r => ACTIONABLE.has(r.status))
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '') || (a.study_day ?? 0) - (b.study_day ?? 0))
  const current = actionable[0] ?? null
  return { total, completed, missed, blocked, current }
}

export default function ParticipantsAdminTab() {
  const { data, isLoading, error } = useParticipantData()
  const [collapsed, setCollapsed]  = useState(null) // null = not initialized
  const [reminder, setReminder]    = useState({})   // scheduleId -> 'sending' | 'sent' | error string

  const studies = useMemo(() => {
    if (!data) return []
    const scheduleByKey = new Map()
    for (const r of data.schedule) {
      const key = `${r.participant_id}:${r.study_id}`
      if (!scheduleByKey.has(key)) scheduleByKey.set(key, [])
      scheduleByKey.get(key).push(r)
    }
    const byStudy = new Map()
    for (const en of data.enrollments) {
      const sid = en.study_id
      if (!byStudy.has(sid)) byStudy.set(sid, { id: sid, name: en.studies?.name ?? '(unnamed study)', participants: [] })
      const rows = scheduleByKey.get(`${en.profile_id}:${sid}`) ?? []
      byStudy.get(sid).participants.push({ ...en, ...summarizeSchedule(rows) })
    }
    return [...byStudy.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  // Start with every study folder collapsed.
  const closed = collapsed ?? new Set(studies.map(s => s.id))

  function toggle(id) {
    const next = new Set(closed)
    next.has(id) ? next.delete(id) : next.add(id)
    setCollapsed(next)
  }

  async function sendReminder(row) {
    const scheduleId = row.id
    setReminder(prev => ({ ...prev, [scheduleId]: 'sending' }))
    // Frame as a reminder only when the link has actually been sent already;
    // if the current row was never emailed (pending/unlocked), this button is
    // the first send and should use the normal invitation copy.
    const isReminder = row.status === 'link_sent'
    const { data: res, error: err } = await supabase.functions.invoke('send_message', {
      body: { schedule_id: scheduleId, is_reminder: isReminder },
    })
    if (err || res?.error || res?.success === false) {
      setReminder(prev => ({ ...prev, [scheduleId]: err?.message ?? res?.error ?? 'send failed' }))
    } else if (res?.suppressed) {
      setReminder(prev => ({ ...prev, [scheduleId]: 'suppressed (opted out)' }))
    } else {
      setReminder(prev => ({ ...prev, [scheduleId]: 'sent' }))
    }
  }

  if (isLoading) return <p style={S.muted}>Loading participants…</p>
  if (error)     return <p style={S.errBox}>Could not load participants: {error.message}</p>
  if (!studies.length) return <p style={S.muted}>No study enrollments yet.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {studies.map(study => {
        const open = !closed.has(study.id)
        return (
          <div key={study.id} style={S.folder}>
            <div style={S.folderHeader}>
              <button style={S.folderToggle} onClick={() => toggle(study.id)}>
                <span style={S.chevron}>{open ? '▼' : '▶'}</span>
                <span style={S.folderName}>{study.name}</span>
                <span style={S.folderCount}>{study.participants.length} participant{study.participants.length === 1 ? '' : 's'}</span>
              </button>
              <Link to={`/admin/export?study_id=${study.id}`} style={S.exportLink}>Study export →</Link>
            </div>

            {open && (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['Participant', 'Enrolled', 'Progress', 'Current session', 'Actions'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {study.participants.map(p => {
                      const remState = p.current ? reminder[p.current.id] : null
                      return (
                        <tr key={p.id} style={S.tr}>
                          <td style={S.td}>
                            <span style={S.pid}>{p.external_id ?? p.profiles?.display_name ?? p.profile_id?.slice(0, 8)}</span>
                            {p.external_source && <span style={S.srcChip}>{p.external_source}</span>}
                            {p.email_reminders === false && <span style={S.optOutChip}>email opt-out</span>}
                          </td>
                          <td style={S.td}><span style={S.mono}>{p.enrolled_at ? fmtDate(p.enrolled_at) : '—'}</span></td>
                          <td style={S.td}>
                            <span style={S.mono}>
                              {p.completed}/{p.total} done
                              {p.missed > 0 ? ` · ${p.missed} missed` : ''}
                              {p.blocked > 0 ? ` · ${p.blocked} blocked` : ''}
                            </span>
                          </td>
                          <td style={S.td}>
                            {p.current ? (
                              <span style={S.mono}>
                                {p.current.study_sessions?.label ?? `day ${p.current.study_day}`}
                                {' · '}{p.current.scheduled_date}
                                {' · '}<span style={statusStyle(p.current.status)}>{p.current.status}</span>
                              </span>
                            ) : (
                              <span style={{ ...S.mono, color: p.total ? '#3b6d11' : 'var(--tx3)' }}>
                                {p.total ? 'all sessions resolved' : 'no schedule'}
                              </span>
                            )}
                          </td>
                          <td style={S.td}>
                            <div style={S.actions}>
                              {p.current && (
                                remState === 'sending' ? <span style={S.mono}>sending…</span>
                                : remState === 'sent' ? <span style={{ ...S.mono, color: '#3b6d11' }}>sent ✓</span>
                                : remState ? <span style={{ ...S.mono, color: '#e04' }} title={remState}>{remState}</span>
                                : (
                                  <button style={S.actionBtn} onClick={() => sendReminder(p.current)}>
                                    Send reminder
                                  </button>
                                )
                              )}
                              <Link
                                to={`/admin/export?study_id=${study.id}&participant_id=${p.profile_id}`}
                                style={S.actionBtn}
                              >
                                Export
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function statusStyle(status) {
  const color = status === 'unlocked' ? '#3b6d11' : status === 'link_sent' ? '#2980b9' : 'var(--tx3)'
  return { color, fontWeight: 600 }
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const S = {
  muted:  { fontSize: 14, color: 'var(--tx3)' },
  errBox: { fontSize: 14, color: '#e04', background: '#fff5f5', border: '1px solid #fcc', borderRadius: 8, padding: '10px 14px' },
  mono:   { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  folder:       { borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' },
  folderHeader: { display: 'flex', alignItems: 'center', background: 'var(--bgp)', paddingRight: 14 },
  folderToggle: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' },
  chevron:      { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', width: 12, flexShrink: 0 },
  folderName:   { fontFamily: '"Space Mono",monospace', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx)', fontWeight: 700 },
  folderCount:  { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  exportLink:   { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: 'var(--pk)', textDecoration: 'none', whiteSpace: 'nowrap' },
  tableWrap: { overflowX: 'auto', background: '#fff' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr:        { borderBottom: '1px solid var(--bd)' },
  td:        { padding: '11px 16px', verticalAlign: 'middle' },
  pid:       { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--tx)' },
  srcChip:   { marginLeft: 8, fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 5, padding: '1px 6px', textTransform: 'uppercase' },
  optOutChip:{ marginLeft: 8, fontFamily: '"Space Mono",monospace', fontSize: 10, background: '#fef3e8', color: '#7d4f00', borderRadius: 5, padding: '1px 6px' },
  actions:   { display: 'flex', gap: 12, alignItems: 'center' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--pk)', padding: 0, textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}
