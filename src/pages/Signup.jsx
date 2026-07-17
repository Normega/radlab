import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import CredentialsBox from '../components/ui/CredentialsBox'
import FillableBox from '../components/ui/FillableBox'
import PrimaryCTA from '../components/ui/PrimaryCTA'

// Signup/Join — Onboarding Redesign v1 (Figma 153:321 / 153:866).
// One screen: the Inactive→Active pair is per-input validation gating the CTA
// (Dev Spec §3, DISSOLVE note), not two screens. Done-state renders the
// Signup/EmailConfirmation design (153:560) with the real entered email.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Signup() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const valid = name.trim().length > 0 && EMAIL_RE.test(email) && password.length >= 8

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: window.location.origin + '/verified',
      },
    })

    setLoading(false)
    if (error) { setError(error.message); return }

    // Supabase anti-enumeration: signUp with an already-registered, confirmed
    // email returns a success-shaped response (no error, NO email sent) with
    // an empty identities array. Without this check the user sees "check your
    // email" and nothing ever arrives.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('already_registered')
      return
    }

    setDone(true)
  }

  // Signup/EmailConfirmation (Figma 153:560) — real email, never the [email] placeholder.
  if (done) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={null} />
        <CredentialsBox title="Check your email">
          <p style={S.confirmBody}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then come back to log in.
          </p>
          <PrimaryCTA to="/login">Go to login</PrimaryCTA>
        </CredentialsBox>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <CredentialsBox title="Join RADlab" tagline="Free-to-play perception games">
        {error === 'already_registered' ? (
          <div style={S.errorBox}>
            This email is already registered.{' '}
            <Link to="/login" style={{ color: 'inherit', fontWeight: 600 }}>Log in</Link>
            {' '}or{' '}
            <Link to="/forgot-password" style={{ color: 'inherit', fontWeight: 600 }}>reset your password</Link>.
          </div>
        ) : error && <div style={S.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <FillableBox
            label="Display name"
            placeholder="e.g. neuroqueen88"
            description="This is what appears on leaderboards"
            type="text" required
            value={name} onChange={e => setName(e.target.value)}
          />
          <FillableBox
            label="Email"
            placeholder="you@example.com"
            type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <FillableBox
            label="Password"
            placeholder="8+ characters"
            type="password" required minLength={8} autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          <div style={S.ctaRow}>
            <PrimaryCTA type="submit" disabled={!valid || loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </PrimaryCTA>
          </div>
        </form>

        <p style={S.footer}>
          Already have an account?{' '}
          <Link to="/login" style={S.footerLink}>Log in</Link>
        </p>
      </CredentialsBox>
    </div>
  )
}

const S = {
  form: { display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingTop: 8 },
  ctaRow: { display: 'flex', justifyContent: 'center', paddingTop: 8 },
  confirmBody: {
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
