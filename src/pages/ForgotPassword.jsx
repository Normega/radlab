import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
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
        <div style={S.wrap}>
          <div style={S.card}>
            <img src="/RADlab_Logo_light.svg" height="48" alt="RADlab" style={{ display: 'block', margin: '0 auto 20px' }} />
            <h1 style={S.title}>Check your email</h1>
            <p style={{ ...S.sub, maxWidth: 320, margin: '0 auto 24px' }}>
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
            </p>
            <Link to="/login" style={S.btnPrimary}>Back to login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <div style={S.wrap}>
        <div style={S.card}>
          <img src="/RADlab_Logo_light.svg" height="48" alt="RADlab" style={{ display: 'block', margin: '0 auto 20px' }} />
          <h1 style={S.title}>Reset your password</h1>
          <p style={S.sub}>We'll email you a link to set a new one</p>

          {error && <div style={S.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} style={S.form}>
            <div style={S.field}>
              <label style={S.label}>Email</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                style={S.input} placeholder="you@example.com"
              />
            </div>
            <button type="submit" style={S.btnPrimary} disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p style={S.footer}>
            Remembered it?{' '}
            <Link to="/login" style={{ color: 'var(--pk)', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const S = {
  wrap:  { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' },
  card:  { background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 420 },
  title: { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30, color: 'var(--tx)', textAlign: 'center', marginBottom: 6 },
  sub:   { fontSize: 14, color: 'var(--tx2)', textAlign: 'center', marginBottom: 28 },
  form:  { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' },
  input: { padding: '10px 14px', borderRadius: 9, border: '1px solid var(--bds)', background: 'var(--bgp)', fontSize: 15, color: 'var(--tx)', outline: 'none', fontFamily: 'inherit' },
  btnPrimary: { display: 'block', width: '100%', padding: '12px 0', background: 'var(--pk)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, textDecoration: 'none', textAlign: 'center' },
  errorBox: { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--err-tx)', marginBottom: 16 },
  footer: { textAlign: 'center', fontSize: 13, color: 'var(--tx2)', marginTop: 24 },
}
