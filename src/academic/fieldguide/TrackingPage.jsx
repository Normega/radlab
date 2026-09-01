import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { staffedCourses, resolveCourse } from './staffCourses.js'
import { supabase } from '../../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Contribution + participation tracking (/academic/:courseCode/tracking).
//
// One row per roster student, two data sources, one table:
//   - radlab-academic: contribution pipeline counts via contribution_tracking()
//     (open claims / awaiting review / sent back / approved — current state,
//     not lifetime counters; the schema keeps no event history)
//   - main project: Lecture Lounge participation via get_class_participation(),
//     matched to a class whose slug is the lowercased course code, joined on
//     utoronto email CLIENT-SIDE because the two projects share nothing else.
// The Lounge half degrades gracefully: if the viewer's main-site session is
// not a class admin there (TAs often aren't), those columns show "—" and the
// contribution half still works.
const norm = (e) => String(e ?? '').trim().toLowerCase().replace(/@(mail\.|alum\.)?utoronto\.ca$/, '@utoronto.ca')

export default function TrackingPage() {
  const { courseClient, staffEnrollments } = useOutletContext()
  const { courseCode } = useParams()
  const courses = useMemo(() => staffedCourses(staffEnrollments), [staffEnrollments])
  const course  = useMemo(() => resolveCourse(courses, courseCode), [courses, courseCode])
  const courseId = course?.course_id

  const [rows, setRows] = useState(undefined)
  const [err, setErr] = useState(null)
  const [lounge, setLounge] = useState(null)   // Map(email -> {responded, lecturesTouched, lectureCount}) | 'unavailable'

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    // .rpc() reports failure in `error` — check it.
    courseClient.rpc('contribution_tracking', { p_course_id: courseId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setErr(error.message); setRows(null); return }
      setRows(data ?? [])
    })
    return () => { cancelled = true }
  }, [courseClient, courseId])

  useEffect(() => {
    if (!course) return
    let cancelled = false
    ;(async () => {
      const slug = String(course.courses?.code ?? courseCode).toLowerCase()
      const { data: cls } = await supabase.from('classes').select('id').eq('slug', slug).maybeSingle()
      if (cancelled) return
      if (!cls) { setLounge('unavailable'); return }
      const { data, error } = await supabase.rpc('get_class_participation', { p_class_id: cls.id })
      if (cancelled) return
      if (error || data?.error) { setLounge('unavailable'); return }
      const byUser = new Map()
      for (const c of data.counts ?? []) {
        const cur = byUser.get(c.user_id) ?? { responded: 0, lectures: new Set() }
        cur.responded += c.count
        cur.lectures.add(c.lecture_id)
        byUser.set(c.user_id, cur)
      }
      const byEmail = new Map()
      for (const m of data.members ?? []) {
        if (!m.utoronto_email) continue
        const agg = byUser.get(m.user_id)
        byEmail.set(norm(m.utoronto_email), {
          responded: agg?.responded ?? 0,
          lecturesTouched: agg?.lectures.size ?? 0,
          verified: !!m.utoronto_verified_at,
        })
      }
      setLounge({ byEmail, lectureCount: (data.lectures ?? []).length })
    })()
    return () => { cancelled = true }
  }, [course, courseCode])

  const totals = useMemo(() => {
    if (!Array.isArray(rows)) return null
    const t = { open_claims: 0, pending: 0, sent_back: 0, approved: 0 }
    rows.forEach(r => { for (const k in t) t[k] += r[k] })
    return t
  }, [rows])

  function exportCsv() {
    const head = ['name','email','roster_status','open_claims','awaiting_review','sent_back','approved','lounge_checkins','lounge_lectures']
    const lines = [head.join(',')]
    for (const r of rows) {
      const lg = lounge?.byEmail?.get(norm(r.email))
      lines.push([
        `"${(r.full_name ?? '').replace(/"/g, '""')}"`, r.email, r.status,
        r.open_claims, r.pending, r.sent_back, r.approved,
        lg ? lg.responded : '', lg ? lg.lecturesTouched : '',
      ].join(','))
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${courseCode}-tracking-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (!course) {
    return (
      <Frame>
        <h1 style={S.title}>Tracking</h1>
        <p style={S.sub}>No course called “{courseCode}” in your staffed courses.</p>
      </Frame>
    )
  }

  return (
    <Frame>
      <h1 style={S.title}>{course.courses?.code} · student tracking</h1>
      <p style={S.sub}>
        Contribution pipeline per student, plus Lecture Lounge participation where the class
        exists and you have Lounge admin access. “Sent back” is the <em>current</em> state, not a
        lifetime count. <Link to={`/academic/${courseCode}/submissions`} style={S.link}>Review queue →</Link>
      </p>

      {rows === undefined && <p style={S.sub}>Loading…</p>}
      {rows === null && <p style={S.error}>{err}</p>}

      {Array.isArray(rows) && (
        <>
          <div style={S.toolbar}>
            <span style={S.count}>
              {rows.length} on roster
              {totals && ` · ${totals.pending} awaiting review · ${totals.sent_back} sent back · ${totals.approved} approved`}
              {lounge === 'unavailable' && ' · Lounge columns unavailable (no class or no admin access)'}
            </span>
            <button style={S.btn} onClick={exportCsv}>Export CSV</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Student</th>
                  <th style={S.th}>Roster</th>
                  <th style={S.thNum}>Claimed</th>
                  <th style={S.thNum}>Awaiting review</th>
                  <th style={S.thNum}>Sent back</th>
                  <th style={S.thNum}>Approved</th>
                  <th style={S.thNum}>Check-ins</th>
                  <th style={S.thNum}>Lectures{lounge?.lectureCount ? ` /${lounge.lectureCount}` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const lg = lounge?.byEmail?.get?.(norm(r.email))
                  return (
                    <tr key={r.roster_id}>
                      <td style={S.td}>
                        <div>{r.full_name || '—'}</div>
                        <div style={S.email}>{r.email}</div>
                      </td>
                      <td style={{ ...S.td, fontFamily: MONO, fontSize: 12 }}>{r.status}</td>
                      <td style={S.tdNum}>{r.open_claims || ''}</td>
                      <td style={{ ...S.tdNum, ...(r.pending ? S.hot : null) }}>{r.pending || ''}</td>
                      <td style={{ ...S.tdNum, ...(r.sent_back ? S.warn : null) }}>{r.sent_back || ''}</td>
                      <td style={{ ...S.tdNum, ...(r.approved ? S.good : null) }}>{r.approved || ''}</td>
                      <td style={S.tdNum}>{lounge?.byEmail ? (lg?.responded || '') : '—'}</td>
                      <td style={S.tdNum}>{lounge?.byEmail ? (lg?.lecturesTouched || '') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to="/academic/fieldguide" style={S.eyebrowLink}>Field Guide</Link> · staff</p>
        {children}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 10 },
  eyebrowLink: { color: 'var(--pk)', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 30, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 720, marginBottom: 18 },
  link: { color: 'var(--pk)' },
  error: { fontSize: 14, color: '#c0392b' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  count: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  btn: {
    fontFamily: MONO, fontSize: 12, padding: '7px 14px', borderRadius: 8,
    border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12 },
  th: { textAlign: 'left', fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx2)', padding: '10px 12px', borderBottom: '2px solid var(--bd)' },
  thNum: { textAlign: 'right', fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx2)', padding: '10px 12px', borderBottom: '2px solid var(--bd)' },
  td: { padding: '9px 12px', borderBottom: '1px solid var(--bd)', fontSize: 14, color: 'var(--tx)' },
  tdNum: { padding: '9px 12px', borderBottom: '1px solid var(--bd)', fontSize: 14, color: 'var(--tx)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  email: { fontFamily: MONO, fontSize: 11, color: 'var(--tx2)' },
  hot:  { color: '#b8860b', fontWeight: 700 },
  warn: { color: '#c0392b', fontWeight: 700 },
  good: { color: '#2e7d32', fontWeight: 700 },
}
