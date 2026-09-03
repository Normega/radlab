import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ── StudyVerify (/study/verify?token=…) ───────────────────────────────────────
//
// Where the self-enrollment confirmation link lands. Public and session-free by
// necessity: the click commonly happens on a phone while the sign-up form was
// filled on a laptop, so this must never depend on an existing session.
//
// The click is the moment the enrollment is actually created — everything
// before it was a request row. On success it hands straight off to /s/:token,
// the ordinary participant session entry, so a student goes from the email to
// their first question in one step.

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-signup-verify`

export default function StudyVerify() {
  const navigate = useNavigate()
  const [state, setState] = useState('working')
  // StrictMode double-invokes effects in dev, and this POST consumes a
  // single-use token — the second call would report `already`. One shot.
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) { setState('not_found'); return }

    fetch(FN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body:    JSON.stringify({ token }),
    })
      .then(r => r.json().then(body => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (ok && body.token) {
          navigate(`/s/${body.token}`, { replace: true })
          return
        }
        setState(body.error ?? 'unexpected')
      })
      .catch(() => setState('network'))
  }, [navigate])

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
  spinner: { width: 38, height: 38, border: '3px solid var(--bd)', borderTop: '3px solid var(--pk)', borderRadius: '50%', animation: '_spin 0.8s linear infinite', margin: '0 auto 22px' },
}
