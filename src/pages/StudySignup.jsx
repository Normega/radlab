import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── StudySignup (/study/signup?study_id=…) ────────────────────────────────────
//
// The public sign-up page a course announcement links to. Unauthenticated, no
// nav, no guard — a prospective participant has no account by definition.
//
// Order is deliberate and is the whole reason this page exists as a page rather
// than a form (Norm, 2026-09-03): CONSENT, then identifiers. Nothing
// identifiable is collected until the consent form has been read and agreed to,
// which is why the email and student-number fields do not exist in the DOM
// until the participant has consented.
//
// Nothing durable is created here. The submit records a request and sends a
// confirmation email; the account, enrollment and schedule are created only
// when that emailed link is clicked. A typo therefore costs a dead request row
// rather than a ghost participant with a materialised schedule.
//
// Do NOT replace this with `/study/join?study_id=…&id=…`. That is the
// SONA/Prolific entry point, where `id` IS the participant's identity: one
// static link posted publicly collapses every student into a single shared
// participant holding a single shared session token, and that token is a
// credential.

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-signup`

export default function StudySignup() {
  const [studyId,  setStudyId]  = useState(null)
  const [info,     setInfo]     = useState(null)
  const [loadErr,  setLoadErr]  = useState(null)

  const [consented, setConsented] = useState(false)
  const [email,     setEmail]     = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [busy,      setBusy]      = useState(false)
  const [sent,      setSent]      = useState(false)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('study_id')
    if (!id) { setLoadErr('missing'); return }
    setStudyId(id)
    supabase.rpc('get_self_enrollment_study', { p_study_id: id })
      .then(({ data, error }) => {
        if (error) { setLoadErr('failed'); return }
        if (data?.error) { setLoadErr(data.error); return }
        setInfo(data)
      })
      .catch(() => setLoadErr('failed'))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(FN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body:    JSON.stringify({
          study_id:       studyId,
          email:          email.trim(),
          student_number: studentNo.trim() || null,
          consented,
        }),
      })
      const body = await res.json()
      if (!res.ok || body.error) setError(body.error ?? 'Something went wrong. Please try again.')
      else setSent(true)
    } catch {
      setError('A network error occurred. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (loadErr) return <Shell><LoadError kind={loadErr} /></Shell>
  if (!info)   return <Shell><p style={S.muted}>Loading…</p></Shell>

  if (sent) return (
    <Shell>
      <h1 style={S.h1}>Check your email</h1>
      <p style={S.body}>
        We have sent a confirmation link to <strong>{email.trim()}</strong>. Open it to finish
        signing up and start the first session.
      </p>
      <p style={S.body}>
        The link expires in 24 hours. If it does not arrive within a few minutes, check your spam
        folder. <strong>You are not signed up until you use it.</strong>
      </p>
    </Shell>
  )

  const emailLooksRight = /@(mail\.)?utoronto\.ca$/i.test(email.trim())
  const canSubmit = consented && emailLooksRight && !busy

  return (
    <Shell>
      <h1 style={S.h1}>{info.name}</h1>
      <p style={S.lead}>
        This study is run by the Regulatory &amp; Affective Dynamics Lab at the University of
        Toronto. Please read the consent form below before signing up.
      </p>

      {info.consent_required && (
        <>
          <div style={S.consentBox} dangerouslySetInnerHTML={{ __html: info.consent_html }} />
          <label style={S.checkRow}>
            <input type="checkbox" checked={consented}
              onChange={e => { setConsented(e.target.checked); setError(null) }} />
            <span style={S.checkText}>
              I have read the consent form and I agree to take part in this study.
            </span>
          </label>
        </>
      )}

      {/* The identifier fields do not exist until consent is given — the
          ordering is enforced by the page, not just by the button state. */}
      {consented ? (
        <form onSubmit={handleSubmit} style={S.form}>
          <p style={S.sectionNote}>
            Your email is how we send you the later sessions, so please use one you check. Your
            student number is used only to credit your participation.
          </p>

          <label style={S.label} htmlFor="signup-email">U of T email *</label>
          <input id="signup-email" style={S.input} type="email" required autoFocus
            value={email} onChange={e => { setEmail(e.target.value); setError(null) }}
            placeholder="you@mail.utoronto.ca" />
          {email.trim() && !emailLooksRight && (
            <p style={S.fieldHint}>
              Please use your U of T address — it should end in utoronto.ca or mail.utoronto.ca.
            </p>
          )}

          <label style={{ ...S.label, marginTop: 16 }} htmlFor="signup-student">Student number</label>
          <input id="signup-student" style={S.input} type="text" inputMode="numeric"
            value={studentNo} onChange={e => setStudentNo(e.target.value)}
            placeholder="1234567890" />

          {error && <p style={S.error}>{error}</p>}

          <button type="submit" style={{ ...S.submit, opacity: canSubmit ? 1 : 0.45 }}
            disabled={!canSubmit}>
            {busy ? 'Sending…' : 'Send my confirmation link'}
          </button>
          <p style={S.finePrint}>
            We will email you a link to confirm this address. You are not signed up until you
            open it.
          </p>
        </form>
      ) : (
        <p style={S.finePrint}>Agree to the consent form above to continue.</p>
      )}
    </Shell>
  )
}

function LoadError({ kind }) {
  const copy = {
    missing: ['This link is incomplete', 'It is missing the study it belongs to. Please use the link exactly as your instructor posted it.'],
    not_open: ['This study is not accepting sign-ups', 'It may not have opened yet, or it may have finished recruiting. Please check with the study team.'],
    screener_unsupported: ['This study cannot be joined from a link yet', 'It uses an eligibility questionnaire, which this sign-up page does not yet support. Please contact the study team.'],
    consent_form_missing: ['This study is not ready for sign-ups', 'Its consent form has not been attached yet. Please contact the study team.'],
    failed: ['Something went wrong', 'We could not load this study. Please try again in a moment.'],
  }[kind] ?? ['Something went wrong', 'Please try again in a moment.']

  return (
    <>
      <h1 style={S.h1}>{copy[0]}</h1>
      <p style={S.body}>{copy[1]}</p>
    </>
  )
}

function Shell({ children }) {
  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={S.brand}>RADlab · University of Toronto</p>
        {children}
      </div>
    </div>
  )
}

const SANS  = '"DM Sans", system-ui, sans-serif'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  page:  { minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px', fontFamily: SANS },
  card:  {
    maxWidth: 680, margin: '0 auto', background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 16, padding: '32px 30px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
  },
  brand: { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.06em', color: 'var(--tx3)', margin: '0 0 18px' },
  h1:    { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 12px', lineHeight: 1.25 },
  lead:  { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 22px' },
  body:  { fontSize: 15, color: 'var(--tx)', lineHeight: 1.65, margin: '0 0 14px' },
  muted: { fontSize: 15, color: 'var(--tx2)' },

  consentBox: {
    maxHeight: 380, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 12,
    padding: '18px 20px', background: '#fffafd', fontSize: 14, lineHeight: 1.65, color: 'var(--tx)',
  },
  checkRow:  { display: 'flex', gap: 10, alignItems: 'flex-start', margin: '18px 0 4px', cursor: 'pointer' },
  checkText: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.5 },

  form:        { marginTop: 24, paddingTop: 22, borderTop: '1px solid var(--bd)' },
  sectionNote: { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 18px' },
  label:       { display: 'block', fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input:       {
    width: '100%', fontSize: 15, fontFamily: SANS, border: '1.5px solid var(--bds)',
    borderRadius: 9, padding: '10px 13px', color: 'var(--tx)', background: 'var(--bgc)', boxSizing: 'border-box',
  },
  fieldHint:  { fontSize: 12.5, color: 'var(--tx2)', margin: '6px 0 0', lineHeight: 1.5 },
  error:      { fontSize: 14, color: 'var(--err-tx)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 9, padding: '9px 13px', margin: '16px 0 0', lineHeight: 1.5 },
  submit:     { marginTop: 22, background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 26px', fontSize: 15, fontWeight: 600, fontFamily: SANS, cursor: 'pointer' },
  finePrint:  { fontSize: 12.5, color: 'var(--tx3)', lineHeight: 1.6, margin: '12px 0 0' },
}
