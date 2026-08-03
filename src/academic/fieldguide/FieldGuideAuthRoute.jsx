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
export default function FieldGuideAuthRoute({ roles, deniedTitle, deniedBody }) {
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

  useEffect(() => {
    if (!client || !session) return
    let cancelled = false
    // RLS restricts enrollments to the caller's own rows; courses are
    // readable by any authenticated user, so the join resolves client-side.
    client
      .from('enrollments')
      .select('id, role, status, course_id, courses ( code, name, term )')
      .eq('status', 'active')
      .in('role', roles)
      .then(({ data, error }) => {
        if (!cancelled) setEnrollments(error ? [] : (data ?? []))
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
  if (!session) return <CourseLogin client={client} />
  if (enrollments === undefined) {
    return <Shell><p style={S.sub}>Checking access…</p></Shell>
  }
  if (!enrollments.length) {
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
  return (
    <Outlet context={{
      courseClient: client,
      session,
      staffEnrollments: enrollments,
      enrollments,
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
  linkBtn: { marginTop: 14, fontSize: 13, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' },
}
