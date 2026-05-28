import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { createParticipantAccount } from '../../lib/createParticipantAccount'

export default function EnrollmentPanel({ study }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [participantId, setParticipantId] = useState('')
  const [enrollError, setEnrollError] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['enrollments', study.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_enrollments')
        .select('*')
        .eq('study_id', study.id)
        .order('enrolled_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const enroll = useMutation({
    mutationFn: async () => {
      const pid = participantId.trim()
      if (!pid) throw new Error('Participant ID is required.')

      const duplicate = enrollments.find(
        e => e.participant_id.toLowerCase() === pid.toLowerCase() && e.status !== 'withdrawn'
      )
      if (duplicate) throw new Error(`ID "${pid}" is already enrolled in this study.`)

      const { data: { user } } = await supabase.auth.getUser()
      const { userId, error: createErr } = await createParticipantAccount(pid, study.id)
      if (createErr) throw createErr

      const { data: enrollment, error: insertErr } = await supabase
        .from('study_enrollments')
        .insert({
          study_id:      study.id,
          participant_id: pid,
          user_id:       userId,
          enrolled_by:   user.id,
          status:        'enrolled',
          current_step:  0,
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr

      return enrollment.id
    },
    onSuccess: (enrollmentId) => {
      qc.invalidateQueries({ queryKey: ['enrollments', study.id] })
      setParticipantId('')
      setShowForm(false)
      setEnrollError(null)
      navigate(`/admin/studies/${study.id}/session/${enrollmentId}`)
    },
    onError: (e) => setEnrollError(e.message),
  })

  const resetEnrollment = useMutation({
    mutationFn: async ({ id, toStep }) => {
      const patch = toStep != null
        ? {
            current_step:    toStep,
            completed_steps: [],
            status:          'enrolled',
            started_at:      null,
            completed_at:    null,
          }
        : {
            current_step:    0,
            completed_steps: [],
            status:          'enrolled',
            started_at:      null,
            completed_at:    null,
          }
      const { error } = await supabase.from('study_enrollments').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', study.id] })
      setResetTarget(null)
    },
  })

  const withdraw = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('study_enrollments')
        .update({ status: 'withdrawn' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', study.id] })
      setResetTarget(null)
    },
  })

  const steps = study.protocol ?? []
  const totalSteps = steps.length

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
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
                value={participantId}
                onChange={e => setParticipantId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enroll.mutate()}
              />
              <button
                style={{ ...S.btnPrimary, opacity: enroll.isPending ? 0.7 : 1 }}
                onClick={() => { setEnrollError(null); enroll.mutate() }}
                disabled={enroll.isPending}
              >
                {enroll.isPending ? 'Enrolling…' : 'Enroll & Begin Session →'}
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
                {['ID', 'Enrolled', 'Status', 'Step', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id} style={S.tr}>
                  <td style={S.td}>
                    <span style={S.mono}>{e.participant_id}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.mono}>{fmtDate(e.enrolled_at)}</span>
                  </td>
                  <td style={S.td}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td style={S.td}>
                    <span style={S.mono}>
                      {totalSteps > 0 ? `${e.current_step} of ${totalSteps}` : '—'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      {e.status !== 'withdrawn' && e.status !== 'completed' && (
                        <button
                          style={S.actionBtn}
                          onClick={() => navigate(`/admin/studies/${study.id}/session/${e.id}`)}
                        >
                          {e.status === 'enrolled' ? 'Begin' : 'Resume'}
                        </button>
                      )}
                      {e.status !== 'withdrawn' && (
                        <button
                          style={{ ...S.actionBtn, color: 'var(--tx3)' }}
                          onClick={() => setResetTarget(e)}
                        >
                          ···
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <ResetDialog
          enrollment={resetTarget}
          steps={steps}
          onReset={(toStep) => resetEnrollment.mutate({ id: resetTarget.id, toStep })}
          onWithdraw={() => withdraw.mutate(resetTarget.id)}
          onClose={() => setResetTarget(null)}
          isPending={resetEnrollment.isPending || withdraw.isPending}
        />
      )}
    </div>
  )
}

function ResetDialog({ enrollment, steps, onReset, onWithdraw, onClose, isPending }) {
  const [confirming, setConfirming] = useState(null)

  if (confirming === 'reset') {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.dialog} onClick={e => e.stopPropagation()}>
          <h3 style={S.dialogTitle}>Reset to beginning?</h3>
          <p style={S.dialogBody}>
            This will reset <strong>{enrollment.participant_id}</strong> to step 0.
            Existing task data rows are kept.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={S.cancelBtn} onClick={onClose} disabled={isPending}>Cancel</button>
            <button style={S.confirmBtn} onClick={() => onReset(null)} disabled={isPending}>
              {isPending ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (confirming === 'withdraw') {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.dialog} onClick={e => e.stopPropagation()}>
          <h3 style={S.dialogTitle}>Mark as withdrawn?</h3>
          <p style={S.dialogBody}>
            <strong>{enrollment.participant_id}</strong> will be marked as withdrawn.
            This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={S.cancelBtn} onClick={onClose} disabled={isPending}>Cancel</button>
            <button style={{ ...S.confirmBtn, background: '#b91c1c' }} onClick={onWithdraw} disabled={isPending}>
              {isPending ? 'Withdrawing…' : 'Mark withdrawn'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.dialog} onClick={e => e.stopPropagation()}>
        <h3 style={S.dialogTitle}>Options — {enrollment.participant_id}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <button style={S.menuBtn} onClick={() => setConfirming('reset')}>
            Reset to beginning
          </button>
          <button style={{ ...S.menuBtn, color: '#b91c1c' }} onClick={() => setConfirming('withdraw')}>
            Mark withdrawn
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
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
  sectionTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  btnPrimary:   { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  enrollForm:   { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px' },
  fieldLabel:   { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:        { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', minWidth: 160 },
  errMsg:       { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: 0 },
  muted:        { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  empty:        { textAlign: 'center', padding: '32px 0' },
  emptyText:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 16, color: 'var(--tx)', margin: 0 },
  tableWrap:    { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr:           { borderBottom: '1px solid var(--bd)' },
  td:           { padding: '12px 16px', verticalAlign: 'middle' },
  mono:         { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  actions:      { display: 'flex', gap: 10, alignItems: 'center' },
  actionBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--pk)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dialog:       { background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' },
  dialogTitle:  { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '0 0 10px' },
  dialogBody:   { fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 20px' },
  menuBtn:      { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer', color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif', textAlign: 'left' },
  cancelBtn:    { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  confirmBtn:   { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500 },
}
