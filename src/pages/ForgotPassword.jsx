import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import CredentialsBox from '../components/ui/CredentialsBox'
import FillableBox from '../components/ui/FillableBox'
import PrimaryCTA from '../components/ui/PrimaryCTA'

// ForgotPassword — restyled onto the Phase 3 CredentialsBox pattern so the
// auth flow stays visually consistent (reached from Login's "Forgot password?").
// Same anti-enumeration success copy regardless of whether the email exists.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  const valid = EMAIL_RE.test(email)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={null} />
        <CredentialsBox title="Check your email">
          <p style={S.body}>
            If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
          </p>
          <PrimaryCTA to="/login">Back to login</PrimaryCTA>
        </CredentialsBox>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <CredentialsBox title="Reset your password" tagline="We'll email you a link to set a new one">
        {error && <div style={S.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <FillableBox
            label="Email"
            placeholder="you@example.com"
            type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <div style={S.ctaRow}>
            <PrimaryCTA type="submit" disabled={!valid || loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </PrimaryCTA>
          </div>
        </form>

        <p style={S.footer}>
          Remembered it?{' '}
          <Link to="/login" style={S.footerLink}>Log in</Link>
        </p>
      </CredentialsBox>
    </div>
  )
}

const S = {
  form: { display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingTop: 8 },
  ctaRow: { display: 'flex', justifyContent: 'center', paddingTop: 8 },
  body: {
    fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, lineHeight: 1.5,
    color: 'var(--tx2)', textAlign: 'center', margin: '0 0 16px', maxWidth: 250,
  },
  errorBox: {
    background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 12,
    padding: '10px 14px', fontSize: 13, color: 'var(--err-tx)', width: '100%', boxSizing: 'border-box',
  },
  footer: { textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', margin: '8px 0 0' },
  footerLink: { color: 'var(--pk)', textDecoration: 'none', fontWeight: 600 },
}
