import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <p style={S.eyebrow}>{code ? `${code.toUpperCase()} · ` : ''}Field Guide</p>
        <h1 style={S.title}>Join the Field Guide</h1>

        {state === 'sent' ? (
          <div style={S.box}>
            <p style={S.big}>Check your email.</p>
            <p style={S.sub}>
              A sign-in link is on its way to your U of T address. Click it and you'll land in the
              guide, signed in — no password, ever. If it doesn't arrive within a few minutes, check
              spam, then try again.
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
  big: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', margin: '0 0 8px' },
  box: { marginTop: 18, padding: '18px 20px', borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  input: { width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  primary: { marginTop: 12, width: '100%', fontSize: 15, fontWeight: 600, padding: '12px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  primaryOff: { marginTop: 12, width: '100%', fontSize: 15, fontWeight: 600, padding: '12px 16px', borderRadius: 24, border: 'none', background: 'var(--bd)', color: 'var(--tx2)', cursor: 'not-allowed' },
  err: { marginTop: 12, fontSize: 14, color: 'var(--pk)' },
  link: { color: 'var(--pk)', textDecoration: 'none' },
}
