import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

// Landing page for Supabase email confirmation links.
// Supabase appends #access_token=...&type=signup to the URL; the client
// picks those up automatically, so by the time this page renders the session
// is already being established. We just show a friendly confirmation and let
// the user click through — ProtectedRoute will route them to /welcome (new
// public user) or /dashboard from there.
export default function Verified({ session }) {
  const navigate = useNavigate()

  // Once session resolves, auto-navigate after a short pause so the message
  // is readable but the user doesn't have to click if they're paying attention.
  useEffect(() => {
    if (!session) return
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 2800)
    return () => clearTimeout(t)
  }, [session, navigate])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.icon}>✓</div>
          <h1 style={S.title}>You&rsquo;re confirmed.</h1>
          <p style={S.body}>
            Your email is verified. Welcome to RADlab — your account is ready.
          </p>
          <button style={S.btn} onClick={() => navigate('/dashboard', { replace: true })}>
            Continue to RADlab →
          </button>
          {!session && (
            <p style={S.hint}>Setting up your session…</p>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  wrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 'calc(100vh - 65px)', padding: '32px 16px',
  },
  card: {
    background: 'var(--bgc)', border: '1px solid var(--pkbs)',
    borderRadius: 24, padding: '48px 40px',
    maxWidth: 400, width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 16, textAlign: 'center',
    boxShadow: '0 8px 40px rgba(240,104,164,0.12)',
  },
  icon: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'var(--pk)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 700, fontFamily: MONO,
    boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
  },
  title: {
    fontFamily: SERIF, fontSize: 'clamp(22px, 4vw, 30px)',
    color: 'var(--tx)', margin: 0, letterSpacing: -0.5,
  },
  body: {
    fontSize: 15, color: 'var(--tx2)', lineHeight: 1.65,
    margin: 0, fontFamily: SANS,
  },
  btn: {
    marginTop: 8,
    padding: '12px 28px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.30)',
  },
  hint: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em',
    color: 'var(--tx3)', margin: 0, textTransform: 'uppercase',
  },
}
