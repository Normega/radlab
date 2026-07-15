import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useStudies() {
  return useQuery({
    queryKey: ['studies-list'],
    queryFn: async () => {
      const [studiesRes, enrollmentsRes] = await Promise.all([
        supabase.from('studies').select('id, name, created_at, delivery_mode').order('created_at', { ascending: false }),
        supabase.from('study_enrollments').select('study_id').neq('status', 'withdrawn'),
      ])
      if (studiesRes.error) throw studiesRes.error

      const enrollCount = (enrollmentsRes.data ?? []).reduce((acc, e) => {
        acc[e.study_id] = (acc[e.study_id] ?? 0) + 1
        return acc
      }, {})

      return (studiesRes.data ?? []).map(s => ({
        ...s,
        participantCount: enrollCount[s.id] ?? 0,
        deliveryMode: s.delivery_mode,
      }))
    },
  })
}

function useDeleteStudy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('studies').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studies-list'] }),
  })
}

function useDuplicateStudy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, newName }) => {
      const { data, error } = await supabase.rpc('duplicate_study', { p_study_id: id, p_new_name: newName })
      if (error) throw error
      return data // new study id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studies-list'] }),
  })
}

export default function StudyLibrary() {
  const navigate = useNavigate()
  const { data: studies, isLoading } = useStudies()
  const deleteStudy = useDeleteStudy()
  const duplicateStudy = useDuplicateStudy()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingDuplicate, setPendingDuplicate] = useState(null)
  const [duplicateName, setDuplicateName] = useState('')

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Studies</h1>
          <p style={S.sub}>Active research using your protocols.</p>
        </div>
        <Link to="/admin/studies/new" style={S.btnPrimary}>+ New Study</Link>
      </div>

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : !studies?.length ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No studies yet.</p>
          <p style={S.emptyHint}>A study enrolls participants into a protocol.</p>
          <Link to="/admin/studies/new" style={S.btnPrimary}>Launch your first one →</Link>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Study', 'Type', 'Participants', 'Created', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studies.map(s => (
                <tr key={s.id} style={S.tr}>
                  <td style={S.td}>
                    <span style={S.label}>{s.name}</span>
                  </td>
                  <td style={S.td}>
                    <DeliveryBadge mode={s.deliveryMode} />
                  </td>
                  <td style={S.td}>
                    <Chip>{s.participantCount}</Chip>
                  </td>
                  <td style={S.td}><span style={S.mono}>{fmtDate(s.created_at)}</span></td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      <Link to={`/admin/studies/${s.id}`} style={S.actionBtn}>View</Link>
                      <button
                        onClick={() => { setPendingDuplicate(s); setDuplicateName(`${s.name} (Copy)`) }}
                        style={S.actionBtn}
                      >
                        Duplicate
                      </button>
                      <button onClick={() => setPendingDelete(s)} style={S.deleteBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <div style={S.overlay} onClick={() => setPendingDelete(null)}>
          <div style={S.dialog} onClick={e => e.stopPropagation()}>
            <h2 style={S.dialogTitle}>Delete study?</h2>
            <p style={S.dialogBody}>
              <strong>{pendingDelete.name}</strong> and all its data will be permanently removed. This cannot be undone.
            </p>
            <div style={S.dialogActions}>
              <button style={S.cancelBtn} onClick={() => setPendingDelete(null)}>Cancel</button>
              <button
                style={S.confirmDeleteBtn}
                disabled={deleteStudy.isPending}
                onClick={() => {
                  deleteStudy.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })
                }}
              >
                {deleteStudy.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {deleteStudy.isError && (
              <p style={S.dialogError}>{deleteStudy.error.message}</p>
            )}
          </div>
        </div>
      )}

      {pendingDuplicate && (
        <div style={S.overlay} onClick={() => setPendingDuplicate(null)}>
          <div style={S.dialog} onClick={e => e.stopPropagation()}>
            <h2 style={S.dialogTitle}>Duplicate study</h2>
            <p style={S.dialogBody}>
              Clones <strong>{pendingDuplicate.name}</strong>'s full configuration — design, session
              templates, consent/debrief forms, screener — into a brand-new study with no
              participants, enrollments, or other data carried over.
            </p>
            <label style={S.fieldLabel}>
              New study name
              <input
                style={S.textInput}
                value={duplicateName}
                onChange={e => setDuplicateName(e.target.value)}
                autoFocus
              />
            </label>
            <div style={S.dialogActions}>
              <button style={S.cancelBtn} onClick={() => setPendingDuplicate(null)}>Cancel</button>
              <button
                style={S.btnPrimary}
                disabled={duplicateStudy.isPending || !duplicateName.trim()}
                onClick={() => {
                  duplicateStudy.mutate(
                    { id: pendingDuplicate.id, newName: duplicateName.trim() },
                    { onSuccess: (newId) => { setPendingDuplicate(null); navigate(`/admin/studies/${newId}`) } },
                  )
                }}
              >
                {duplicateStudy.isPending ? 'Duplicating…' : 'Duplicate'}
              </button>
            </div>
            {duplicateStudy.isError && (
              <p style={S.dialogError}>{duplicateStudy.error.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DeliveryBadge({ mode }) {
  const map = {
    in_person:          { label: 'in-person',     bg: '#fdf2f8', color: 'var(--pk)' },
    online_single:      { label: 'single session', bg: '#f0f4ff', color: '#5b7be8' },
    online_longitudinal:{ label: 'longitudinal',   bg: '#f0fdf4', color: '#15803d' },
  }
  const c = map[mode] ?? { label: mode ?? '—', bg: '#f4f4f5', color: '#52525b' }
  return (
    <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, background: c.bg, color: c.color, borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

function Chip({ children }) {
  return <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' }}>{children}</span>
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const S = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  muted: { fontSize: 14, color: 'var(--tx3)' },
  mono: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  label: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--tx)' },
  proto: { fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  pct: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx)' },
  archivedBadge: { display: 'inline-block', marginLeft: 8, fontFamily: '"Space Mono",monospace', fontSize: 10, background: '#f4f4f5', color: 'var(--tx3)', borderRadius: 6, padding: '2px 6px' },
  inPersonBadge: { display: 'inline-block', marginLeft: 8, fontFamily: '"Space Mono",monospace', fontSize: 10, background: '#fdf2f8', color: 'var(--pk)', borderRadius: 6, padding: '2px 6px' },
  empty: { textAlign: 'center', padding: '48px 0' },
  emptyText: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, color: 'var(--tx)', margin: '0 0 8px' },
  emptyHint: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px' },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr: { borderBottom: '1px solid var(--bd)' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  actions: { display: 'flex', gap: 10, alignItems: 'center' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#c0392b', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  dialog: { background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  dialogTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '0 0 12px' },
  dialogBody: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px', lineHeight: 1.6 },
  fieldLabel: { display: 'block', fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '0 0 20px' },
  textInput: { display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', fontSize: 14, borderRadius: 8, border: '1px solid var(--bd)', fontFamily: '"DM Sans",system-ui,sans-serif', boxSizing: 'border-box' },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  confirmDeleteBtn: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500 },
  dialogError: { fontSize: 13, color: '#c0392b', margin: '12px 0 0', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
