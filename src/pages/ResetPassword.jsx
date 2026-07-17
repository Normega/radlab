import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import CredentialsBox from '../components/ui/CredentialsBox'
import FillableBox from '../components/ui/FillableBox'
import PrimaryCTA from '../components/ui/PrimaryCTA'

// Reached via the link in the "reset password" email. Supabase's client parses
// the recovery token out of the URL on load and fires a PASSWORD_RECOVERY auth
// event once the session is established — we wait for that before showing the form.
// Restyled onto the Phase 3 CredentialsBox pattern. No exit icon mid-recovery —
// history-back would leave the temporary recovery session in a confusing state.
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

  const valid = password.length >= 8 && confirm.length >= 8

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
        <CredentialsBox title="Password updated" exit={false}>
          <p style={S.body}>
            Your password has been changed. Log in with your new password.
          </p>
          <PrimaryCTA to="/login">Go to login</PrimaryCTA>
        </CredentialsBox>
      </div>
    )
  }

  if (invalid) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={null} />
        <CredentialsBox title="Link expired" exit={false}>
          <p style={S.body}>
            This reset link is invalid or has expired. Request a new one to continue.
          </p>
          <PrimaryCTA to="/forgot-password">Request new link</PrimaryCTA>
        </CredentialsBox>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={null} />
        <CredentialsBox exit={false}>
          <p style={S.body}>Verifying your reset link…</p>
        </CredentialsBox>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <CredentialsBox title="Set a new password" tagline="Choose something you'll remember" exit={false}>
        {error && <div style={S.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <FillableBox
            label="New password"
            placeholder="8+ characters"
            type="password" required minLength={8} autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          <FillableBox
            label="Confirm password"
            placeholder="8+ characters"
            type="password" required minLength={8} autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)}
          />
          <div style={S.ctaRow}>
            <PrimaryCTA type="submit" disabled={!valid || loading}>
              {loading ? 'Saving…' : 'Set new password'}
            </PrimaryCTA>
          </div>
        </form>
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
}
