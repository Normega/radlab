import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/dashboard')
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <div style={S.wrap}>
        <div style={S.card}>
          <img src="/RADlab_Logo_light.svg" height="48" alt="RADlab" style={{ display: 'block', margin: '0 auto 20px' }} />
          <h1 style={S.title}>Welcome back</h1>
          <p style={S.sub}>Log in to your RADlab account</p>

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
            <div style={S.field}>
              <label style={S.label}>Password</label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                style={S.input} placeholder="••••••••"
              />
            </div>
            <button type="submit" style={S.btnPrimary} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={S.footer}>
            No account yet?{' '}
            <Link to="/signup" style={{ color: 'var(--pk)', textDecoration: 'none', fontWeight: 500 }}>
              Sign up free
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
  label: { fontFamily: '"Space Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' },
  input: { padding: '10px 14px', borderRadius: 9, border: '1px solid var(--bds)', background: 'var(--bgp)', fontSize: 15, color: 'var(--tx)', outline: 'none', fontFamily: 'inherit' },
  btnPrimary: { padding: '12px 0', background: 'var(--pk)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
  errorBox: { background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#A32D2D', marginBottom: 16 },
  footer: { textAlign: 'center', fontSize: 13, color: 'var(--tx2)', marginTop: 24 },
}
