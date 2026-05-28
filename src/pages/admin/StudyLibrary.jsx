import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useStudies() {
  return useQuery({
    queryKey: ['studies-list'],
    queryFn: async () => {
      const [studiesRes, assignmentsRes, protocolsRes, consentRes] = await Promise.all([
        supabase.from('studies').select('id, name, created_at, delivery_mode').order('created_at', { ascending: false }),
        supabase.from('study_protocol_assignments').select('study_id, protocol_id'),
        supabase.from('study_protocols').select('id, label, protocol_type'),
        supabase.from('participant_consent').select('study_id').is('withdrawn_at', null),
      ])
      if (studiesRes.error) throw studiesRes.error

      const protocolById = Object.fromEntries((protocolsRes.data ?? []).map(p => [p.id, p]))
      const protocolByStudy = Object.fromEntries((assignmentsRes.data ?? []).map(a => [a.study_id, protocolById[a.protocol_id]]))
      const consentCount = (consentRes.data ?? []).reduce((acc, c) => {
        acc[c.study_id] = (acc[c.study_id] ?? 0) + 1
        return acc
      }, {})

      return (studiesRes.data ?? []).map(s => ({
        ...s,
        protocolLabel: protocolByStudy[s.id]?.label ?? '—',
        protocolType: protocolByStudy[s.id]?.protocol_type,
        participantCount: consentCount[s.id] ?? 0,
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

export default function StudyLibrary() {
  const { data: studies, isLoading } = useStudies()
  const deleteStudy = useDeleteStudy()
  const [pendingDelete, setPendingDelete] = useState(null)

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
                {['Study', 'Protocol', 'Participants', 'Created', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studies.map(s => (
                <tr key={s.id} style={S.tr}>
                  <td style={S.td}>
                    <span style={S.label}>{s.name}</span>
                    {s.deliveryMode === 'in_person' && (
                      <span style={S.inPersonBadge}>in-person</span>
                    )}
                  </td>
                  <td style={S.td}>
                    {s.deliveryMode === 'in_person'
                      ? <span style={S.proto}>—</span>
                      : <><span style={S.proto}>{s.protocolLabel}</span>{s.protocolType && <TypeBadge type={s.protocolType} />}</>
                    }
                  </td>
                  <td style={S.td}>
                    <Chip>{s.participantCount}</Chip>
                  </td>
                  <td style={S.td}><span style={S.mono}>{fmtDate(s.created_at)}</span></td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      <Link to={`/admin/studies/${s.id}`} style={S.actionBtn}>View</Link>
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
    </div>
  )
}

function TypeBadge({ type }) {
  const isScheduled = type === 'scheduled'
  return (
    <span style={{
      fontFamily: '"Space Mono",monospace', fontSize: 10, display: 'inline-block', marginLeft: 6,
      background: isScheduled ? 'var(--pkb)' : '#f0f4ff',
      color: isScheduled ? 'var(--pk)' : '#5b7be8',
      borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      {isScheduled ? 'scheduled' : 'one-time'}
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
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  confirmDeleteBtn: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500 },
  dialogError: { fontSize: 13, color: '#c0392b', margin: '12px 0 0', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
