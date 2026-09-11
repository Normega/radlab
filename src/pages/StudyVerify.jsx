import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ── StudyVerify (/study/verify?token=…) ───────────────────────────────────────
//
// Where the self-enrollment confirmation link lands. Public and session-free by
// necessity: the click commonly happens on a phone while the sign-up form was
// filled on a laptop, so this must never depend on an existing session.
//
// THIS PAGE IS INERT UNTIL A HUMAN PRESSES THE BUTTON. It must stay that way.
//
// Until 2026-09-11 it verified in a mount effect. University Microsoft 365 mail
// runs Defender Safe Links, which opens every URL in every message in a real,
// JavaScript-executing browser to scan it. So the scanner — not the student —
// would load this page, run the effect, consume the single-use token, create
// the enrollment and schedule, and then follow the redirect into /s/:token and
// start the participant's first session. The student's own tap still got in
// (a spent token resolves to the enrollment it already produced), but every
// session would have been opened and timed by a machine first.
//
// This path recruits U of T students only, by design — so it is the platform's
// most exposed link to exactly that scanner. The academic side hit the same bug
// on /class/verify and recorded the rule in academic.md: any email carrying a
// sign-in link must assume it is opened by a machine first, so the human's
// click has to be what consumes it. Never auto-verify in an effect here.
//
// On success it hands straight off to /s/:token, so a student still goes from
// the email to their first question with a single press.

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-signup-verify`

export default function StudyVerify() {
  const navigate = useNavigate()
  const token = new URLSearchParams(window.location.search).get('token')
  const [state, setState] = useState(token ? 'ready' : 'not_found')
  // A synchronous lock, not a state flag: setState lands on re-render, so a
  // fast double press would otherwise fire two claims for one token.
  const busyRef = useRef(false)

  // Removes the token from the address bar once it can never be used again, so
  // it does not linger in browser history or show in a screenshot — as the
  // academic side's SignInConfirm does. The in-memory `token` above is
  // unaffected. Kept on transient failures (server error, network) so a reload
  // and a second press still work.
  const stripToken = () => {
    try { window.history.replaceState({}, '', window.location.pathname) } catch { /* ignore */ }
  }
  const SPENT = new Set(['not_found', 'expired', 'link_expired', 'closed', 'withdrawn', 'already_completed'])

  async function confirm() {
    if (busyRef.current || !token) return
    busyRef.current = true
    setState('working')
    try {
      const res  = await fetch(FN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body:    JSON.stringify({ token }),
      })
      const body = await res.json()
      if (res.ok && body.token) {
        stripToken()
        navigate(`/s/${body.token}`, { replace: true })
        return
      }
      if (SPENT.has(body.error)) stripToken()
      setState(body.error ?? 'unexpected')
    } catch {
      setState('network')
    }
    // Released only on failure. On success the page navigates away; releasing
    // there would let a stray second press claim again.
    busyRef.current = false
  }

  if (state === 'ready') return (
    <Shell>
      <h1 style={S.h1}>Confirm your email</h1>
      <p style={S.body}>
        Press the button below to finish signing up. It will take you straight to your
        first session.
      </p>
      <button type="button" style={S.button} onClick={confirm}>
        Confirm and start
      </button>
      <p style={S.finePrint}>
        You are not signed up until you press this.
      </p>
    </Shell>
  )

  if (state === 'working') return (
    <Shell>
      <div style={S.spinner} />
      <h1 style={S.h1}>Setting up your session…</h1>
      <p style={S.body}>This will only take a moment.</p>
    </Shell>
  )

  const [title, message] = COPY[state] ?? COPY.unexpected
  return (
    <Shell>
      <h1 style={S.h1}>{title}</h1>
      <p style={S.body}>{message}</p>
      <p style={S.finePrint}>
        If this keeps happening, contact the study team at{' '}
        <a href="mailto:research@radlab.zone" style={S.link}>research@radlab.zone</a>.
      </p>
    </Shell>
  )
}

const COPY = {
  not_found: ['This link is not valid',
    'It may have been copied incompletely. Try opening it directly from the email rather than pasting it.'],
  expired: ['This link has expired',
    'Confirmation links last 24 hours. Please sign up again to get a fresh one.'],
  link_expired: ['Your session link has expired',
    'You are signed up — but the link to your current session has run out. A new one will be emailed when your next session is due.'],
  closed: ['This study has closed',
    'It is no longer accepting participants. Nothing has been created for you.'],
  withdrawn: ['Your participation has ended',
    'This account was withdrawn from the study, so it cannot be rejoined. Please contact the study team if you think that is a mistake.'],
  already_completed: ['You have already completed this study',
    'Thank you for taking part — there is nothing further to do.'],
  in_progress: ['This link is already being used',
    'Give it a moment and open the link again.'],
  network: ['Something went wrong',
    'We could not reach the server. Check your connection and open the link again.'],
  unexpected: ['Something went wrong',
    'We could not finish setting up your session. Please open the link again in a moment.'],
}

function Shell({ children }) {
  return (
    <>
      <style>{'@keyframes _spin { to { transform: rotate(360deg) } }'}</style>
      <div style={S.page}><div style={S.card}>
        <p style={S.brand}>RADlab · University of Toronto</p>
        {children}
      </div></div>
    </>
  )
}

const SANS  = '"DM Sans", system-ui, sans-serif'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  page:  { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS },
  card:  { maxWidth: 460, width: '100%', textAlign: 'center', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' },
  brand: { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.06em', color: 'var(--tx3)', margin: '0 0 20px' },
  h1:    { fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: 'var(--tx)', margin: '0 0 12px', lineHeight: 1.3 },
  body:  { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, margin: 0 },
  finePrint: { fontSize: 12.5, color: 'var(--tx3)', lineHeight: 1.6, margin: '18px 0 0' },
  link:  { color: 'var(--pk)' },
  button: {
    marginTop: 22, background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 24,
    padding: '12px 28px', fontSize: 15, fontWeight: 600, fontFamily: SANS, cursor: 'pointer',
  },
  spinner: { width: 38, height: 38, border: '3px solid var(--bd)', borderTop: '3px solid var(--pk)', borderRadius: '50%', animation: '_spin 0.8s linear infinite', margin: '0 auto 22px' },
}
