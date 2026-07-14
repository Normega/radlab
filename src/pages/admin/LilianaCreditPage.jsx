// SONA credit calculator for Liliana Study 3 — read-only, manual-award
// report. SONA's own auto-grant URL mechanism is all-or-nothing per study,
// so a study with prorated credit (this one, per the "10 of 12 days" rule)
// needs an RA to read the earned amount here and enter it into SONA's own
// researcher interface by hand. This page computes that amount; it does not
// submit anything to SONA. See get_liliana_credit_report (migration
// 20260714_liliana_sona_credit_report.sql) for the formula.
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useStudy(id) {
  return useQuery({
    queryKey: ['liliana-credit-study', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('studies').select('id, name').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

function useCreditReport(id) {
  return useQuery({
    queryKey: ['liliana-credit-report', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_liliana_credit_report', { p_study_id: id })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data?.participants ?? []
    },
  })
}

function downloadCSV(rows) {
  const header = ['Participant', 'SONA ID', 'Source', 'Baseline', 'Midpoint', 'Final', 'Phase 1 Days', 'Phase 2 Days', 'Total Minutes', 'Credit Hours']
  const lines = rows.map(r => [
    r.display_name ?? '',
    r.sona_identifier ?? '',
    r.external_source ?? '',
    r.baseline_completed ? 'yes' : 'no',
    r.midpoint_completed ? 'yes' : 'no',
    r.final_completed ? 'yes' : 'no',
    r.phase1_days,
    r.phase2_days,
    r.total_minutes,
    r.credit_hours,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `liliana_sona_credit_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function LilianaCreditPage() {
  const { id } = useParams()
  const { data: study, isLoading: loadingStudy } = useStudy(id)
  const { data: rows = [], isLoading, error } = useCreditReport(id)

  if (loadingStudy) return <p style={S.muted}>Loading…</p>

  return (
    <div>
      <div style={S.header}>
        <div>
          <Link to={`/admin/studies/${id}`} style={S.backLink}>← {study?.name ?? 'Study'}</Link>
          <h1 style={S.h1}>SONA Credit Report</h1>
          <p style={S.sub}>
            Computed from completed sessions — 30 min baseline, 20 min midpoint, 25 min final, 4 min per
            daily session, rounded up to the nearest half hour, capped at 3 hours. This is a manual-award
            worksheet only; nothing here is submitted to SONA. Enter the amount shown into SONA's
            researcher interface directly.
          </p>
        </div>
        {rows.length > 0 && (
          <button style={S.csvBtn} onClick={() => downloadCSV(rows)}>Export CSV</button>
        )}
      </div>

      {error && <p style={S.errMsg}>Could not load report: {error.message}</p>}

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyTitle}>No participants yet.</p>
          <p style={S.emptyHint}>This report populates once participants enroll and complete sessions.</p>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Participant', 'SONA ID', 'Baseline', 'Midpoint', 'Final', 'P1 Days', 'P2 Days', 'Credit'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.participant_id} style={S.tr}>
                  <td style={S.td}>{r.display_name ?? '—'}</td>
                  <td style={S.td}>
                    <span style={S.mono}>{r.sona_identifier ?? '—'}</span>
                    {r.external_source !== 'sona' && (
                      <span style={S.warnTag} title="Not enrolled via a SONA link — verify before crediting">
                        {r.external_source ?? 'no source'}
                      </span>
                    )}
                  </td>
                  <td style={S.td}><Check on={r.baseline_completed} /></td>
                  <td style={S.td}><Check on={r.midpoint_completed} /></td>
                  <td style={S.td}><Check on={r.final_completed} /></td>
                  <td style={S.td}><span style={S.mono}>{r.phase1_days}/12</span></td>
                  <td style={S.td}><span style={S.mono}>{r.phase2_days}/12</span></td>
                  <td style={S.td}>
                    <span style={S.creditVal}>{r.credit_hours}</span>
                    <span style={S.creditUnit}> hr</span>
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

function Check({ on }) {
  return <span style={{ color: on ? '#3b6d11' : 'var(--tx3)' }}>{on ? '✓' : '—'}</span>
}

const S = {
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  backLink:   { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  h1:         { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub:        { fontSize: 13, color: 'var(--tx2)', margin: 0, maxWidth: 640, lineHeight: 1.6 },
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
  td:         { padding: '11px 16px', verticalAlign: 'middle', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)' },
  mono:       { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  warnTag:    { marginLeft: 8, fontFamily: '"Space Mono",monospace', fontSize: 10, color: '#a15c00', background: '#fff6e5', border: '1px solid #f0d090', borderRadius: 6, padding: '1px 6px' },
  creditVal:  { fontFamily: '"Space Mono",monospace', fontSize: 15, fontWeight: 700, color: 'var(--tx)' },
  creditUnit: { fontSize: 12, color: 'var(--tx3)' },
}
