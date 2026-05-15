import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATES = {
  loading: null,
  success: {
    heading: "You've been unsubscribed",
    body: "You'll no longer receive email reminders for this study. You can still participate by clicking any session links you receive.",
  },
  blocked: {
    heading: 'Email reminders are required for this study',
    body: "Email reminders are part of your participation agreement for this study. If you'd like to withdraw from the study entirely, please contact your researcher directly.",
  },
  invalid: {
    heading: 'This link is not valid',
    body: 'If you need help, please contact your researcher.',
  },
  already: {
    heading: 'Already unsubscribed',
    body: "You've already been unsubscribed from email reminders for this study.",
  },
}

export default function Unsubscribe() {
  const { token } = useParams()
  const [state, setState] = useState('loading')

  useEffect(() => {
    async function run() {
      try {
        const { data, error } = await supabase.functions.invoke('handle_unsubscribe', {
          body: { token },
        })
        if (error) {
          setState('invalid')
          return
        }
        if (data?.status === 'success')            setState('success')
        else if (data?.status === 'blocked')       setState('blocked')
        else if (data?.status === 'already_unsubscribed') setState('already')
        else                                        setState('invalid')
      } catch {
        setState('invalid')
      }
    }
    run()
  }, [token])

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
