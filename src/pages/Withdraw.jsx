import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Participant-initiated formal withdrawal, reached from the link on lapsed
// session emails. Unlike Unsubscribe.jsx, NOTHING happens on page load — the
// initial request is a read-only peek (no confirm flag), and the withdrawal
// only fires from the explicit button click. Inbox link-scanners prefetch
// email URLs; an unsubscribe that fires on load is recoverable, a withdrawal
// is not.

export default function Withdraw() {
  const { token } = useParams()
  const [state, setState] = useState('loading')
  const [studyName, setStudyName] = useState('this study')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [unsubMsg, setUnsubMsg] = useState(null)

  useEffect(() => {
    async function peek() {
      try {
        const { data, error } = await supabase.functions.invoke('handle_withdraw', {
          body: { token },
        })
        if (error) { setState('invalid'); return }
        if (data?.study_name) setStudyName(data.study_name)
        if (data?.status === 'ok_to_withdraw')       setState('confirm')
        else if (data?.status === 'already_withdrawn') setState('already')
        else if (data?.status === 'already_complete')  setState('complete')
        else                                           setState('invalid')
      } catch {
        setState('invalid')
      }
    }
    peek()
  }, [token])

  // The lighter exit — stop study emails, keep the enrollment. Same
  // click-gating rationale as withdrawal: this page is reached from email
  // links, so nothing may act on load.
  async function stopEmails() {
    setBusy(true)
    setUnsubMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('handle_unsubscribe', {
        body: { token },
      })
      if (!error && data?.status === 'success')                  setState('unsub_done')
      else if (!error && data?.status === 'already_unsubscribed') setUnsubMsg("You're already unsubscribed from this study's emails.")
      else if (!error && data?.status === 'blocked')             setUnsubMsg('Email reminders are part of your participation agreement for this study, so they can’t be turned off on their own. If you no longer wish to take part, you can formally withdraw above, or contact your researcher.')
      else                                                       setUnsubMsg('Something went wrong — please try again or contact your researcher.')
    } catch {
      setUnsubMsg('Something went wrong — please try again or contact your researcher.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmWithdraw() {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('handle_withdraw', {
        body: { token, confirm: true, note: note.trim() || undefined },
      })
      if (!error && data?.status === 'success')            setState('success')
      else if (!error && data?.status === 'already_withdrawn') setState('already')
      else                                                 setState('error')
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={S.wordmark}>RADlab</p>

        {state === 'loading' && <p style={S.body}>Loading…</p>}

        {state === 'confirm' && (
          <>
            <h1 style={S.heading}>Withdraw from {studyName}?</h1>
            <p style={S.body}>
              Withdrawing formally ends your participation: you'll stop receiving
              session emails, and your remaining sessions will be cancelled. This
              can't be undone from this page.
            </p>
            <p style={{ ...S.body, marginTop: 12 }}>
              If you'd rather keep going, just close this page — your next
              check-in email will arrive as scheduled, and completing any
              check-in picks things right back up.
            </p>
            <p style={{ ...S.body, marginTop: 12 }}>
              If you have questions about credit or compensation, please contact
              your researcher before withdrawing.
            </p>
            <label style={S.noteLabel}>
              If you're comfortable sharing, we'd value knowing why — it helps us
              design studies that fit people's lives better. (Optional.)
              <textarea
                style={S.noteBox}
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Your reason (optional)"
              />
            </label>
            <button style={S.withdrawBtn} onClick={confirmWithdraw} disabled={busy}>
              {busy ? 'Withdrawing…' : 'Yes, withdraw me from the study'}
            </button>
            <div style={S.divider} />
            <p style={S.altText}>
              Just want fewer emails? You can stop study emails without
              withdrawing — though session invitations arrive by email, so you
              won't receive new session links.
            </p>
            <button style={S.stopEmailsBtn} onClick={stopEmails} disabled={busy}>
              Stop study emails, stay enrolled
            </button>
            {unsubMsg && <p style={S.unsubMsg}>{unsubMsg}</p>}
          </>
        )}

        {state === 'unsub_done' && (
          <>
            <h1 style={S.heading}>Study emails stopped</h1>
            <p style={S.body}>
              You'll no longer receive emails for {studyName}, and you remain
              enrolled. Any session link you already have keeps working until it
              expires. If you change your mind and want the emails back, contact
              your researcher.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <h1 style={S.heading}>You've been withdrawn</h1>
            <p style={S.body}>
              Your participation in {studyName} has ended, and you won't receive
              further session emails for it. Thank you for the time you
              contributed — it's genuinely appreciated. If you have questions
              about credit or compensation, please contact your researcher.
            </p>
          </>
        )}

        {state === 'already' && (
          <>
            <h1 style={S.heading}>Already withdrawn</h1>
            <p style={S.body}>
              Your participation in {studyName} has already ended. If you believe
              this is a mistake, please contact your researcher.
            </p>
          </>
        )}

        {state === 'complete' && (
          <>
            <h1 style={S.heading}>Your participation is complete</h1>
            <p style={S.body}>
              You've already finished {studyName}, so there's nothing to withdraw
              from. If you have questions, please contact your researcher.
            </p>
          </>
        )}

        {state === 'invalid' && (
          <>
            <h1 style={S.heading}>This link is not valid</h1>
            <p style={S.body}>If you need help, please contact your researcher.</p>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 style={S.heading}>Something went wrong</h1>
            <p style={S.body}>
              Your withdrawal may not have been processed. Please try again, or
              contact your researcher directly.
            </p>
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
  noteLabel: {
    display: 'block',
    marginTop: 24,
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: '#555',
  },
  noteBox: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 8,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e5d5dc',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    color: '#1c1c1e',
    resize: 'vertical',
  },
  withdrawBtn: {
    marginTop: 28,
    padding: '12px 24px',
    borderRadius: 8,
    border: '1px solid #d9536f',
    background: '#fff',
    color: '#d9536f',
    fontSize: '0.9375rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  divider: {
    marginTop: 28,
    borderTop: '1px solid #f2e4ea',
  },
  altText: {
    marginTop: 16,
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: '#777',
  },
  stopEmailsBtn: {
    marginTop: 12,
    padding: '10px 18px',
    borderRadius: 8,
    border: '1px solid #d8dadd',
    background: '#fff',
    color: '#555',
    fontSize: '0.875rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  unsubMsg: {
    marginTop: 12,
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: '#8a5568',
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
