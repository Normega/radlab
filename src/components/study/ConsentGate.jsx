import { useState, useEffect, useRef } from 'react'

// ── ConsentGate ──────────────────────────────────────────────────────────────
// Loads a study's active consent form, lets the participant review + agree,
// and records consent via the record_consent RPC (stamps
// study_enrollments.consent_date — there is no separate consent-log table).
//
// Reusable by design: takes its Supabase client and participant id as props
// rather than importing a global client or reading route/auth state itself.
// Two call sites need different clients:
//   - SessionEntry.jsx's inline `needs_consent` step (the real daily-session
//     path) — uses its isolated, non-persisted per-session participant
//     client. This is the ONLY correct way to render consent for a genuine
//     anonymous participant: navigating to a separate route instead (the
//     original design) hits that route's AuthRoute guard with no session at
//     all, since the isolated client's session never touches the global
//     client/localStorage, and dumps the participant on a login screen.
//   - ConsentPage.jsx (route `/study/:studyId/consent`) — admin preview
//     links and consent-only re-entry, using the app's normal global client
//     and an already-authenticated lab/admin session.
//   - StudySessionRunner.jsx (in-lab sessions, e.g. Breath Belt). The RA is
//     signed in, not the participant, so record_consent (keyed on auth.uid())
//     would look for the RA's own enrollment. That caller passes
//     `recordConsent` to write the participant's enrollment instead.
//
// Credit-only consent (2026-09-11, 20260911_credit_only_consent.sql): a study with
// studies.allow_credit_only_consent offers two answers instead of one checkbox —
// take part in the research, or complete the sessions for course credit without
// research use of the data. The answer goes to record_consent as p_scope, and the
// study export leaves credit-only participants out entirely.
// Repository consent (20261008_repository_consent.sql): a study with
// studies.offer_repository_consent asks a SEPARATE, optional question after the
// participation answer: may de-identified data be deposited in the U of T
// Dataverse (Borealis)? The consent form itself explains the deposit; these
// labels only record the decision. "No" takes part exactly as "Yes" does. An
// explicit answer is required so that a blank never has to be interpreted, and
// only an explicit yes is ever deposited.
const REPOSITORY_CHOICES = [
  { value: true,  label: "Yes, I consent to my de-identified data being deposited in the University of Toronto's Dataverse (Borealis), as described above." },
  { value: false, label: 'No, I do not consent to this.' },
]

const CONSENT_CHOICES = [
  { scope: 'research',    label: 'I have read this consent form in full and agree to participate in this study.' },
  { scope: 'credit_only', label: 'I wish to complete the surveys for course credit, but do not consent to have my data used in research.' },
]

export default function ConsentGate({ studyId, participantId, supabaseClient, onComplete, prefetched = null, recordConsent = null }) {
  const [state,   setState]   = useState(STATES.LOADING)
  const [study,   setStudy]   = useState(null)
  const [form,    setForm]    = useState(null)
  // null until answered, then 'research' | 'credit_only'.
  const [scope,   setScope]   = useState(null)
  const [creditOption, setCreditOption] = useState(false)
  const [repoOffered, setRepoOffered] = useState(false)
  // null until answered, then true | false. Only asked when repoOffered.
  const [repoChoice, setRepoChoice] = useState(null)
  const [error,   setError]   = useState(null)
  const bodyRef                = useRef(null)
  const agreed = scope !== null
  // The deposit question applies only to research consent; credit-only
  // participants allow no research use, so it is not asked of them.
  const asksRepo = repoOffered && scope === 'research'
  const ready = agreed && (!asksRepo || repoChoice !== null)

  // Whether this study offers the credit-only answer. Its own small read, not a
  // column on the queries below and not a field on get_session_by_token, so that
  // if it fails for any reason — the RLS/JWT timing described in load(), or a
  // database that predates the column — the gate falls back to the single
  // research checkbox it always had. Consent must never be blocked by this.
  // The repository question shares this read and its fallback: if the read
  // fails, the question is not shown, consent still goes through, and the
  // participant is recorded as not asked, which is never deposited.
  async function loadConsentOptions() {
    try {
      const { data, error: ce } = await supabaseClient
        .from('studies')
        .select('allow_credit_only_consent, offer_repository_consent')
        .eq('id', studyId)
        .maybeSingle()
      if (ce) return { credit: false, repository: false }
      return {
        credit:     data?.allow_credit_only_consent === true,
        repository: data?.offer_repository_consent === true,
      }
    } catch {
      return { credit: false, repository: false }
    }
  }

  async function applyConsentOptions() {
    const opts = await loadConsentOptions()
    setCreditOption(opts.credit)
    setRepoOffered(opts.repository)
  }

  useEffect(() => {
    if (!participantId) return
    load()
  }, [studyId, participantId])

  async function load() {
    setState(STATES.LOADING)

    // Fast path: SessionEntry passes the token payload straight through. That
    // data came from get_session_by_token (SECURITY DEFINER), so it's already
    // authorized — using it avoids re-reading studies/study_enrollments/
    // study_consent_forms under RLS here, which can intermittently return
    // nothing if the participant's JWT isn't yet attached to these requests,
    // leaving the consent form blank / "not found". ConsentPage (admin route,
    // global session) passes no prefetched data and uses the query path below.
    if (prefetched) {
      if (!prefetched.consentRequired || !prefetched.activeConsentFormId) { onComplete(); return }
      if (prefetched.consentDate) { setState(STATES.ALREADY_CONSENTED); return }
      setStudy({ name: prefetched.studyName ?? null })
      setForm({ html_content: prefetched.consentHtml ?? '' })
      await applyConsentOptions()
      setState(STATES.READY)
      return
    }

    const { data: studyData, error: se } = await supabaseClient
      .from('studies')
      .select('id, name, consent_required, active_consent_form_id, active')
      .eq('id', studyId)
      .single()

    if (se || !studyData) {
      setError('Study not found.')
      setState(STATES.ERROR)
      return
    }
    setStudy(studyData)

    // If consent isn't required or no form is attached, skip forward
    if (!studyData.consent_required || !studyData.active_consent_form_id) {
      onComplete()
      return
    }

    const { data: existing } = await supabaseClient
      .from('study_enrollments')
      .select('consent_date')
      .eq('profile_id', participantId)
      .eq('study_id', studyId)
      .maybeSingle()

    if (existing?.consent_date) {
      setState(STATES.ALREADY_CONSENTED)
      return
    }

    const { data: formData, error: fe } = await supabaseClient
      .from('study_consent_forms')
      .select('id, html_content, uploaded_at')
      .eq('id', studyData.active_consent_form_id)
      .single()

    if (fe || !formData) {
      setError('Could not load the consent form. Please contact your researcher.')
      setState(STATES.ERROR)
      return
    }

    setForm(formData)
    await applyConsentOptions()
    setState(STATES.READY)
  }

  async function handleSubmit() {
    if (!ready || !form) return
    setState(STATES.SUBMITTING)

    // A research answer sends only p_study_id: record_consent's p_scope defaults
    // to 'research', so this is the exact call that has always worked and it
    // keeps working against a database that has not yet gained the parameter.
    // The repository answer is sent only when the question was asked, so every
    // study without it makes exactly the call it always made.
    const args = scope === 'credit_only'
      ? { p_study_id: studyId, p_scope: 'credit_only' }
      : { p_study_id: studyId }
    if (asksRepo) args.p_repository_consent = repoChoice
    const { error: re } = recordConsent
      ? await recordConsent(scope)
      : await supabaseClient.rpc('record_consent', args)

    if (re) {
      setError(re.message)
      setState(STATES.READY)
      return
    }

    onComplete()
  }

  if (state === STATES.LOADING) {
    return <p style={S.muted}>Loading…</p>
  }

  if (state === STATES.ERROR) {
    return <p style={S.errBox}>{error}</p>
  }

  if (state === STATES.ALREADY_CONSENTED) {
    return (
      <div style={S.wrap}>
        {study?.name && <p style={S.eyebrow}>{study.name}</p>}
        <h1 style={S.title}>You've already consented</h1>
        <p style={S.body}>Your consent for this study is on record.</p>
        <button style={S.btn} onClick={onComplete}>Continue →</button>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      {study?.name && <p style={S.eyebrow}>{study.name}</p>}
      <h1 style={S.title}>Research Consent Form</h1>

      <div ref={bodyRef} style={S.formBox}>
        <div
          className="consent-body"
          style={S.formContent}
          dangerouslySetInnerHTML={{ __html: form?.html_content ?? '' }}
        />
      </div>

      {creditOption ? (
        // Equal-weight bordered options, deliberately: neither consent answer is
        // presented as the suggested one.
        <div role="radiogroup" aria-label="Your consent choice" style={S.choiceGroup}>
          {CONSENT_CHOICES.map(c => {
            const on = scope === c.scope
            return (
              <label key={c.scope} style={{ ...S.choice, ...(on ? S.choiceOn : null) }}>
                <input
                  type="radio"
                  name="consent-scope"
                  value={c.scope}
                  checked={on}
                  onChange={() => setScope(c.scope)}
                  style={S.choiceRadio}
                />
                <span style={S.checkLabel}>{c.label}</span>
              </label>
            )
          })}
        </div>
      ) : (
        <label style={S.checkRow}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setScope(e.target.checked ? 'research' : null)}
            style={{ width: 16, height: 16, accentColor: 'var(--pk)', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={S.checkLabel}>
            I have read this consent form in full and agree to participate in this study.
          </span>
        </label>
      )}

      {asksRepo && (
        <div style={S.repoBlock}>
          <p style={S.repoTitle}>Future use of your data (optional)</p>
          <p style={S.repoNote}>
            This is a separate decision. It does not affect your participation above.
          </p>
          <div role="radiogroup" aria-label="Future use of your data" style={S.choiceGroup}>
            {REPOSITORY_CHOICES.map(c => {
              const on = repoChoice === c.value
              return (
                <label key={String(c.value)} style={{ ...S.choice, ...(on ? S.choiceOn : null) }}>
                  <input
                    type="radio"
                    name="repository-consent"
                    value={String(c.value)}
                    checked={on}
                    onChange={() => setRepoChoice(c.value)}
                    style={S.choiceRadio}
                  />
                  <span style={S.checkLabel}>{c.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {error && <p style={S.errBox}>{error}</p>}

      <button
        style={{ ...S.btn, opacity: (!ready || state === STATES.SUBMITTING) ? 0.5 : 1 }}
        onClick={handleSubmit}
        disabled={!ready || state === STATES.SUBMITTING}
      >
        {state === STATES.SUBMITTING ? 'Saving…' : 'Confirm consent & continue →'}
      </button>
    </div>
  )
}

const STATES = {
  LOADING:           'loading',
  READY:             'ready',
  SUBMITTING:        'submitting',
  ALREADY_CONSENTED: 'already_consented',
  ERROR:             'error',
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", monospace'
const SERIF = '"DM Serif Display", serif'

const S = {
  wrap: {
    maxWidth: 720, margin: '0 auto', padding: '48px 24px',
    display: 'flex', flexDirection: 'column', gap: 24,
  },
  eyebrow: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--pkd)', margin: 0,
  },
  title: {
    fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 36px)',
    color: 'var(--tx)', margin: 0, letterSpacing: -0.5,
  },
  body: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, margin: 0 },

  formBox: {
    border: '1px solid var(--bd)', borderRadius: 12,
    background: '#fff', height: 480, overflowY: 'auto',
    padding: '24px 28px',
    boxShadow: 'inset 0 -24px 20px -20px rgba(0,0,0,0.04)',
  },
  formContent: {
    fontSize: 14, lineHeight: 1.8, color: 'var(--tx)',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },

  checkRow: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    cursor: 'pointer', userSelect: 'none',
  },
  checkLabel: {
    fontSize: 14, color: 'var(--tx)', lineHeight: 1.5,
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },

  // The <label> wraps the radio, so the whole bordered box is the tap target.
  choiceGroup: { display: 'grid', gap: 8 },
  choice: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    cursor: 'pointer', userSelect: 'none',
    border: '1.5px solid var(--bds)', borderRadius: 12,
    padding: 16, background: 'var(--bgc)',
  },
  choiceOn:    { borderColor: 'var(--pk)', background: 'var(--pkb)' },
  choiceRadio: { width: 16, height: 16, margin: '4px 0 0', flexShrink: 0, accentColor: 'var(--pk)', cursor: 'pointer' },
  repoBlock:   { display: 'flex', flexDirection: 'column', gap: 8 },
  repoTitle:   { fontSize: 16, fontWeight: 600, color: 'var(--tx)', margin: 0, fontFamily: '"DM Sans", system-ui, sans-serif' },
  repoNote:    { fontSize: 14, color: 'var(--tx2)', margin: 0, fontFamily: '"DM Sans", system-ui, sans-serif' },

  btn: {
    alignSelf: 'flex-start',
    padding: '13px 32px', borderRadius: 12,
    background: 'var(--pkd)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
    transition: 'opacity 0.15s',
  },

  muted: { fontSize: 14, color: 'var(--tx3)', margin: 0 },
  errBox: {
    fontSize: 14, color: '#e04', background: 'var(--err-bg)',
    border: '1px solid #fcc', borderRadius: 8, padding: '10px 16px', margin: 0,
  },
}
