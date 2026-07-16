import { useState } from 'react'

// ── ContactEmailGate ─────────────────────────────────────────────────────────
// Collects the participant's real email address and stores it via the
// record_contact_email RPC (study_enrollments.contact_email — narrow
// SECURITY DEFINER write, same pattern as record_consent).
//
// Why this exists: external (SONA/Prolific) participants are auto-enrolled
// with a synthetic, undeliverable auth email (ext-<source>-<id>@
// participants.radlab.zone) — without this gate, no daily session link,
// reminder, or study email could ever reach them. SessionEntry.jsx renders
// it inline (after the consent gate, before the step flow) for external
// enrollments in longitudinal studies with no contact_email on record.
//
// Reusable by design, like ConsentGate: takes its Supabase client as a prop
// rather than importing a global one, because the real call site uses
// SessionEntry's isolated, non-persisted participant client.
export default function ContactEmailGate({ studyId, studyName, supabaseClient, onComplete }) {
  const [email,      setEmail]      = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)

  const trimmed      = email.trim()
  const looksValid   = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)
  const confirmMatch = trimmed !== '' && trimmed.toLowerCase() === confirm.trim().toLowerCase()
  const canSubmit    = looksValid && confirmMatch && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    const { error: re } = await supabaseClient.rpc('record_contact_email', {
      p_study_id: studyId,
      p_email:    trimmed,
    })

    if (re) {
      setError(re.message)
      setSubmitting(false)
      return
    }

    onComplete()
  }

  return (
    <div style={S.wrap}>
      {studyName && <p style={S.eyebrow}>{studyName}</p>}
      <h1 style={S.title}>Where should we send your session links?</h1>
      <p style={S.body}>
        This study runs over multiple days. Each day, we'll email you a link to
        that day's session — without an email address, we have no way to reach
        you and you won't be able to continue in the study.
      </p>
      <p style={S.bodyMuted}>
        Your address is used only to send study session links and reminders.
        Every email includes an unsubscribe link.
      </p>

      <div style={S.fieldCol}>
        <label style={S.fieldLabel} htmlFor="contact-email">Email address</label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          style={S.input}
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      <div style={S.fieldCol}>
        <label style={S.fieldLabel} htmlFor="contact-email-confirm">Confirm email address</label>
        <input
          id="contact-email-confirm"
          type="email"
          autoComplete="email"
          style={S.input}
          placeholder="you@example.com"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        {confirm.trim() !== '' && !confirmMatch && (
          <p style={S.fieldWarn}>The two addresses don't match yet.</p>
        )}
      </div>

      {error && <p style={S.errBox}>{error}</p>}

      <button
        style={{ ...S.btn, opacity: canSubmit ? 1 : 0.5 }}
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? 'Saving…' : 'Save & continue →'}
      </button>
    </div>
  )
}

// ── Styles (mirrors ConsentGate.jsx) ─────────────────────────────────────────

const MONO  = '"Space Mono", monospace'
const SERIF = '"DM Serif Display", serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  wrap: {
    maxWidth: 560, margin: '0 auto', padding: '48px 24px',
    display: 'flex', flexDirection: 'column', gap: 20,
  },
  eyebrow: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--pk)', margin: 0,
  },
  title: {
    fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 36px)',
    color: 'var(--tx)', margin: 0, letterSpacing: -0.5,
  },
  body:      { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, margin: 0, fontFamily: SANS },
  bodyMuted: { fontSize: 13, color: 'var(--tx3)', lineHeight: 1.6, margin: 0, fontFamily: SANS },

  fieldCol:   { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--tx2)',
  },
  input: {
    padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--bd)', background: '#fff',
    fontSize: 15, color: 'var(--tx)', fontFamily: SANS, outline: 'none',
  },
  fieldWarn: { fontSize: 12, color: '#b45309', margin: 0, fontFamily: SANS },

  btn: {
    alignSelf: 'flex-start',
    padding: '13px 32px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
    transition: 'opacity 0.15s',
  },

  errBox: {
    fontSize: 13, color: '#e04', background: '#fff0f0',
    border: '1px solid #fcc', borderRadius: 8, padding: '10px 16px', margin: 0,
  },
}
