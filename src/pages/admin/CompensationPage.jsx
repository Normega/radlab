import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function useCompensation() {
  return useQuery({
    queryKey: ['compensation-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_compensation')
        .select('id, participant_id, compensation_type, email, sona_id, created_at, studies(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function downloadCSV(rows) {
  const header = ['Study', 'Participant ID', 'Date', 'Time', 'Type', 'Email / SONA ID']
  const lines = rows.map(r => [
    r.studies?.name ?? '',
    r.participant_id ?? '',
    fmtDate(r.created_at),
    fmtTime(r.created_at),
    r.compensation_type,
    r.compensation_type === 'pay' ? (r.email ?? '') : (r.sona_id ?? ''),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `compensation_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function CompensationPage() {
  const { data: rows = [], isLoading, error } = useCompensation()

  return (
    <div>
      <div style={S.header}>
        <div>
          <Link to="/admin" style={S.backLink}>← Admin</Link>
          <h1 style={S.h1}>Compensation</h1>
          <p style={S.sub}>Participants who have completed the compensation form.</p>
        </div>
        {rows.length > 0 && (
          <button style={S.csvBtn} onClick={() => downloadCSV(rows)}>
            Export CSV
          </button>
        )}
      </div>

      {error && (
        <p style={S.errMsg}>Could not load records: {error.message}</p>
      )}

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyTitle}>No compensation records yet.</p>
          <p style={S.emptyHint}>Records appear here after participants complete the Compensation Form step.</p>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Study', 'Participant ID', 'Date', 'Time', 'Type', 'Email / SONA ID'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={S.tr}>
                  <td style={S.td}>
                    <span style={S.studyName}>{r.studies?.name ?? '—'}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.mono}>{r.participant_id ?? '—'}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.mono}>{fmtDate(r.created_at)}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.mono}>{fmtTime(r.created_at)}</span>
                  </td>
                  <td style={S.td}>
                    <TypeBadge type={r.compensation_type} />
                  </td>
                  <td style={S.td}>
                    <span style={S.mono}>
                      {r.compensation_type === 'pay' ? (r.email ?? '—') : (r.sona_id ?? '—')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TypeBadge({ type }) {
  const styles = {
    pay:    { bg: '#f0fdf4', color: '#15803d' },
    credit: { bg: '#eff6ff', color: '#1d4ed8' },
  }
  const s = styles[type] ?? { bg: '#f4f4f5', color: '#52525b' }
  return (
    <span style={{
      fontFamily: '"Space Mono",monospace', fontSize: 10,
      borderRadius: 6, padding: '2px 7px',
      background: s.bg, color: s.color,
    }}>
      {type === 'pay' ? 'pay' : 'credit'}
    </span>
  )
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const S = {
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  backLink:   { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  h1:         { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub:        { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  csvBtn:     { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap', alignSelf: 'flex-end' },
  errMsg:     { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  muted:      { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  empty:      { textAlign: 'center', padding: '60px 0' },
  emptyTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, color: 'var(--tx)', margin: '0 0 8px' },
  emptyHint:  { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  tableWrap:  { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
  tr:         { borderBottom: '1px solid var(--bd)' },
  td:         { padding: '11px 16px', verticalAlign: 'middle' },
  studyName:  { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx)' },
  mono:       { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx2)' },
}
