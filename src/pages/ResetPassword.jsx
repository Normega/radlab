import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

// Reached via the link in the "reset password" email. Supabase's client parses
// the recovery token out of the URL on load and fires a PASSWORD_RECOVERY auth
// event once the session is established — we wait for that before showing the form.
export default function ResetPassword() {
  const [ready,    setReady]    = useState(false)
  const [invalid,  setInvalid]  = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    let isReady = false
    const markReady = () => { isReady = true; setReady(true) }

    supabase.auth.getSession().then(({ data }) => { if (data.session) markReady() })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) markReady()
    })

    const timer = setTimeout(() => { if (!isReady) setInvalid(true) }, 2500)

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }

    await supabase.auth.signOut()
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={null} />
        <div style={S.wrap}>
          <div style={S.card}>
            <img src="/RADlab_Logo_light.svg" height="48" alt="RADlab" style={{ display: 'block', margin: '0 auto 20px' }} />
            <h1 style={S.title}>Password updated</h1>
            <p style={{ ...S.sub, maxWidth: 320, margin: '0 auto 24px' }}>
              Your password has been changed. Sign in with your new password.
            </p>
            <Link to="/login" style={S.btnPrimary}>Go to login</Link>
          </div>
        </div>
      </div>
    )
  }

  if (invalid) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={null} />
        <div style={S.wrap}>
          <div style={S.card}>
            <img src="/RADlab_Logo_light.svg" height="48" alt="RADlab" style={{ display: 'block', margin: '0 auto 20px' }} />
            <h1 style={S.title}>Link expired</h1>
            <p style={{ ...S.sub, maxWidth: 320, margin: '0 auto 24px' }}>
              This reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Link to="/forgot-password" style={S.btnPrimary}>Request new link</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={null} />
        <div style={S.wrap}>
          <div style={S.card}>
            <img src="/RADlab_Logo_light.svg" height="48" alt="RADlab" style={{ display: 'block', margin: '0 auto 20px' }} />
            <p style={{ ...S.sub, textAlign: 'center' }}>Verifying your reset link…</p>
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
          <h1 style={S.title}>Set a new password</h1>
          <p style={S.sub}>Choose something you'll remember</p>

          {error && <div style={S.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} style={S.form}>
            <div style={S.field}>
              <label style={S.label}>New password</label>
              <input
                type="password" required minLength={8} autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                style={S.input} placeholder="8+ characters"
              />
            </div>
            <div style={S.field}>
              <label style={S.label}>Confirm password</label>
              <input
                type="password" required minLength={8} autoComplete="new-password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                style={S.input} placeholder="8+ characters"
              />
            </div>
            <button type="submit" style={S.btnPrimary} disabled={loading}>
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
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
}
