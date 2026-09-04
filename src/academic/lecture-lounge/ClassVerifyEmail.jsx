import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { loungePath } from '../courseRoutes'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Public — no auth guard. The token click may happen on a device with no
// active radlab session, so this never depends on `session`.
export default function ClassVerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  // Verification is account-level now — the initiating class's slug travels
  // via its own query param (set by the Edge Function that sent this link)
  // purely for the "back to class" deep link, not for the RPC itself.
  const slug = searchParams.get('slug')
  const [result, setResult] = useState(() => (!token ? { error: 'not_found' } : undefined)) // undefined=loading
  // { url } = show the Continue button; 'sent' | 'already' = email fallback copy; null = nothing
  const [fieldGuide, setFieldGuide] = useState(null)
  // 'ready' until the human presses the button. This page used to verify in
  // an effect on mount — which meant any mail scanner that rendered the page
  // consumed the single-use token on the student's behalf. Their own click
  // then landed on a failure screen (for an address that WAS verified), and
  // the side effects below fired unasked. Same rule as every other emailed
  // link on the platform now: the human's press is what consumes the token.
  // Never move this back into an effect.
  const [started, setStarted] = useState(false)

  const verify = async () => {
    if (!token || started) return
    setStarted(true)
    // Verification runs through /api/fieldguide-continue, which consumes
    // the same single-use token server-side and — when the verified address
    // matches the Field Guide roster — returns a ready magic link, so the
    // success screen can offer "Continue to the Field Guide" with no second
    // email. The token press is the proof of address control either way.
    ;(async () => {
      try {
        const r = await fetch('/api/fieldguide-continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (!r.ok && r.status !== 200) throw new Error(`endpoint ${r.status}`)
        const data = await r.json()
        setResult(data?.ok ? data : (data ?? { error: 'not_found' }))
        if (data?.ok && data?.fieldGuideUrl) setFieldGuide({ url: data.fieldGuideUrl })
      } catch {
        // Endpoint unreachable — fall back to the direct RPC (verification
        // must never depend on the bridge) and the emailed-link bridge.
        const { data, error } = await supabase.rpc('verify_utoronto_email', { p_token: token })
        setResult(error ? { error: 'not_found' } : data)
        if (data?.ok && data?.email) {
          fetch('/api/roster-join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.email }),
          }).then(async (r) => {
            const body = await r.json().catch(() => ({}))
            if (r.ok && body.matched) setFieldGuide('sent')
            else if (r.status === 429 && body.matched) setFieldGuide('already')
          }).catch(() => {})
        }
      }
    })()
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={S.card}>
        <p style={S.eyebrow}>Lecture Lounge</p>
        {result === undefined && !started && (
          <>
            <h1 style={S.title}>Verify your email</h1>
            <p style={S.sub}>
              One press and it's done — this extra step is what keeps automated
              mail scanners from using your link before you do.
            </p>
            <button style={S.verifyBtn} onClick={verify}>Verify my email</button>
          </>
        )}
        {result === undefined && started && <p style={S.sub}>Verifying…</p>}
        {result?.ok && (
          <>
            <h1 style={S.title}>Email verified</h1>
            <p style={S.sub}>You're all set — this covers every class you join with this account.</p>
            {fieldGuide?.url && (
              <>
                <p style={S.sub}>
                  Your course textbook is ready too — no second email needed.
                </p>
                <a href={fieldGuide.url} style={S.fgButton}>Continue to the Field Guide →</a>
              </>
            )}
            {fieldGuide === 'sent' && (
              <p style={S.sub}>
                <strong>One more email is on its way</strong> — your sign-in link for the course
                Field Guide (your textbook), sent to the same address. One click and you're in.
              </p>
            )}
            {fieldGuide === 'already' && (
              <p style={S.sub}>
                Your Field Guide sign-in link was already sent to this address — check your
                inbox (and spam).
              </p>
            )}
            {slug && (
              <Link to={loungePath(slug)} style={S.link}>Back to class →</Link>
            )}
          </>
        )}
        {result?.error === 'expired' && (
          <>
            <h1 style={S.title}>Link expired</h1>
            <p style={S.sub}>Verification links last 24 hours. Go back to your class page to send a new one.</p>
          </>
        )}
        {result?.error === 'not_found' && (
          <>
            <h1 style={S.title}>This link isn't valid any more.</h1>
            <p style={S.sub}>
              If you (or your mail app) pressed it before, your address is most
              likely <strong>already verified</strong> — check your class page.
              Otherwise, double-check you copied the whole URL, or send a fresh
              link from the class page.
            </p>
            {slug && <Link to={loungePath(slug)} style={S.link}>Back to class →</Link>}
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 400 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  link: { display: 'inline-block', marginTop: 16, fontSize: 14, color: 'var(--pk)', fontWeight: 600, textDecoration: 'none' },
  verifyBtn: {
    width: '100%', marginTop: 14, padding: '13px 18px', borderRadius: 24, border: 'none',
    background: 'var(--pk)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  fgButton: {
    display: 'inline-block', marginTop: 12, padding: '11px 24px', borderRadius: 22,
    background: 'var(--pk)', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none',
  },
}
