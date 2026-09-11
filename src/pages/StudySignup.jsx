import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const FN_URL     = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-signup`
const VERIFY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-signup-verify`

// Why a typed code exists at all: university Microsoft 365 mail runs Defender
// Safe Links, which opens every emailed link in a real browser before the
// student sees it. The emailed link goes to a page that is inert until pressed;
// this code is the independent second path, typed here, that no scanner can
// use because nobody typed it. Same pair of doors as the academic side's
// sign-in. Either finishes signing up.
const CODE_ERRORS = {
  code_not_found: 'That code was not accepted — it may have expired, a newer code may have replaced it, or you may already be signed up. Request another and use the most recent email.',
  code_locked:    'Too many incorrect codes. Request a new one below and use the most recent email.',
  closed:         'This study is no longer accepting sign-ups.',
  withdrawn:      'This account was withdrawn from the study and cannot rejoin. Please contact the study team.',
  already_completed: 'You have already completed this study — thank you for taking part.',
  link_expired:   'You are signed up, but the link to your current session has expired. A new one will be emailed when your next session is due.',
}

// The two answers a study with studies.allow_credit_only_consent offers
// (20260911_credit_only_consent.sql; CHM135, whose consent form already describes
// the second). Both are equal-weight bordered options on purpose: this is a
// consent decision, so neither is styled as the suggested one — the usual
// primary/grayer-secondary treatment for choice pairs would be a nudge here.
// Choosing credit-only changes nothing about taking part; it keeps the
// participant's data out of every research export.
const CONSENT_CHOICES = [
  { scope: 'research',    label: 'I have read the consent form and I agree to take part in this study.' },
  { scope: 'credit_only', label: 'I wish to complete the surveys for course credit, but do not consent to have my data used in research.' },
]

export default function StudySignup() {
  const [studyId,  setStudyId]  = useState(null)
  const [info,     setInfo]     = useState(null)
  const [loadErr,  setLoadErr]  = useState(null)

  // null until the participant answers; 'research' or 'credit_only' after. A
  // study without the credit-only option only ever sets 'research' (its single
  // checkbox), which is what consent meant before the option existed.
  const [scope,     setScope]     = useState(null)
  const consented = scope !== null
  const [email,     setEmail]     = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [busy,      setBusy]      = useState(false)
  const [sent,      setSent]      = useState(false)
  const [error,     setError]     = useState(null)

  const navigate = useNavigate()
  const [code,      setCode]      = useState('')
  const [codeBusy,  setCodeBusy]  = useState(false)
  const [codeError, setCodeError] = useState(null)
  // Synchronous lock: setCodeBusy lands on re-render, so a fast double submit
  // would otherwise send two claims for one code.
  const codeLockRef = useRef(false)

  async function submitCode(e) {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) { setCodeError('Enter the six-digit code from the email.'); return }
    if (codeLockRef.current) return
    codeLockRef.current = true
    setCodeBusy(true)
    setCodeError(null)
    try {
      const res = await fetch(VERIFY_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body:    JSON.stringify({ study_id: studyId, email: email.trim(), code: digits }),
      })
      const body = await res.json()
      if (res.ok && body.token) {
        navigate(`/s/${body.token}`, { replace: true })
        return
      }
      if (body.error === 'wrong_code') {
        const left = body.attempts_left
        setCodeError(left > 0
          ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left before you will need a new one.`
          : CODE_ERRORS.code_locked)
      } else {
        setCodeError(CODE_ERRORS[body.error] ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setCodeError('A network error occurred. Please check your connection and try again.')
    } finally {
      // Released only on failure — on success the page has navigated away.
      codeLockRef.current = false
      setCodeBusy(false)
    }
  }

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
          consent_scope:  scope ?? 'research',
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
        We have sent a confirmation code to <strong>{email.trim()}</strong>. Type it below, or press
        the button in the email — either finishes signing up and takes you to your first session.
      </p>

      <form onSubmit={submitCode} style={S.codeForm}>
        <label style={S.label} htmlFor="signup-code">Confirmation code</label>
        <div style={S.codeRow}>
          <input id="signup-code" style={{ ...S.input, ...S.codeInput }} type="text"
            inputMode="numeric" autoComplete="one-time-code" maxLength={9} autoFocus
            value={code} onChange={e => { setCode(e.target.value); setCodeError(null) }}
            placeholder="123456" />
          <button type="submit" style={{ ...S.codeSubmit, opacity: codeBusy ? 0.6 : 1 }} disabled={codeBusy}>
            {codeBusy ? 'Checking…' : 'Confirm'}
          </button>
        </div>
        {codeError && <p style={S.error}>{codeError}</p>}
      </form>

      <p style={S.finePrint}>
        The code expires in 24 hours. If the email does not arrive within a few minutes, check your
        spam folder. <strong>You are not signed up until you use the code or the button.</strong>
      </p>
      <p style={S.finePrint}>
        No email?{' '}
        <button type="button" style={S.linkBtn}
          onClick={() => { setSent(false); setCode(''); setCodeError(null) }}>
          Request a new code
        </button>
        {' '}— that replaces the earlier one.
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
          {info.allow_credit_only_consent ? (
            <div role="radiogroup" aria-label="Your consent choice" style={S.choiceGroup}>
              {CONSENT_CHOICES.map(c => {
                const on = scope === c.scope
                return (
                  <label key={c.scope} style={{ ...S.choice, ...(on ? S.choiceOn : null) }}>
                    <input type="radio" name="consent-scope" value={c.scope} checked={on}
                      style={S.choiceRadio}
                      onChange={() => { setScope(c.scope); setError(null) }} />
                    <span style={S.checkText}>{c.label}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <label style={S.checkRow}>
              <input type="checkbox" checked={consented}
                onChange={e => { setScope(e.target.checked ? 'research' : null); setError(null) }} />
              <span style={S.checkText}>
                I have read the consent form and I agree to take part in this study.
              </span>
            </label>
          )}
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
            We will email you a code and a link to confirm this address. You are not signed up
            until you use one.
          </p>
        </form>
      ) : (
        <p style={S.finePrint}>
          {info.allow_credit_only_consent
            ? 'Choose one of the options above to continue.'
            : 'Agree to the consent form above to continue.'}
        </p>
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
  // Whole bordered box is the tap target (the <label> wraps the radio), so a
  // phone user does not have to hit a 16px circle.
  choiceGroup: { display: 'grid', gap: 8, margin: '16px 0 4px' },
  choice:      {
    display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer',
    border: '1.5px solid var(--bds)', borderRadius: 12, padding: 16, background: 'var(--bgc)',
  },
  choiceOn:    { borderColor: 'var(--pk)', background: 'var(--pkb)' },
  choiceRadio: { width: 16, height: 16, margin: '4px 0 0', flexShrink: 0, accentColor: 'var(--pk)', cursor: 'pointer' },

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
  codeForm:   { marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--bd)' },
  codeRow:    { display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' },
  // 16px+ so iOS Safari does not zoom the page on focus; letter-spaced so a
  // six-digit code reads the way it is printed in the email.
  codeInput:  { flex: '1 1 160px', fontSize: 22, letterSpacing: '0.3em', fontFamily: '"Space Mono", monospace', textAlign: 'center' },
  codeSubmit: { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 24, padding: '10px 26px', fontSize: 15, fontWeight: 600, fontFamily: SANS, cursor: 'pointer' },
  linkBtn:    { background: 'none', border: 'none', padding: 0, color: 'var(--pk)', fontSize: 12.5, fontFamily: SANS, cursor: 'pointer', textDecoration: 'underline' },
}
