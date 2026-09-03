import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCourseClient } from './courseClient'
import { normalizeCourseCode, loungePath, joinPath, wikiBase, courseSubPath, pickNewestTerm } from './courseRoutes'
import { courseFeatures } from './courseFeatures'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// /academic/:courseCode — the course's one front door, for students and staff
// alike. Deliberately unguarded: its most important visitor is a logged-out
// student holding nothing but a QR scan.
//
// Two backends, both best-effort, neither allowed to block the other:
//  - MAIN project, anon RPC class_public_info(p_slug): the class row. This is
//    the anon-safe resolution path — the academic project's courses table only
//    exposes is_public rows to anon (PSY309 today, not PSY240).
//  - ACADEMIC project (courseClient, needs /api — absent under plain vite
//    dev): course name/term overlay, and the caller's enrollment role if an
//    academic session exists. Failure here degrades to the class-only view,
//    it must never white-screen the page.
//
// Unknown code in BOTH sources → an explicit "no such course" page, never a
// fallback to some other course (the staffCourses/courseRoutes invariant).
export default function CourseHome({ role, superAdmin }) {
  const { courseCode } = useParams()
  const code = normalizeCourseCode(courseCode)
  const feats = courseFeatures(code)

  const [cls, setCls] = useState(undefined)          // undefined=loading, null=not found
  const [course, setCourse] = useState(null)         // academic overlay {code,name,term} | null
  const [myRole, setMyRole] = useState(null)         // academic enrollment role | null
  const [fgSession, setFgSession] = useState(false)

  useEffect(() => {
    if (!code) return // rendered as not-found below without any fetch
    let cancelled = false
    supabase.rpc('class_public_info', { p_slug: code })
      .then(({ data }) => { if (!cancelled) setCls(data ?? null) })
      .catch(() => { if (!cancelled) setCls(null) })
    return () => { cancelled = true }
  }, [code])

  useEffect(() => {
    if (!code) return
    let cancelled = false
    getCourseClient().then(async (client) => {
      const { data: rows } = await client
        .from('courses').select('code, name, term').ilike('code', code)
      if (cancelled) return
      setCourse(pickNewestTerm(rows ?? []))
      const { data: { session: s } } = await client.auth.getSession()
      if (cancelled || !s) return
      setFgSession(true)
      const { data: enr } = await client
        .from('enrollments').select('role, status, courses ( code, term )')
        .eq('status', 'active')
      if (cancelled) return
      const mine = pickNewestTerm((enr ?? []).filter(
        e => String(e.courses?.code ?? '').toLowerCase() === code))
      setMyRole(mine?.role ?? null)
    }).catch(() => {}) // no /api (plain vite dev) or anon-blocked — class view only
    return () => { cancelled = true }
  }, [code])

  const isStaff = myRole === 'ta' || myRole === 'instructor'
  const isLab = role === 'lab' || superAdmin
  const known = cls || course

  const display = useMemo(() => ({
    title: course?.name ?? cls?.name ?? code?.toUpperCase(),
    term: course?.term ?? null,
  }), [cls, course, code])

  if (code && cls === undefined) {
    return <Shell code={code}><p style={S.sub}>Loading…</p></Shell>
  }

  if (!code || !known) {
    return (
      <Shell code={code}>
        <h1 style={S.title}>No such course</h1>
        <p style={S.sub}>
          Nothing here is called <code style={S.code}>{courseCode}</code>. If you scanned a
          QR code or followed a link, check it against the course syllabus.
        </p>
        <Link to="/academic" style={S.backLink}>← All courses</Link>
      </Shell>
    )
  }

  return (
    <Shell code={code}>
      <h1 style={S.title}>{display.title}</h1>
      <p style={S.sub}>
        {code.toUpperCase()}{display.term ? ` · ${display.term}` : ''}
      </p>

      {cls && (
        <Link to={loungePath(code)} style={S.card}>
          <h2 style={S.cardTitle}>Lecture Lounge</h2>
          <p style={S.sub}>Live in-lecture check-ins, the weekly wall, and your class avatar. Open this during lecture.</p>
        </Link>
      )}

      <Link to={wikiBase(code)} style={S.card}>
        <h2 style={S.cardTitle}>Field Guide</h2>
        <p style={S.sub}>{feats.gaps
          ? 'The course reference wiki — read it, report errors, claim gaps.'
          : 'The course reference wiki — read it, search it, report errors.'}</p>
      </Link>
      {fgSession ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {feats.gaps && <Link to={courseSubPath(code, 'gaps')} style={S.staffBtn}>Gap board</Link>}
          <Link to={courseSubPath(code, 'whats-new')} style={S.staffBtn}>What's new</Link>
        </div>
      ) : (
        <Link to={joinPath(code)} style={S.card}>
          <h2 style={S.cardTitle}>Sign in to the Field Guide</h2>
          <p style={S.sub}>On the roster? Enter your U of T email and a sign-in link comes to your inbox.</p>
        </Link>
      )}

      {(isStaff || isLab) && (
        <div style={{ marginTop: 26 }}>
          <p style={S.eyebrow}>staff</p>
          <div style={S.staffGrid}>
            {cls && <>
              <Link to={`${loungePath(code)}/console`} style={S.staffBtn}>Console</Link>
              <Link to={`${loungePath(code)}/remote`} style={S.staffBtn}>Remote</Link>
              <Link to={`${loungePath(code)}/screen`} style={S.staffBtn}>Screen</Link>
              <Link to={`${loungePath(code)}/slides`} style={S.staffBtn}>Slides</Link>
            </>}
            <Link to={courseSubPath(code, 'tracking')} style={S.staffBtn}>Tracking</Link>
            <Link to={courseSubPath(code, 'submissions')} style={S.staffBtn}>Submissions</Link>
            <Link to={courseSubPath(code, 'reports')} style={S.staffBtn}>Reports</Link>
            <Link to={courseSubPath(code, 'roster')} style={S.staffBtn}>Roster</Link>
            <Link to={courseSubPath(code, 'review')} style={S.staffBtn}>Review</Link>
            <Link to={courseSubPath(code, 'read')} style={S.staffBtn}>Reading queue</Link>
            <Link to={courseSubPath(code, 'corrections')} style={S.staffBtn}>Corrections</Link>
            {feats.ingest && <Link to={courseSubPath(code, 'ingest')} style={S.staffBtn}>Ingest</Link>}
          </div>
        </div>
      )}

      {isLab && (
        <p style={{ ...S.sub, marginTop: 22 }}>
          <Link to="/academic/admin" style={S.backLink}>Academic admin →</Link>
        </p>
      )}
    </Shell>
  )
}

function Shell({ code, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <p style={S.eyebrow}>
          <Link to="/academic" style={{ color: 'inherit', textDecoration: 'none' }}>radlab academic</Link>
          {code ? ` · ${code}` : ''}
        </p>
        {children}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '4px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55 },
  code: { fontFamily: MONO, fontSize: 12 },
  card: { display: 'block', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 16px', marginTop: 16, textDecoration: 'none' },
  cardTitle: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', marginBottom: 4 },
  staffGrid: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  staffBtn: { fontFamily: MONO, fontSize: 12, padding: '8px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', textDecoration: 'none' },
  backLink: { fontFamily: MONO, fontSize: 12, color: 'var(--pk)', textDecoration: 'none' },
}
