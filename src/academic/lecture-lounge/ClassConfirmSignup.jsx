import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { loungePath } from '../courseRoutes'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The signup-confirmation landing page — /class/confirm?t=…&ty=…&slug=…
//
// Sibling of the Field Guide's SignInConfirm, and it exists for the same
// reason: university mail scanners fetch every link they deliver, so the
// emailed link must not BE the confirming request. This page holds the token
// hash and does nothing with it until a human presses the button. The same
// warning applies here as there: never verify inside an effect, however
// tempting the extra convenience looks — an auto-confirm on mount
// reintroduces the entire bug this page was built to end.
//
// Public, no auth guard: its whole audience is people with no session yet,
// possibly on a different device than the one they signed up on.
export default function ClassConfirmSignup() {
  const [params] = useSearchParams()
  const tokenHash = params.get('t')
  const type = params.get('ty') || 'signup'
  const slug = params.get('slug')

  // 'ready' | 'working' | 'done' | 'spent' | 'failed' | 'no-token'
  const [state, setState] = useState(tokenHash ? 'ready' : 'no-token')
  const [detail, setDetail] = useState(null)

  const backTo = slug ? loungePath(slug) : '/'

  // Once the token can no longer be needed, keep it out of history and
  // screenshots.
  const stripToken = () => {
    try { window.history.replaceState({}, '', window.location.pathname) } catch { /* ignore */ }
  }

  const confirm = async () => {
    setState('working'); setDetail(null)
    // The server names the verification type it minted; the ladder is only
    // for older emails and naming drift between gotrue versions.
    let lastErr = null
    for (const t of [...new Set([type, 'signup', 'email'])]) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: t })
      if (!error && data?.session) {
        stripToken()
        setState('done')
        // A clean load is the surest way for every guard on the class page
        // to see the fresh session.
        window.location.assign(backTo)
        return
      }
      lastErr = error
    }
    stripToken()
    // The benign worst case a confirmation token has: something (their own
    // earlier click, or a scanner that presses buttons) spent it already —
    // which CONFIRMED the account. Say so, instead of showing an error for
    // an account that works.
    if (/expired|invalid|not found|already/i.test(lastErr?.message ?? '')) {
      setState('spent')
    } else {
      setState('failed')
      setDetail(lastErr?.message ?? 'Something went wrong.')
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={S.eyebrow}>Lecture Lounge</p>

        {state === 'no-token' && (
          <>
            <h1 style={S.title}>This link is incomplete.</h1>
            <p style={S.sub}>
              Your mail app may have trimmed it. Open the email again and use the
              button, or copy the whole link into your browser.
            </p>
          </>
        )}

        {(state === 'ready' || state === 'working') && (
          <>
            <h1 style={S.title}>Confirm your account</h1>
            <p style={S.sub}>
              One tap and you're in — this extra press is what keeps automated
              mail scanners from using your link before you do.
            </p>
            <button style={S.btn} onClick={confirm} disabled={state === 'working'}>
              {state === 'working' ? 'One moment…' : 'Confirm and sign in'}
            </button>
          </>
        )}

        {state === 'done' && <p style={S.sub}>Signed in — taking you to your class…</p>}

        {state === 'spent' && (
          <>
            <h1 style={S.title}>This link isn't valid any more.</h1>
            <p style={S.sub}>
              Two harmless reasons: your account is <strong>already confirmed</strong> (sometimes
              a mail scanner presses the button first — nothing is lost, sign in with your
              password), or you signed up more than once and this is an <strong>older
              email</strong> — only the newest link works.
            </p>
            <Link to={backTo} style={S.btnLink}>Go to your class and sign in</Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <h1 style={S.title}>That didn't work.</h1>
            <p style={S.sub}>{detail}</p>
            <p style={S.sub}>
              Try signing in with your password on the class page — if that fails
              too, create your account again to get a fresh link.
            </p>
            <Link to={backTo} style={S.btnLink}>Back to the class page</Link>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  page: { background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: 'var(--bgc)', borderRadius: 16, padding: '34px 30px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 10 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', margin: '0 0 10px' },
  sub: { fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.55, margin: '0 0 14px' },
  btn: { width: '100%', fontSize: 16, fontWeight: 600, padding: '14px 18px', borderRadius: 26, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  btnLink: { display: 'inline-block', fontSize: 15, fontWeight: 600, padding: '12px 24px', borderRadius: 24, background: 'var(--pk)', color: '#fff', textDecoration: 'none' },
}
