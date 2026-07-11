import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    if (!token) return
    supabase.rpc('verify_utoronto_email', { p_token: token }).then(({ data, error }) => {
      setResult(error ? { error: 'not_found' } : data)
    })
  }, [token])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={S.card}>
        <p style={S.eyebrow}>Lecture Lounge</p>
        {result === undefined && <p style={S.sub}>Verifying…</p>}
        {result?.ok && (
          <>
            <h1 style={S.title}>Email verified</h1>
            <p style={S.sub}>You're all set — this covers every class you join with this account.</p>
            {slug && (
              <Link to={`/class/${slug}`} style={S.link}>Back to class →</Link>
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
            <h1 style={S.title}>Invalid link</h1>
            <p style={S.sub}>This verification link isn't valid. Double-check you copied the whole URL.</p>
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
}
