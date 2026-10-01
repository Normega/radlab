import { useState } from 'react'

// ── OpenEmailGate ────────────────────────────────────────────────────────────
// The open-recruitment route's email step (studies.open_join_slug, e.g.
// Liliana Study 3 — Paid). SessionEntry shows it after a PASSED screener, in
// place of the consent gate, for enrollments with external_source 'open' and
// no contact email yet.
//
// It does not let the session continue in this browser. open-join emails the
// link to the address given and retires the one this page holds, so the only
// way forward is through that inbox -- which is what makes the address real.
// @mail.utoronto.ca only: the study is for U of T students.

const STUDENT_EMAIL = /^[a-z0-9._%+'-]+@mail\.utoronto\.ca$/i

export default function OpenEmailGate({ token }) {
  const [email,   setEmail]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState(null)
  const [sentTo,  setSentTo]  = useState(null)

  const trimmed  = email.trim()
  const valid    = STUDENT_EMAIL.test(trimmed)
  const matches  = trimmed !== '' && trimmed.toLowerCase() === confirm.trim().toLowerCase()
  const canSend  = valid && matches && !busy

  async function submit() {
    if (!canSend) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/open-join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body:    JSON.stringify({ action: 'submit_email', token, email: trimmed }),
      })
      const data = await r.json()
      if (data.status === 'sent' || data.status === 'already_sent') {
        setSentTo(data.status === 'sent' ? trimmed : 'your U of T email address')
        setBusy(false)
        return
      }
      setError(data.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('A network error occurred. Please check your connection and try again.')
    }
    setBusy(false)
  }

  if (sentTo) {
    return (
      <div style={S.wrap}>
        <h1 style={S.title}>Check your U of T email</h1>
        <p style={S.body}>
          You’re eligible, thank you! We’ve sent a link to <strong>{sentTo}</strong>. Open it to read
          the consent form and, if you agree to take part, begin the first session (about 30 minutes).
        </p>
        <p style={S.muted}>
          It can take a few minutes to arrive. If you don’t see it, check your junk or quarantine folder.
          You can close this page.
        </p>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <h1 style={S.title}>You’re eligible to take part</h1>
      <p style={S.body}>
        Enter your U of T student email address and we’ll send you the link to start. Your daily
        session links and your payment (by Interac e-transfer) will also go to this address.
      </p>
      <p style={S.muted}>Only addresses ending in <strong>@mail.utoronto.ca</strong> are accepted.</p>

      <label style={S.label}>
        U of T student email
        <input
          type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="firstname.lastname@mail.utoronto.ca"
          style={S.input}
        />
      </label>
      {trimmed && !valid && <p style={S.hint}>This must be a U of T student address ending in @mail.utoronto.ca.</p>}

      <label style={S.label}>
        Type it again
        <input
          type="email" autoComplete="off" value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          style={S.input}
        />
      </label>
      {confirm && !matches && <p style={S.hint}>The two addresses don’t match yet.</p>}

      <button style={{ ...S.btn, opacity: canSend ? 1 : 0.5 }} onClick={submit} disabled={!canSend}>
        {busy ? 'Sending…' : 'Send me the link'}
      </button>
      {error && <p style={S.error}>{error}</p>}
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
const S = {
  wrap:  { maxWidth: 520, width: '100%', padding: '40px 24px', boxSizing: 'border-box' },
  title: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 14px' },
  body:  { fontFamily: FONT, fontSize: 16, color: 'var(--tx)', lineHeight: 1.6, margin: '0 0 12px' },
  muted: { fontFamily: FONT, fontSize: 14, color: 'var(--tx3)', lineHeight: 1.6, margin: '0 0 20px' },
  label: { display: 'block', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: 'var(--tx)', margin: '0 0 14px' },
  input: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '11px 12px', fontSize: 16, fontFamily: FONT, border: '1px solid var(--bd)', borderRadius: 8, background: '#fff' },
  hint:  { fontFamily: FONT, fontSize: 13, color: '#8a5568', margin: '-8px 0 14px' },
  btn:   { marginTop: 6, padding: '13px 26px', borderRadius: 8, border: '1px solid var(--pk)', background: 'var(--pk)', color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' },
  error: { fontFamily: FONT, fontSize: 14, color: '#b91c1c', margin: '12px 0 0', lineHeight: 1.5 },
}
