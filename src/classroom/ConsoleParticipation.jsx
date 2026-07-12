import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

function lectureLabel(l) {
  const num = l.number != null ? `#${l.number} ` : ''
  return `${num}${l.lecture_date ?? ''}`.trim() || '(untitled)'
}

function csvEscape(value) {
  const str = String(value)
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function downloadCsv(filename, rows) {
  const content = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Per website.md §29's original design: matrix of members x lectures (cell
// = check-ins responded to that lecture day), CSV export keyed to
// utoronto_email with unverified rows flagged. Data comes from
// get_class_participation — profiles has no RLS letting a non-lab class
// admin read another student's utoronto_email directly, so this has to go
// through that RPC rather than a plain table query.
export default function ConsoleParticipation({ classInfo }) {
  const [data, setData] = useState(undefined) // undefined=loading, null=error
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_class_participation', { p_class_id: classInfo.id }).then(({ data: res, error }) => {
      if (cancelled) return
      if (error || res?.error) { setErrorMsg(error?.message ?? res.error); setData(null); return }
      setData(res)
    })
    return () => { cancelled = true }
  }, [classInfo.id])

  if (data === undefined) return <p style={S.hint}>Loading participation…</p>
  if (data === null) return <p style={S.error}>{errorMsg || 'Could not load participation.'}</p>

  const { members, lectures, counts } = data
  const countsMap = {}
  for (const c of counts) (countsMap[c.user_id] ??= {})[c.lecture_id] = c.count

  function handleExport() {
    const header = ['Email', 'Verified', ...lectures.map(lectureLabel)]
    const rows = members.map((m) => [
      m.utoronto_email || '(no email provided)',
      m.utoronto_verified_at ? 'Yes' : 'No',
      ...lectures.map((l) => String(countsMap[m.user_id]?.[l.id] ?? 0)),
    ])
    downloadCsv(`${classInfo.slug}-participation.csv`, [header, ...rows])
  }

  if (!members.length) {
    return <p style={S.hint}>No students have joined this class yet.</p>
  }

  return (
    <div>
      <div style={S.header}>
        <p style={S.subLabel}>{members.length} student{members.length === 1 ? '' : 's'} · {lectures.length} lecture{lectures.length === 1 ? '' : 's'}</p>
        <button style={S.exportBtn} onClick={handleExport}>Export CSV</button>
      </div>

      {!lectures.length ? (
        <p style={S.hint}>No lectures planned yet — nothing to show per-lecture.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thStudent}>Student</th>
                {lectures.map((l) => <th key={l.id} style={S.th}>{lectureLabel(l)}</th>)}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} style={S.tr}>
                  <td style={S.tdStudent}>
                    <span style={S.email}>{m.utoronto_email || '—'}</span>
                    {!m.utoronto_verified_at && <span style={S.unverifiedBadge}>unverified</span>}
                  </td>
                  {lectures.map((l) => {
                    const count = countsMap[m.user_id]?.[l.id] ?? 0
                    return <td key={l.id} style={S.td}>{count > 0 ? count : <span style={S.zero}>—</span>}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const S = {
  hint: { padding: 40, color: 'var(--tx2)', fontSize: 14, textAlign: 'center' },
  error: { padding: 40, color: '#c04a4a', fontSize: 14, textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  subLabel: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  exportBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--pkd)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', textAlign: 'center', padding: '10px 14px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' },
  thStudent: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr: { borderBottom: '1px solid var(--bd)' },
  td: { padding: '10px 14px', textAlign: 'center', fontSize: 13, color: 'var(--tx)', fontFamily: MONO },
  tdStudent: { padding: '10px 14px', fontSize: 13, color: 'var(--tx)', whiteSpace: 'nowrap' },
  email: { fontFamily: '"DM Sans",system-ui,sans-serif' },
  unverifiedBadge: { marginLeft: 8, fontFamily: MONO, fontSize: 10, color: '#b8760f', background: '#fdf2e5', padding: '2px 6px', borderRadius: 6 },
  zero: { color: 'var(--tx3)' },
}
