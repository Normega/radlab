import { useEffect, useState, useRef } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { getCourseClient } from '../courseClient'
import { normalizeCourseCode, resolveEnrolledCourse, courseSubPath, wikiBase, joinPath } from '../courseRoutes'
import Join from './Join'
import { signOutEverywhere } from '../../lib/signOutEverywhere'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Where a confirmation link lands. Any route under this guard works: the guard
// creates the course client, which consumes the token in the URL, and the
// onAuthStateChange subscription below re-renders signed in. The wiki is the
// place a confirming reader actually wanted to be.
const WIKI_AFTER_CONFIRM = '/academic/fieldguide/wiki'

// Shared auth shell for /academic/fieldguide/*. Unlike every other guard in
// the app this one authenticates against the SEPARATE radlab-academic Supabase
// project: users register directly on that project (invites seeded by
// migration turn a matching signup into an enrollment automatically).
//
// Two guards wrap it — FieldGuideStaffRoute (ta/instructor: ingest, review)
// and FieldGuideMemberRoute (any active enrollment: the wiki reader). The
// partition convention is about not sharing guards ACROSS product areas; both
// of these are the Field Guide's own, and duplicating a full sign-in flow
// between them would mean two places to fix an auth bug.
//
// Role is a coarse gate only. What a reader actually sees is decided by RLS:
// `members read published pages` vs `staff read all pages`, so the reader UI
// is written once and the database draws the line.
export default function FieldGuideAuthRoute({ roles, deniedTitle, deniedBody, publicAccess = false }) {
  // Course-scoped mounts (/academic/:courseCode/…) carry the course in the
  // URL; legacy /academic/fieldguide/* mounts don't (their shims resolve it).
  const { courseCode: courseCodeParam } = useParams()
  const courseCode = normalizeCourseCode(courseCodeParam)
  const [client, setClient] = useState(null)
  const [clientErr, setClientErr] = useState(null)
  const [session, setSession] = useState(undefined)     // undefined = loading
  const [enrollments, setEnrollments] = useState(undefined) // undefined = loading
  // Which user the access check was last run for; a token refresh for the
  // same user must not re-run it (see onAuthStateChange below).
  const lastUserId = useRef(undefined)

  useEffect(() => {
    let sub
    getCourseClient()
      .then(c => {
        setClient(c)
        c.auth.getSession().then(({ data }) => setSession(data.session ?? null))
        sub = c.auth.onAuthStateChange((_e, s) => {
          setSession(s ?? null)
          // Re-check access only when the IDENTITY changes. supabase-js fires
          // this on every token refresh — which happens when a tab regains
          // focus — and clearing enrollments swaps the whole Outlet for
          // "Checking access…", unmounting whatever the reader was doing.
          // On the gap board that discarded a half-written contribution every
          // time a student switched to the PDF they were citing (2026-09-03).
          const uid = s?.user?.id ?? null
          if (uid !== lastUserId.current) {
            lastUserId.current = uid
            setEnrollments(undefined)
          }
        }).data.subscription
      })
      .catch(err => setClientErr(err.message))
    return () => sub?.unsubscribe()
  }, [])

  // Public-course lookup (D2, 2026-08-25): a public course's published pages
  // are world-readable, so under a publicAccess guard the login form is the
  // *fallback*, shown only when there is nothing public to read. RLS decides
  // everything content-level; this guard only decides whether to demand a
  // session before rendering the reader at all.
  const [publicCourses, setPublicCourses] = useState(undefined) // undefined = loading
  useEffect(() => {
    if (!publicAccess || !client) return
    let cancelled = false
    client.from('courses').select('id, code, name, term').eq('is_public', true)
      .then(({ data }) => { if (!cancelled) setPublicCourses(data ?? []) })
    return () => { cancelled = true }
  }, [client, publicAccess])

  useEffect(() => {
    if (!client || !session) return
    let cancelled = false
    // RLS restricts enrollments to the caller's own rows; courses are
    // readable by any authenticated user, so the join resolves client-side.
    const fetchEnrollments = () => client
      .from('enrollments')
      .select('id, role, status, course_id, courses ( code, name, term )')
      .eq('status', 'active')
      .in('role', roles)

    // Sorted by course code, client-side. PostgREST cannot order on an
    // embedded table without version-specific option names, and consumers
    // that read staffEnrollments[0] were otherwise picking whichever row
    // Postgres happened to return — which for anyone staffing two courses
    // (both of Norm's identities staff PSY240 and PSY309) is arbitrary, and
    // can change after any update to those rows. Ordering here does not make
    // [0] *correct*, it only makes it stable; pages where the course matters
    // resolve it explicitly (see RosterAdmin).
    const byCourseCode = (a, b) =>
      String(a.courses?.code ?? '').localeCompare(String(b.courses?.code ?? ''))

    fetchEnrollments().then(async ({ data, error }) => {
      if (cancelled) return
      if (!error && !(data ?? []).length) {
        // WP5: a session with no enrollment is the state a roster student is
        // in the moment they click their emailed link. That click proved the
        // mailbox, which is exactly what `enrolled` means (plan §2a.4) — so
        // try the roster match once before showing "Not enrolled".
        const { data: r } = await client.rpc('enroll_from_roster')
        if (cancelled) return
        if (r?.enrolled) {
          const retry = await fetchEnrollments()
          if (!cancelled) setEnrollments(retry.error ? [] : (retry.data ?? []).slice().sort(byCourseCode))
          return
        }
      }
      setEnrollments(error ? [] : (data ?? []).slice().sort(byCourseCode))
    })
    return () => { cancelled = true }
  }, [client, session, roles])

  if (clientErr) {
    return (
      <Shell>
        <h1 style={S.title}>Course backend unreachable</h1>
        <p style={S.sub}>{clientErr}</p>
        <p style={S.sub}>Note: /api routes only exist on Vercel deploys (or `vercel dev`), not under plain `npm run dev`.</p>
      </Shell>
    )
  }
  if (!client || session === undefined) {
    return <Shell><p style={S.sub}>Loading…</p></Shell>
  }

  // Course-in-URL enforcement, applied to every Outlet below. When the mount
  // carries :courseCode, the caller must be able to address THAT course
  // (enrollment or public-visitor row); an unresolvable code gets an explicit
  // denial listing the courses they can open — never a silent swap to one of
  // them (the courseRoutes invariant). Legacy no-param mounts pass
  // course: null and their shims do the resolving.
  const renderOutlet = (ctx) => {
    if (!courseCode) return <Outlet context={{ ...ctx, course: null, courseCode: null }} />
    const course = resolveEnrolledCourse(ctx.enrollments, courseCode)
    if (!course) return <CourseDenied code={courseCode} enrollments={ctx.enrollments}
                                      email={ctx.session?.user?.email} />
    return <Outlet context={{ ...ctx, course, courseCode }} />
  }

  // Anyone not signed in: show the public reader if a public course exists,
  // the login form otherwise. Visitor "enrollments" are synthesized so the
  // reader's course machinery (useWikiCourse and friends) needs no anon path
  // of its own — RLS returns published pages only.
  const asVisitors = (cs) => cs.map(c => ({
    id: `public-${c.id}`, role: 'visitor', status: 'active', course_id: c.id,
    courses: { code: c.code, name: c.name, term: c.term },
  }))
  if (!session) {
    if (publicAccess) {
      if (publicCourses === undefined) return <Shell><p style={S.sub}>Loading…</p></Shell>
      // Serve the public reader only when the URL actually names a public
      // course (or names none at all). Without this test, a signed-OUT
      // visitor to a private course fell into the visitor branch and then hit
      // CourseDenied — telling a student with no session that their "account
      // has no access", and offering them a different course entirely. That
      // is what PSY240 students saw on any device where they had not signed
      // in yet, for as long as one public course existed (2026-09-03).
      const publicMatch = !courseCode || !!resolveEnrolledCourse(asVisitors(publicCourses), courseCode)
      if (publicCourses.length && publicMatch) {
        return renderOutlet({
          courseClient: client,
          session: null,
          staffEnrollments: [],
          enrollments: asVisitors(publicCourses),
          isStaff: false,
        })
      }
    }
    // ONE door, no password, anywhere on academic (Norm, 2026-09-05 — he
    // hit the old staff password form on /tracking). The email door now
    // vouches for staff too: roster-join falls back to active enrollments
    // (enrolled_person_by_key), so a TA or instructor typing their email
    // gets the same scanner-proof sign-in link a rostered student gets.
    // Never reintroduce a password form on this side of the platform.
    return <Join />
  }
  if (enrollments === undefined) {
    return <Shell><p style={S.sub}>Checking access…</p></Shell>
  }
  if (!enrollments.length) {
    // A signed-in account with no enrollment still gets the public reader
    // (their session simply matches the same anon-grade policies).
    if (publicAccess && publicCourses?.length) {
      return renderOutlet({
        courseClient: client,
        session,
        staffEnrollments: [],
        enrollments: asVisitors(publicCourses),
        isStaff: false,
      })
    }
    return (
      <Shell>
        <h1 style={S.title}>{deniedTitle}</h1>
        <p style={S.sub}>{deniedBody(session.user.email)}</p>
        <button style={S.linkBtn} onClick={() => signOutEverywhere(client)}>Sign out</button>
      </Shell>
    )
  }

  // `staffEnrollments` is the name the ingest portal and review queue already
  // read from context; under the member guard it is the caller's enrollments
  // whatever their role, and `isStaff` says which.
  // An enrolled reader also sees public courses they are NOT enrolled in
  // (e.g., a PSY240 student browsing the public PSY309 guide). Staff status
  // and staffEnrollments stay strictly the real enrollments.
  const extraPublic = publicAccess && publicCourses?.length
    ? asVisitors(publicCourses.filter(c => !enrollments.some(e => e.course_id === c.id)))
    : []
  return renderOutlet({
    courseClient: client,
    session,
    staffEnrollments: enrollments,
    enrollments: [...enrollments, ...extraPublic],
    isStaff: enrollments.some(e => e.role === 'ta' || e.role === 'instructor'),
  })
}

// The URL names a course this caller cannot address. List the ones they can,
// linking each to the SAME surface (segment) they were trying to reach.
function CourseDenied({ code, enrollments, email }) {
  const seen = new Map()
  for (const e of enrollments ?? []) {
    const c = e?.courses?.code
    if (c && !seen.has(c)) seen.set(c, e.courses)
  }
  const options = [...seen.values()].sort((a, b) => a.code.localeCompare(b.code))
  // /academic/:courseCode/<segment>/… → keep the segment, drop the rest.
  const segment = window.location.pathname.split('/').filter(Boolean)[2] ?? 'wiki'
  return (
    <Shell>
      <h1 style={S.title}>No access to {code.toUpperCase()}</h1>
      <p style={S.sub}>
        {email
          ? <>You are signed in as <b>{email}</b>, and that address is not on the {code.toUpperCase()} roster.
              If you enrolled with a different U&nbsp;of&nbsp;T address, {' '}
              <Link to={joinPath(code)} style={S.inlineLink}>request a sign-in link for {code.toUpperCase()}</Link>.</>
          : 'This course is not open to visitors.'}
      </p>
      {options.length > 0 && (
        <p style={{ ...S.sub, marginTop: 10 }}>You can open:</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {options.map(c => (
          <Link key={c.code} to={courseSubPath(c.code, segment)} style={S.primary}>
            {c.code}{c.term ? ` · ${c.term}` : ''}
          </Link>
        ))}
      </div>
    </Shell>
  )
}


function Shell({ children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={S.card}>
        <p style={S.eyebrow}>Field Guide</p>
        {children}
      </div>
    </div>
  )
}

const S = {
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 420, width: '100%' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  input: { fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  primary: { fontSize: 15, fontWeight: 600, padding: '10px 12px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer', textDecoration: 'none' },
  linkBtn: { marginTop: 14, fontSize: 14, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' },
  inlineLink: { color: 'var(--pk)' },
}
