import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getCourseClient } from '../courseClient'
import { normalizeCourseCode, joinPath, wikiBase, loungePath } from '../courseRoutes'
import { supabase as mainSupabase } from '../../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The sign-in confirmation door: /academic/:courseCode/signin?t=…&ty=…
//
// University mail runs Microsoft Defender Safe Links, which fetches every URL
// in every message to scan it. A Supabase magic link is single-use, so the
// scanner redeemed each one seconds after delivery and the student's own tap
// arrived at a spent token — six sessions minted against one student's account
// on 2026-09-04, every one from an Azure IP, none from her phone.
//
// So the emailed link no longer points at Supabase. It points HERE, carrying
// the token hash, and this page does NOTHING with it on load. A scanner
// performs a GET, receives inert HTML, and leaves the token untouched. Only a
// real click calls verifyOtp. That is the whole mechanism, and it is why this
// component must never verify inside an effect, however tempting the extra
// convenience looks — an auto-verify on mount reintroduces the entire bug.
//
// The typed code on the join door remains as the second path: the two fail
// independently, so a scanner clever enough to press buttons still cannot
// consume a code nobody typed.
export default function SignInConfirm() {
  const { courseCode } = useParams()
  const code = normalizeCourseCode(courseCode)
  const [params] = useSearchParams()
  const tokenHash = params.get('t')
  const type = params.get('ty') || 'magiclink'
  // n=lounge: this sign-in started at the Lecture Lounge's door, so the same
  // button press should finish there — Field Guide session first, then the
  // bridge mints the main-project session. One email, one press, both halves.
  const next = params.get('n')

  const [state, setState] = useState(tokenHash ? 'ready' : 'no-token')
  const [detail, setDetail] = useState(null)

  // Nothing here touches the token. It only removes it from the address bar
  // once it can no longer be needed, so it does not linger in history or in a
  // screenshot.
  const stripToken = () => {
    try { window.history.replaceState({}, '', window.location.pathname) } catch { /* ignore */ }
  }

  const confirm = async () => {
    setState('working'); setDetail(null)
    try {
      const client = await getCourseClient()
      // verification_type comes from the server that minted the token, so no
      // guessing: 'recovery' and 'magiclink' are both possible for the same
      // request depending on whether the account already existed. The
      // fallbacks cover a token minted by a path that predates this page.
      const types = [type, 'recovery', 'magiclink', 'email'].filter((t, i, a) => a.indexOf(t) === i)
      let error = null
      for (const t of types) {
        const r = await client.auth.verifyOtp({ token_hash: tokenHash, type: t })
        error = r.error
        if (!error) break
      }
      if (error) {
        setDetail(error.message)
        setState(/expired|invalid|not found/i.test(error.message) ? 'spent' : 'error')
        return
      }
      stripToken()
      if (next === 'lounge' && code) {
        // Chain the bridge: /api/lounge-continue verifies the fresh academic
        // token and returns a main-project hash this browser exchanges
        // itself. Any failure still lands on the Lounge — the bridge card
        // there is the manual retry, so a broken chain is never a dead end.
        try {
          const { data: { session } } = await client.auth.getSession()
          const rsp = await fetch('/api/lounge-continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fg_token: session?.access_token, slug: code }),
          })
          const out = await rsp.json().catch(() => ({}))
          if (rsp.ok && out.token_hash) {
            await mainSupabase.auth.verifyOtp({ token_hash: out.token_hash, type: out.type || 'magiclink' })
          }
        } catch { /* fall through to the Lounge either way */ }
        window.location.assign(loungePath(code))
        return
      }
      // Full navigation, not a router push: the guards read the academic
      // session when they mount, and a clean load is the simplest way to be
      // certain they see it.
      window.location.assign(code ? wikiBase(code) : '/academic/fieldguide/wiki')
    } catch (err) {
      setDetail(err.message)
      setState('error')
    }
  }

  useEffect(() => { if (!tokenHash) setState('no-token') }, [tokenHash])

  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={S.eyebrow}>{code ? `${code.toUpperCase()} · ` : ''}Field Guide</p>

        {state === 'ready' && (
          <>
            <h1 style={S.title}>Sign in to the Field Guide</h1>
            <p style={S.sub}>One tap and you're in — no password, ever.</p>
            <button style={S.primary} onClick={confirm}>Sign me in</button>
          </>
        )}

        {state === 'working' && (
          <>
            <h1 style={S.title}>Signing you in…</h1>
            <p style={S.sub}>One moment.</p>
          </>
        )}

        {state === 'spent' && (
          <>
            <h1 style={S.title}>That link has already been used</h1>
            <p style={S.sub}>
              Sign-in links work once. This usually means you've already signed in on this
              device, or a newer email has replaced this one. Getting a fresh one takes a moment.
            </p>
            <Link to={joinPath(code ?? 'psy240')} style={S.primaryLink}>Send me a new one</Link>
          </>
        )}

        {state === 'no-token' && (
          <>
            <h1 style={S.title}>This link is incomplete</h1>
            <p style={S.sub}>
              It may have been cut short by your email app. Request a new one and open it from the
              email rather than copying the address by hand.
            </p>
            <Link to={joinPath(code ?? 'psy240')} style={S.primaryLink}>Send me a new one</Link>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 style={S.title}>That didn't work</h1>
            <p style={S.sub}>{detail ?? 'Something went wrong signing you in.'}</p>
            <Link to={joinPath(code ?? 'psy240')} style={S.primaryLink}>Try again</Link>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  page: { background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' },
  card: { maxWidth: 460, width: '100%', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 10 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8, lineHeight: 1.2 },
  sub: { fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 18 },
  primary: { width: '100%', fontSize: 16, fontWeight: 600, padding: '14px 16px', borderRadius: 26, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  primaryLink: { display: 'inline-block', fontSize: 15, fontWeight: 600, padding: '12px 22px', borderRadius: 24, background: 'var(--pk)', color: '#fff', textDecoration: 'none' },
}
