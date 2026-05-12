import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useProtocols() {
  return useQuery({
    queryKey: ['study-protocols'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_protocols')
        .select(`
          id, label, protocol_type, created_at, cloned_from,
          protocol_study_days(id)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(p => ({
        ...p,
        dayCount: p.protocol_study_days?.length ?? 0,
      }))
    },
  })
}

export default function ProtocolLibrary() {
  const { data: protocols, isLoading } = useProtocols()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(null)

  const deleteProtocol = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('study_protocols').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-protocols'] }); setConfirmDelete(null) },
  })

  const cloneProtocol = useMutation({
    mutationFn: async (original) => {
      const { data: clone, error: ce } = await supabase
        .from('study_protocols')
        .insert({
          label: `${original.label} (copy)`,
          protocol_type: original.protocol_type,
          cloned_from: original.id,
        })
        .select('id').single()
      if (ce) throw ce

      const { data: days } = await supabase
        .from('protocol_study_days')
        .select('id, day_number, day_of_week, label')
        .eq('protocol_id', original.id)
        .order('day_number')

      if (days?.length) {
        for (const day of days) {
          const { data: newDay, error: de } = await supabase
            .from('protocol_study_days')
            .insert({
              protocol_id: clone.id,
              day_number: day.day_number,
              day_of_week: day.day_of_week,
              label: day.label,
            })
            .select('id').single()
          if (de) throw de

          const { data: contacts } = await supabase
            .from('protocol_day_contacts')
            .select('send_time, session_template_id, link_expires_hours, label, contact_order')
            .eq('study_day_id', day.id)
            .order('contact_order')

          if (contacts?.length) {
            const newContacts = contacts.map(c => ({
              study_day_id: newDay.id,
              send_time: c.send_time,
              session_template_id: c.session_template_id,
              link_expires_hours: c.link_expires_hours,
              label: c.label,
              contact_order: c.contact_order,
            }))
            const { error: cce } = await supabase.from('protocol_day_contacts').insert(newContacts)
            if (cce) throw cce
          }
        }
      }
      return clone.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['study-protocols'] })
      navigate(`/admin/protocols/${id}`)
    },
  })

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Protocols</h1>
          <p style={S.sub}>Session schedules that define a study's structure.</p>
        </div>
        <Link to="/admin/protocols/new" style={S.btnPrimary}>+ New Protocol</Link>
      </div>

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : !protocols?.length ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No protocols yet.</p>
          <p style={S.emptyHint}>A protocol defines the schedule and session sequence for a study.</p>
          <Link to="/admin/protocols/new" style={S.btnPrimary}>Build your first one →</Link>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Label', 'Type', 'Study days', 'Created', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {protocols.map(p => (
                <tr key={p.id} style={S.tr}>
                  <td style={S.td}><span style={S.label}>{p.label}</span></td>
                  <td style={S.td}>
                    <TypeBadge type={p.protocol_type} />
                  </td>
                  <td style={S.td}>
                    {p.protocol_type === 'single_shot'
                      ? <span style={S.muted}>One-time</span>
                      : <Chip>{p.dayCount} {p.dayCount === 1 ? 'day' : 'days'}</Chip>}
                  </td>
                  <td style={S.td}><span style={S.mono}>{fmtDate(p.created_at)}</span></td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      <Link to={`/admin/protocols/${p.id}`} style={S.actionBtn}>Edit</Link>
                      <button style={S.actionBtn} onClick={() => cloneProtocol.mutate(p)}>Clone</button>
                      <button style={{ ...S.actionBtn, color: '#e04' }} onClick={() => setConfirmDelete(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <div style={S.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={S.dialog} onClick={e => e.stopPropagation()}>
            <h2 style={S.dialogTitle}>Delete "{confirmDelete.label}"?</h2>
            <p style={S.dialogBody}>This removes the protocol and all its study days. It can't be undone.</p>
            <div style={S.dialogActions}>
              <button style={S.btnGhost} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={S.btnDanger} onClick={() => deleteProtocol.mutate(confirmDelete.id)} disabled={deleteProtocol.isPending}>
                {deleteProtocol.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
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
      fontFamily: '"Space Mono",monospace', fontSize: 10,
      background: isScheduled ? 'var(--pkb)' : '#f0f4ff',
      color: isScheduled ? 'var(--pk)' : '#5b7be8',
      borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      {isScheduled ? 'scheduled' : 'single shot'}
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
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  btnGhost: { background: 'none', border: '1px solid var(--bds)', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnDanger: { background: '#e04', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dialog: { background: '#fff', borderRadius: 14, padding: '28px 28px 24px', maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
  dialogTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, margin: '0 0 10px', color: 'var(--tx)' },
  dialogBody: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px', lineHeight: 1.6 },
  dialogActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
}
