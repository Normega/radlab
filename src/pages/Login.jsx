import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import CredentialsBox from '../components/ui/CredentialsBox'
import FillableBox from '../components/ui/FillableBox'
import PrimaryCTA from '../components/ui/PrimaryCTA'

// Login — Onboarding Redesign v1 (Figma 153:742 / 170:769).
// One screen: per-input validation gates the CTA (Dev Spec §3, DISSOLVE note).
// On success we stay loading — routing goes via Supabase session state
// (PublicOnlyRoute in App.jsx: new user → onboarding, returning → dashboard),
// NOT the Figma demo's hardcoded Login→Welcome wiring (brief guardrail #2).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const valid = EMAIL_RE.test(email) && password.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    // on success: stay loading — PublicOnlyRoute in App.jsx handles the redirect
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <CredentialsBox title="Welcome back" tagline="Log into your RADlab account">
        {error && <div style={S.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <FillableBox
            label="Email"
            placeholder="you@example.com"
            type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <div style={{ width: '100%' }}>
            <FillableBox
              label="Password"
              placeholder="•••••••••••"
              type="password" required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
            />
            <div style={S.forgotRow}>
              <Link to="/forgot-password" style={S.forgotLink}>Forgot password?</Link>
            </div>
          </div>
          <div style={S.ctaRow}>
            <PrimaryCTA type="submit" disabled={!valid || loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </PrimaryCTA>
          </div>
        </form>

        <p style={S.footer}>
          No account yet?{' '}
          <Link to="/signup" style={S.footerLink}>Sign up free</Link>
        </p>
      </CredentialsBox>
    </div>
  )
}

const S = {
  form: { display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingTop: 8 },
  ctaRow: { display: 'flex', justifyContent: 'center', paddingTop: 8 },
  forgotRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 4 },
  forgotLink: { fontSize: 12, color: 'var(--pk)', textDecoration: 'none', fontWeight: 600 },
  errorBox: {
    background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 12,
    padding: '10px 14px', fontSize: 13, color: 'var(--err-tx)', width: '100%', boxSizing: 'border-box',
  },
  footer: { textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', margin: '8px 0 0' },
  footerLink: { color: 'var(--pk)', textDecoration: 'none', fontWeight: 600 },
}
