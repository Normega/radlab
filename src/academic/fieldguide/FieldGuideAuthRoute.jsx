import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { getCourseClient } from '../courseClient'

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
  const [client, setClient] = useState(null)
  const [clientErr, setClientErr] = useState(null)
  const [session, setSession] = useState(undefined)     // undefined = loading
  const [enrollments, setEnrollments] = useState(undefined) // undefined = loading

  useEffect(() => {
    let sub
    getCourseClient()
      .then(c => {
        setClient(c)
        c.auth.getSession().then(({ data }) => setSession(data.session ?? null))
        sub = c.auth.onAuthStateChange((_e, s) => {
          setSession(s ?? null)
          setEnrollments(undefined) // new session (or sign-out) → re-check access
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
          if (!cancelled) setEnrollments(retry.error ? [] : (retry.data ?? []))
          return
        }
      }
      setEnrollments(error ? [] : (data ?? []))
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
      if (publicCourses.length) {
        return (
          <Outlet context={{
            courseClient: client,
            session: null,
            staffEnrollments: [],
            enrollments: asVisitors(publicCourses),
            isStaff: false,
          }} />
        )
      }
    }
    return <CourseLogin client={client} />
  }
  if (enrollments === undefined) {
    return <Shell><p style={S.sub}>Checking access…</p></Shell>
  }
  if (!enrollments.length) {
    // A signed-in account with no enrollment still gets the public reader
    // (their session simply matches the same anon-grade policies).
    if (publicAccess && publicCourses?.length) {
      return (
        <Outlet context={{
          courseClient: client,
          session,
          staffEnrollments: [],
          enrollments: asVisitors(publicCourses),
          isStaff: false,
        }} />
      )
    }
    return (
      <Shell>
        <h1 style={S.title}>{deniedTitle}</h1>
        <p style={S.sub}>{deniedBody(session.user.email)}</p>
        <button style={S.linkBtn} onClick={() => client.auth.signOut()}>Sign out</button>
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
  return (
    <Outlet context={{
      courseClient: client,
      session,
      staffEnrollments: enrollments,
      enrollments: [...enrollments, ...extraPublic],
      isStaff: enrollments.some(e => e.role === 'ta' || e.role === 'instructor'),
    }} />
  )
}

function CourseLogin({ client }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    const { error, data } = mode === 'signin'
      ? await client.auth.signInWithPassword({ email, password })
      // Without an explicit emailRedirectTo the confirmation link falls back to
      // the radlab-academic project's Site URL — which sent everyone to
      // localhost. Note this only works if the URL is also on that project's
      // redirect allow-list; Supabase silently falls back to Site URL if not.
      : await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${WIKI_AFTER_CONFIRM}` },
        })
    setBusy(false)
    if (error) return setNotice(error.message)
    // Signup with email confirmation enabled returns no session yet.
    if (mode === 'signup' && !data.session) {
      setNotice('Account created — check your email for a confirmation link. It will bring you back here signed in.')
      setMode('signin')
    }
  }

  return (
    <Shell>
      <h1 style={S.title}>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <p style={S.sub}>
        This is a separate account from the main radlab site — course members only.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        <input style={S.input} type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} required />
        <input style={S.input} type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} required minLength={8} />
        <button style={S.primary} type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      {notice && <p style={{ ...S.sub, color: 'var(--pk)', marginTop: 10 }}>{notice}</p>}
      <button style={S.linkBtn} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setNotice(null) }}>
        {mode === 'signin' ? 'Invited but no account yet? Sign up' : 'Already registered? Sign in'}
      </button>
      {/* WP5: students never need this form at all — their whole flow is
          email links. Point them at the join page before they try to invent
          a password. */}
      <p style={{ ...S.sub, marginTop: 14 }}>
        <b>PSY240 student?</b> You don't need a password — get a sign-in link at{' '}
        <a href="/academic/fieldguide/join" style={{ color: 'var(--pk)', textDecoration: 'none' }}>the join page</a>.
      </p>
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
  primary: { fontSize: 15, fontWeight: 600, padding: '10px 12px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  linkBtn: { marginTop: 14, fontSize: 14, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' },
}
