import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { AcademicEyebrow, AcademicHeaderRow } from '../AcademicChrome'
import AvatarMenu from './AvatarMenu'
import { staffedCourses, resolveCourse } from './staffCourses.js'
import { courseFeatures } from '../courseFeatures.js'
import { supabase } from '../../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Contribution + participation tracking (/academic/:courseCode/tracking).
//
// One row per student, two data sources, one table:
//   - radlab-academic: the roster, and contribution pipeline counts via
//     contribution_tracking() (open claims / awaiting review / sent back /
//     approved — current state, not lifetime counters; the schema keeps no
//     event history)
//   - main project: Lecture Lounge participation via get_class_participation(),
//     matched to a class whose slug is the lowercased course code, joined on
//     utoronto email CLIENT-SIDE because the two projects share nothing else.
//
// The row set is the UNION of the two sides: roster students first, then any
// Lounge member the roster doesn't know (no verified email, or an email that
// matches no roster row). Those students are participating but can't earn
// credit until they verify — hiding them would hide exactly the students who
// need chasing.
//
// Per-course shape: courseFeatures(code).contributions === false (PSY309)
// drops the pipeline columns entirely — the page is then participation-only.
// The Lounge half degrades too: if the viewer's main-site session is not a
// class admin there (TAs often aren't), those columns show "—".
const norm = (e) => String(e ?? '').trim().toLowerCase().replace(/@(mail\.|alum\.)?utoronto\.ca$/, '@utoronto.ca')

export default function TrackingPage() {
  const { courseClient, staffEnrollments } = useOutletContext()
  const { courseCode } = useParams()
  const courses = useMemo(() => staffedCourses(staffEnrollments), [staffEnrollments])
  const course  = useMemo(() => resolveCourse(courses, courseCode), [courses, courseCode])
  const courseId = course?.course_id
  const feats = courseFeatures(courseCode)

  const [rows, setRows] = useState(undefined)
  const [err, setErr] = useState(null)
  const [lounge, setLounge] = useState(null)   // {byEmail, byUser, members, lectureCount} | 'unavailable'
  const [credits, setCredits] = useState(new Map())  // person_id -> {credits, last_note, last_at}
  const [creditTick, setCreditTick] = useState(0)    // bump to refetch after awarding

  // Awarding is a prompt rather than a form: it happens once in a while, from
  // this table, while looking at the student it is for. The note is required
  // by the RPC and shown to nobody but staff for now.
  const award = async (row) => {
    const note = window.prompt(
      `Exceptional participation for ${row.full_name || row.email}\n\nWhat is it for? (recorded with your name)`,
      ''
    )
    if (note == null) return
    const { error } = await courseClient.rpc('award_participation_credit', {
      p_course_id: courseId, p_person_id: row.person_id, p_note: note,
    })
    if (error) { setErr(error.message); return }
    setCreditTick((k) => k + 1)
  }

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    // .rpc() reports failure in `error` — check it.
    courseClient.rpc('contribution_tracking', { p_course_id: courseId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setErr(error.message); setRows(null); return }
      setRows(data ?? [])
    })
    // Exceptional participation — instructor-awarded credit for what the
    // pipeline cannot count (the first verified error report, say). Its own
    // fetch rather than a field on contribution_tracking, so awarding one
    // never risks the column every student is graded from. A failure here
    // leaves the column empty and the rest of the page intact.
    courseClient.rpc('participation_credits_summary', { p_course_id: courseId }).then(({ data }) => {
      if (!cancelled) setCredits(new Map((data ?? []).map((c) => [c.person_id, c])))
    })
    return () => { cancelled = true }
  }, [courseClient, courseId, creditTick])

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
      setLounge({ byEmail, byUser, members: data.members ?? [], lectureCount: (data.lectures ?? []).length })
    })()
    return () => { cancelled = true }
  }, [course, courseCode])

  // Roster rows first, then Lounge members the roster doesn't know about.
  const display = useMemo(() => {
    if (!Array.isArray(rows)) return null
    const out = rows.map(r => {
      const lg = lounge?.byEmail?.get?.(norm(r.email))
      return { key: r.roster_id, kind: 'roster', ...r,
        checkins: lg?.responded ?? null, lectures: lg?.lecturesTouched ?? null }
    })
    if (lounge?.byEmail) {
      const rosterEmails = new Set(rows.map(r => norm(r.email)))
      for (const m of lounge.members) {
        const e = m.utoronto_email ? norm(m.utoronto_email) : null
        if (e && rosterEmails.has(e)) continue
        const agg = lounge.byUser.get(m.user_id)
        out.push({
          key: `lounge:${m.user_id}`, kind: 'lounge',
          full_name: null, email: m.utoronto_email ?? null, user_id: m.user_id,
          status: m.utoronto_email ? 'lounge only' : 'no verified email',
          open_claims: 0, pending: 0, sent_back: 0, approved: 0,
          checkins: agg?.responded ?? 0, lectures: agg?.lectures.size ?? 0,
        })
      }
    }
    return out
  }, [rows, lounge])

  const totals = useMemo(() => {
    if (!Array.isArray(rows)) return null
    const t = { open_claims: 0, pending: 0, sent_back: 0, approved: 0 }
    rows.forEach(r => { for (const k in t) t[k] += r[k] })
    return t
  }, [rows])

  function exportCsv() {
    const head = ['name', 'email', 'roster_status',
      ...(feats.contributions ? ['open_claims', 'awaiting_review', 'sent_back', 'approved'] : []),
      'lounge_checkins', 'lounge_lectures', 'exceptional', 'exceptional_note']
    const lines = [head.join(',')]
    const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    for (const r of display) {
      const credit = r.person_id ? credits.get(r.person_id) : null
      lines.push([
        csv(r.full_name), r.email ?? '', r.status ?? '',
        ...(feats.contributions ? [r.open_claims, r.pending, r.sent_back, r.approved] : []),
        r.checkins ?? '', r.lectures ?? '',
        // The reason travels with the count: a bare number in a grade
        // spreadsheet is not something anyone can defend in December.
        credit?.credits ?? '', csv(credit?.last_note ?? ''),
      ].join(','))
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${courseCode}-tracking-${new Date().toISOString().slice(0, 10)}.csv`
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
      {feats.contributions ? (
        <p style={S.sub}>
          Contribution pipeline per student, plus Lecture Lounge participation where the class
          exists and you have Lounge admin access. “Sent back” is the <em>current</em> state, not a
          lifetime count. <Link to={`/academic/${courseCode}/submissions`} style={S.link}>Review queue →</Link>
        </p>
      ) : (
        <p style={S.sub}>
          Lecture Lounge participation per student: check-ins answered and distinct lectures
          touched. Students marked “no verified email” are participating but can’t be matched to
          a person until they verify a U of T address.
        </p>
      )}

      {rows === undefined && <p style={S.sub}>Loading…</p>}
      {rows === null && <p style={S.error}>{err}</p>}

      {Array.isArray(display) && (
        <>
          <div style={S.toolbar}>
            <span style={S.count}>
              {display.length} student{display.length === 1 ? '' : 's'}
              {feats.contributions && totals && ` · ${totals.pending} awaiting review · ${totals.sent_back} sent back · ${totals.approved} approved`}
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
                  {feats.contributions && <>
                    <th style={S.thNum}>Claimed</th>
                    <th style={S.thNum}>Awaiting review</th>
                    <th style={S.thNum}>Sent back</th>
                    <th style={S.thNum}>Approved</th>
                  </>}
                  <th style={S.thNum}>Check-ins</th>
                  <th style={S.thNum}>Lectures{lounge?.lectureCount ? ` /${lounge.lectureCount}` : ''}</th>
                  <th style={S.thNum} title="Instructor-awarded credit for participation the pipeline does not count">Exceptional</th>
                </tr>
              </thead>
              <tbody>
                {display.map(r => (
                  <tr key={r.key}>
                    <td style={S.td}>
                      <div>{r.full_name || (r.email ? '—' : `member ${String(r.user_id ?? '').slice(0, 8)}`)}</div>
                      {r.email && <div style={S.email}>{r.email}</div>}
                    </td>
                    <td style={{ ...S.td, fontFamily: MONO, fontSize: 12, ...(r.kind === 'lounge' ? S.dim : null) }}>{r.status}</td>
                    {feats.contributions && <>
                      <td style={S.tdNum}>{r.open_claims || ''}</td>
                      <td style={{ ...S.tdNum, ...(r.pending ? S.hot : null) }}>{r.pending || ''}</td>
                      <td style={{ ...S.tdNum, ...(r.sent_back ? S.warn : null) }}>{r.sent_back || ''}</td>
                      <td style={{ ...S.tdNum, ...(r.approved ? S.good : null) }}>{r.approved || ''}</td>
                    </>}
                    <td style={S.tdNum}>{lounge?.byEmail ? (r.checkins || '') : '—'}</td>
                    <td style={S.tdNum}>{lounge?.byEmail ? (r.lectures || '') : '—'}</td>
                    {/* The award needs a person_id, which only the Field Guide
                        rows carry — a Lounge-only row is someone with no
                        enrollment to attach a credit to. */}
                    <td style={S.tdNum}>
                      {r.person_id ? (
                        <button
                          style={credits.get(r.person_id) ? S.creditOn : S.creditOff}
                          title={credits.get(r.person_id)?.last_note ?? 'Award exceptional participation'}
                          onClick={() => award(r)}
                        >
                          {credits.get(r.person_id) ? `★ ${credits.get(r.person_id).credits}` : '+'}
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Frame>
  )
}

function Frame({ children }) {
  // Rendered only inside the staff route, so the outlet context is present.
  const { courseClient, session, isStaff } = useOutletContext()
  const { courseCode } = useParams()
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AcademicHeaderRow menu={<AvatarMenu client={courseClient} fgEmail={session.user.email} courseCode={courseCode} isStaff={isStaff} />}>
          <AcademicEyebrow to="/academic/fieldguide" suffix=" · staff" />
        </AcademicHeaderRow>
        {children}
      </div>
    </div>
  )
}

const S = {
  creditOff: { fontFamily: MONO, fontSize: 13, lineHeight: 1, padding: '3px 8px', borderRadius: 12, border: '1px solid var(--bd)', background: 'none', color: 'var(--tx3)', cursor: 'pointer' },
  creditOn: { fontFamily: MONO, fontSize: 13, lineHeight: 1, padding: '3px 8px', borderRadius: 12, border: '1px solid #b8860b', background: 'none', color: '#b8860b', cursor: 'pointer', fontWeight: 700 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 10 },
  eyebrowLink: { color: 'var(--pk)', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 30, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 720, marginBottom: 18 },
  link: { color: 'var(--pk)' },
  error: { fontSize: 14, color: '#c0392b' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  count: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  btn: {
    fontFamily: MONO, fontSize: 12, padding: '8px 16px', borderRadius: 24,
    border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12 },
  th: { textAlign: 'left', fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx2)', padding: '8px 16px', borderBottom: '2px solid var(--bd)' },
  thNum: { textAlign: 'right', fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx2)', padding: '8px 16px', borderBottom: '2px solid var(--bd)' },
  td: { padding: '8px 16px', borderBottom: '1px solid var(--bd)', fontSize: 14, color: 'var(--tx)' },
  tdNum: { padding: '8px 16px', borderBottom: '1px solid var(--bd)', fontSize: 14, color: 'var(--tx)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  email: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  dim:  { color: 'var(--tx2)' },
  hot:  { color: '#b8860b', fontWeight: 700 },
  warn: { color: '#c0392b', fontWeight: 700 },
  good: { color: '#2e7d32', fontWeight: 700 },
}
