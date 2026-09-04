import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCourseClient } from '../courseClient'
import { normalizeCourseCode, coursePath } from '../courseRoutes'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The QR / self-serve door (plan §2a): deliberately public — no client, no
// session — because its whole job is to get a student their FIRST session.
// One field, one guarantee: a roster match sends a sign-in link to the U of T
// address on file; clicking that link is what enrolls (§2a.4 — the form
// proves someone typed an email, the click proves they own the mailbox).
//
// This is also the permanent sign-in path (requirement 5): an enrolled
// student comes back here any time, enters their email, and gets a fresh
// link. No passwords exist on this path at all.
export default function Join() {
  // Mounted at BOTH /academic/:courseCode/join (canonical) and the immortal
  // /academic/fieldguide/join (printed on lecture-slide QR codes and in every
  // invite email — that mount never sunsets). The course only affects the
  // header and the staff link; the roster match itself is by email, and the
  // server resolves each row's own course.
  const { courseCode } = useParams()
  const code = normalizeCourseCode(courseCode)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState(null) // null | 'sent' | 'unmatched' | {error}
  // The code path exists because university mail scanners follow every link in
  // every message, and a magic link is single-use: by the time the student
  // taps it, the scanner has spent it. A typed code cannot be consumed that
  // way. The link still ships as a fallback for personal mailboxes.
  const [otp, setOtp] = useState('')
  const [otpErr, setOtpErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setState(null)
    try {
      const rsp = await fetch('/api/roster-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // courseCode scopes the roster match to this door's course when two
        // rosters carry the same address; the server still falls back to the
        // cross-course match, so a student at the "wrong" door gets their own
        // course rather than a refusal.
        body: JSON.stringify(code ? { email, courseCode: code.toUpperCase() } : { email }),
      })
      const body = await rsp.json().catch(() => ({}))
      if (rsp.status === 429) setState({ error: body.error })
      else if (!rsp.ok) setState({ error: body.error ?? `Something went wrong (${rsp.status})` })
      else setState(body.matched ? 'sent' : 'unmatched')
    } catch {
      setState({ error: 'Network error — try again.' })
    }
    setBusy(false)
  }

  const verify = async (e) => {
    e.preventDefault()
    const token = otp.replace(/\D/g, '')
    // Length is NOT assumed. The code is whatever the project's OTP setting
    // mints — observed at seven digits here, not the six the docs imply — so
    // requiring six rejected a valid code (2026-09-04).
    if (token.length < 4) return setOtpErr('Enter the code from the email.')
    setBusy(true); setOtpErr(null)
    try {
      const client = await getCourseClient()
      // 'recovery' FIRST, and that is not a guess: for an existing confirmed
      // user, generateLink({type:'magiclink'}) stores the token in the
      // recovery slot — auth.one_time_tokens records it as recovery_token and
      // recovery_sent_at is what moves. Verifying as 'magiclink' therefore
      // never matched. The others stay as fallbacks for tokens minted by a
      // different path (a brand-new user, or a future change here).
      let error = null
      for (const type of ['recovery', 'magiclink', 'email']) {
        const r = await client.auth.verifyOtp({ email, token, type })
        error = r.error
        if (!error) break
      }
      if (error) {
        setOtpErr(/expired|invalid/i.test(error.message)
          ? 'That code was not accepted — it may have expired, or a newer code has replaced it. Request another and use the most recent email.'
          : error.message)
      } else {
        // The guard re-renders signed in; land them in the guide.
        window.location.assign(code ? `/academic/${code}/wiki` : '/academic/fieldguide/wiki')
        return
      }
    } catch (err) {
      setOtpErr(err.message)
    }
    setBusy(false)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <p style={S.eyebrow}>{code ? `${code.toUpperCase()} · ` : ''}Field Guide</p>
        <h1 style={S.title}>Join the Field Guide</h1>

        {state === 'sent' ? (
          <div style={S.box}>
            <p style={S.big}>Check your email for a sign-in code.</p>
            <p style={S.sub}>
              Tap the button in the email, or type the code from it below — either signs you in,
              no password, ever. Both last an hour. If nothing arrives within a few minutes,
              check spam, then request another.
            </p>
            <form onSubmit={verify} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="code from the email"
                maxLength={12}
                style={{ ...S.input, flex: '1 1 140px', fontFamily: 'monospace', fontSize: 20, letterSpacing: 3, textAlign: 'center' }}
              />
              <button type="submit"
                      style={{ ...S.primary, marginTop: 0, width: 'auto', flex: '0 0 auto', padding: '12px 24px' }}
                      disabled={busy}>
                {busy ? 'Checking…' : 'Sign in'}
              </button>
            </form>
            {otpErr && <p style={{ ...S.sub, color: '#c0392b', marginTop: 8 }}>{otpErr}</p>}
            <p style={{ ...S.sub, fontSize: 13, marginTop: 12 }}>
              The email also has a button you can just tap — either way works, so use whichever
              is easier on the device you're holding.
            </p>
          </div>
        ) : state === 'unmatched' ? (
          <div style={S.box}>
            <p style={S.big}>We couldn't match that address.</p>
            <p style={S.sub}>
              The roster uses your <b>U of T email</b> (…@mail.utoronto.ca). If you entered a
              personal address, try the university one. If your U of T address still doesn't match —
              for example you enrolled in the course this week — tell the instructor or a TA and
              they'll add you. Your attempt has been logged so they can see it.
            </p>
          </div>
        ) : (
          <>
            <p style={S.sub}>
              Enter your <b>U of T email address</b>. If you're on the course roster, we'll email you
              a sign-in link — clicking it is all it takes. This is also how you sign back in later.
            </p>
            <form onSubmit={submit} style={{ marginTop: 18 }}>
              <input
                style={S.input}
                type="email"
                placeholder="you@mail.utoronto.ca"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
              <button style={busy || !email.trim() ? S.primaryOff : S.primary} disabled={busy || !email.trim()}>
                {busy ? 'Checking the roster…' : 'Email me a sign-in link'}
              </button>
            </form>
            {state?.error && <p style={S.err}>{state.error}</p>}
          </>
        )}

        <p style={{ ...S.sub, marginTop: 26, fontSize: 14 }}>
          Staff sign in with their password at <Link to={code ? coursePath(code) : '/academic/fieldguide'} style={S.link}>the Field Guide home</Link>.
        </p>
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 32, color: 'var(--tx)', margin: '6px 0 10px' },
  sub: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6 },
  big: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '0 0 8px' },
  box: { marginTop: 18, padding: '18px 20px', borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  input: { width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  primary: { marginTop: 12, width: '100%', fontSize: 15, fontWeight: 600, padding: '12px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  primaryOff: { marginTop: 12, width: '100%', fontSize: 15, fontWeight: 600, padding: '12px 16px', borderRadius: 24, border: 'none', background: 'var(--bd)', color: 'var(--tx2)', cursor: 'not-allowed' },
  err: { marginTop: 12, fontSize: 14, color: 'var(--pk)' },
  link: { color: 'var(--pk)', textDecoration: 'none' },
}
