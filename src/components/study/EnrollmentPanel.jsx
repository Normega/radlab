// v2
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { createParticipantAccount } from '../../lib/createParticipantAccount'
import { generateSchedule } from '../../lib/scheduleGenerator'

function useEnrollments(studyId) {
  return useQuery({
    queryKey: ['enrollments', studyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_enrollments')
        .select('id, profile_id, external_id, enrolled_at, consent_date, status, notes, profiles!profile_id(display_name)')
        .eq('study_id', studyId)
        .order('enrolled_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function useScheduleForEnrollment(studyId, profileId) {
  return useQuery({
    queryKey: ['enroll-schedule', studyId, profileId],
    enabled:  !!studyId && !!profileId,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('participant_schedule')
        .select('id, study_session_id, status, completed_at, study_sessions(label, order_index, day_number)')
        .eq('participant_id', profileId)
        .eq('study_id', studyId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export default function EnrollmentPanel({ study }) {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const [showForm,    setShowForm]    = useState(false)
  const [externalId,  setExternalId]  = useState('')
  const [enrollError, setEnrollError] = useState(null)
  const [expanded,    setExpanded]    = useState(null) // enrollmentId with sessions visible

  const { data: enrollments = [], isLoading } = useEnrollments(study.id)

  const enroll = useMutation({
    mutationFn: async () => {
      const pid = externalId.trim()
      if (!pid) throw new Error('Participant ID is required.')

      const dupe = enrollments.find(
        e => e.external_id?.toLowerCase() === pid.toLowerCase() && e.status !== 'withdrawn'
      )
      if (dupe) throw new Error(`ID "${pid}" is already enrolled in this study.`)

      const { data: { user } } = await supabase.auth.getUser()
      const { userId, error: createErr } = await createParticipantAccount(pid, study.id)
      if (createErr) throw createErr

      const now = new Date().toISOString()
      const { data: enrollment, error: insertErr } = await supabase
        .from('study_enrollments')
        .insert({
          study_id:    study.id,
          profile_id:  userId,
          external_id: pid,
          enrolled_by: user.id,
          enrolled_at: now,
          consent_date: now,
          status:      'enrolled',
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr

      await generateSchedule(userId, study.id, new Date())

      return enrollment.id
    },
    onSuccess: (enrollmentId) => {
      qc.invalidateQueries({ queryKey: ['enrollments', study.id] })
      setExternalId('')
      setShowForm(false)
      setEnrollError(null)
      setExpanded(enrollmentId)
    },
    onError: (e) => setEnrollError(e.message),
  })

  const withdraw = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('study_enrollments')
        .update({ status: 'withdrawn' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments', study.id] }),
  })

  return (
    <div style={{ marginTop: 36 }}>
      <div style={S.sectionHeader}>
        <h2 style={S.sectionTitle}>Enrolled Participants</h2>
        <button style={S.btnPrimary} onClick={() => { setShowForm(v => !v); setEnrollError(null) }}>
          {showForm ? 'Cancel' : 'Enroll New Participant'}
        </button>
      </div>

      {showForm && (
        <div style={S.enrollForm}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={S.fieldLabel}>External Participant ID</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="e.g. P-001"
                value={externalId}
                onChange={e => setExternalId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enroll.mutate()}
              />
              <button
                style={{ ...S.btnPrimary, opacity: enroll.isPending ? 0.7 : 1 }}
                onClick={() => { setEnrollError(null); enroll.mutate() }}
                disabled={enroll.isPending}
              >
                {enroll.isPending ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
          </div>
          {enrollError && <p style={S.errMsg}>{enrollError}</p>}
        </div>
      )}

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : enrollments.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No participants enrolled yet.</p>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['ID', 'Enrolled', 'Consent', 'Status', 'Sessions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <React.Fragment key={e.id}>
                  <tr style={S.tr}>
                    <td style={S.td}><span style={S.mono}>{e.external_id || '—'}</span></td>
                    <td style={S.td}><span style={S.mono}>{fmtDate(e.enrolled_at)}</span></td>
                    <td style={S.td}><span style={S.mono}>{fmtDate(e.consent_date)}</span></td>
                    <td style={S.td}><StatusBadge status={e.status} /></td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        {e.status !== 'withdrawn' && (
                          <button
                            style={S.actionBtn}
                            onClick={() => setExpanded(v => v === e.id ? null : e.id)}
                          >
                            {expanded === e.id ? 'Hide sessions ▲' : 'Sessions ▼'}
                          </button>
                        )}
                        {e.status !== 'withdrawn' && (
                          <button
                            style={{ ...S.actionBtn, color: 'var(--tx3)' }}
                            onClick={() => { if (window.confirm(`Withdraw ${e.external_id}?`)) withdraw.mutate(e.id) }}
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === e.id && e.profile_id && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 0 0 24px', background: 'var(--bgp)' }}>
                        <SessionsSubrow
                          studyId={study.id}
                          enrollmentId={e.id}
                          profileId={e.profile_id}
                          navigate={navigate}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SessionsSubrow({ studyId, enrollmentId, profileId, navigate }) {
  const { data: scheduleRows = [], isLoading } = useScheduleForEnrollment(studyId, profileId)

  if (isLoading) return <p style={{ ...S.muted, padding: '12px 0' }}>Loading sessions…</p>
  if (!scheduleRows.length) return <p style={{ ...S.muted, padding: '12px 0' }}>No sessions scheduled.</p>

  return (
    <div style={{ padding: '10px 0 10px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {scheduleRows.map(row => {
        const isDone = row.status === 'completed'
        const label  = row.study_sessions?.label
          || `Day ${row.study_sessions?.day_number ?? '?'}`
        return (
          <div key={row.id} style={S.sessionChip}>
            <span style={S.sessionChipLabel}>{label}</span>
            <SessionStatusDot status={row.status} />
            {!isDone && (
              <button
                style={S.runBtn}
                onClick={() => navigate(`/admin/studies/${studyId}/session/${enrollmentId}/${row.study_session_id}`)}
              >
                Run →
              </button>
            )}
            {isDone && (
              <span style={S.doneLabel}>Done</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SessionStatusDot({ status }) {
  const color = status === 'completed' ? '#15803d' : status === 'in_progress' ? '#1d4ed8' : '#d1d5db'
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function StatusBadge({ status }) {
  const map = {
    enrolled:    { bg: '#f4f4f5', color: '#52525b' },
    in_progress: { bg: '#eff6ff', color: '#1d4ed8' },
    completed:   { bg: '#f0fdf4', color: '#15803d' },
    withdrawn:   { bg: '#fef2f2', color: '#b91c1c' },
  }
  const c = map[status] ?? map.enrolled
  return (
    <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, borderRadius: 6, padding: '2px 7px', background: c.bg, color: c.color }}>
      {status}
    </span>
  )
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const S = {
  sectionHeader:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  btnPrimary:      { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  enrollForm:      { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px' },
  fieldLabel:      { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:           { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', minWidth: 160 },
  errMsg:          { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: 0 },
  muted:           { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  empty:           { textAlign: 'center', padding: '32px 0' },
  emptyText:       { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 16, color: 'var(--tx)', margin: 0 },
  tableWrap:       { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table:           { width: '100%', borderCollapse: 'collapse' },
  th:              { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr:              { borderBottom: '1px solid var(--bd)' },
  td:              { padding: '12px 16px', verticalAlign: 'middle' },
  mono:            { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  actions:         { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn:       { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--pk)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500 },
  sessionChip:     { display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid var(--bd)', borderRadius: 8, padding: '6px 10px' },
  sessionChipLabel:{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx2)' },
  runBtn:          { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500 },
  doneLabel:       { fontFamily: '"Space Mono",monospace', fontSize: 11, color: '#15803d' },
}
