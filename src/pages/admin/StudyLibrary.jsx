import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useStudies() {
  return useQuery({
    queryKey: ['studies-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select(`
          id, name, created_at, archived,
          study_protocol_assignments(
            study_protocols:protocol_id(id, label, protocol_type)
          ),
          participant_schedule(id, status)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(s => {
        const schedule = s.participant_schedule ?? []
        const total = schedule.length
        const completed = schedule.filter(r => r.status === 'completed').length
        const protocol = s.study_protocol_assignments?.[0]?.study_protocols
        return {
          ...s,
          protocolLabel: protocol?.label ?? '—',
          protocolType: protocol?.protocol_type,
          participantCount: new Set(schedule.map(r => r.participant_id)).size,
          total,
          completed,
        }
      })
    },
  })
}

export default function StudyLibrary() {
  const { data: studies, isLoading } = useStudies()

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
                {['Study', 'Protocol', 'Participants', 'Completion', 'Created', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studies.map(s => {
                const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : null
                return (
                  <tr key={s.id} style={S.tr}>
                    <td style={S.td}>
                      <span style={S.label}>{s.name}</span>
                      {s.archived && <span style={S.archivedBadge}>archived</span>}
                    </td>
                    <td style={S.td}>
                      <span style={S.proto}>{s.protocolLabel}</span>
                      {s.protocolType && <TypeBadge type={s.protocolType} />}
                    </td>
                    <td style={S.td}>
                      <Chip>{s.participantCount}</Chip>
                    </td>
                    <td style={S.td}>
                      {pct !== null
                        ? <span style={S.pct}>{pct}%</span>
                        : <span style={S.muted}>—</span>}
                    </td>
                    <td style={S.td}><span style={S.mono}>{fmtDate(s.created_at)}</span></td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        <Link to={`/admin/studies/${s.id}`} style={S.actionBtn}>View</Link>
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
}
