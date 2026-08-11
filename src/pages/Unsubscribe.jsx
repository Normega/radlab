import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATES = {
  loading: null,
  invalid: {
    heading: 'This link is not valid',
    body: 'If you need help, please contact your researcher.',
  },
  ripple_success: {
    heading: 'Ripple reminders off',
    body: "You'll no longer receive check-in reminder emails. You can still check in any time from your dashboard, and can re-enable reminders from your profile.",
  },
  ripple_already: {
    heading: 'Already unsubscribed',
    body: "You've already been unsubscribed from Ripple check-in reminder emails.",
  },
}

export default function Unsubscribe() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState('loading')

  useEffect(() => {
    async function run() {
      try {
        // Try Ripple first — returns { status: 'token_not_found' } (200) if not
        // a Ripple token. Ripple unsubscribes stay act-on-load: reversible from
        // the profile, and a different product from study participation.
        const { data: rData, error: rErr } = await supabase.functions.invoke('handle_ripple_unsubscribe', {
          body: { token },
        })
        if (!rErr && rData?.status && rData.status !== 'token_not_found') {
          if (rData.status === 'success')                    setState('ripple_success')
          else if (rData.status === 'already_unsubscribed') setState('ripple_already')
          else                                               setState('invalid')
          return
        }

        // Not a Ripple token — a STUDY unsubscribe. Deliberately no action
        // here (this page used to unsubscribe on load, which both acted on
        // mail-scanner prefetches and skipped the withdraw conversation):
        // hand off to /withdraw/{token}, where stopping emails and formally
        // withdrawing are both explicit button clicks. Same token, validated
        // by that page's peek.
        navigate(`/withdraw/${token}`, { replace: true })
      } catch {
        setState('invalid')
      }
    }
    run()
  }, [token, navigate])

  const content = STATES[state]

  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={S.wordmark}>RADlab</p>
        {state === 'loading' ? (
          <p style={S.body}>Processing…</p>
        ) : (
          <>
            <h1 style={S.heading}>{content.heading}</h1>
            <p style={S.body}>{content.body}</p>
          </>
        )}
      </div>
      <p style={S.footer}>Regulatory and Affective Dynamics Lab · University of Toronto Mississauga</p>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#FCF0F5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '48px 44px',
    maxWidth: 500,
    width: '100%',
    boxShadow: '0 2px 16px rgba(240,104,164,0.08)',
  },
  wordmark: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 18,
    color: '#f068a4',
    margin: '0 0 28px',
    fontWeight: 400,
  },
  heading: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 'clamp(1.4rem, 4vw, 1.8rem)',
    fontWeight: 400,
    color: '#1c1c1e',
    margin: '0 0 16px',
    lineHeight: 1.3,
  },
  body: {
    fontSize: '0.9375rem',
    lineHeight: 1.7,
    color: '#555',
    margin: 0,
  },
  footer: {
    marginTop: 32,
    fontSize: '0.75rem',
    color: '#abadb0',
    fontFamily: '"Space Mono", monospace',
    letterSpacing: '0.04em',
    textAlign: 'center',
  },
}
