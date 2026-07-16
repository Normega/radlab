import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'

export default function CompensationStep({ enrollment, onComplete, supabaseClient, isSimMode = false, previewMode = false }) {
  const db = supabaseClient ?? globalSupabase

  const [compensationType, setCompensationType] = useState(null) // 'pay' | 'credit'
  const [email,   setEmail]   = useState('')
  const [sonaId,  setSonaId]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!isSimMode) return
    const t = setTimeout(async () => {
      setSaving(true)
      const studyId = enrollment.studies?.id ?? enrollment.study_id
      await db.from('participant_compensation').insert({
        enrollment_id:     enrollment.id,
        participant_id:    enrollment.external_id,
        study_id:          studyId,
        compensation_type: 'credit',
        sona_id:           'SIM_SONA_001',
      })
      setSaving(false)
      onComplete({})
    }, 500)
    return () => clearTimeout(t)
  }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit =
    compensationType === 'pay'    ? email.trim().includes('@') :
    compensationType === 'credit' ? sonaId.trim().length > 0   : false

  async function handleSubmit() {
    if (!canSubmit || saving) return
    if (previewMode) { onComplete({ preview: true }); return }
    setSaving(true)
    setError(null)

    const studyId = enrollment.studies?.id ?? enrollment.study_id
    const payload = {
      enrollment_id:     enrollment.id,
      participant_id:    enrollment.external_id,
      study_id:          studyId,
      compensation_type: compensationType,
      ...(compensationType === 'pay'    && { email:   email.trim() }),
      ...(compensationType === 'credit' && { sona_id: sonaId.trim() }),
    }

    const { error: dbErr } = await db.from('participant_compensation').insert(payload)
    setSaving(false)
    if (dbErr) {
      setError('Could not save — please try again.')
      console.error('compensation insert:', dbErr)
      return
    }
    onComplete({})
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <h2 style={S.heading}>Study Compensation</h2>
        <p style={S.subtext}>How are you participating in this study today?</p>

        <div style={S.options}>
          <label style={{
            ...S.optionCard,
            borderColor: compensationType === 'pay' ? 'var(--pk)' : 'var(--bd)',
            background:  compensationType === 'pay' ? '#fdf2f8' : '#fff',
          }}>
            <input
              type="radio"
              name="compensation"
              value="pay"
              checked={compensationType === 'pay'}
              onChange={() => { setCompensationType('pay'); setError(null) }}
              style={{ accentColor: 'var(--pk)', marginTop: 3, flexShrink: 0 }}
            />
            <div>
              <div style={S.optionLabel}>For pay</div>
              <div style={S.optionDesc}>I will receive payment for my participation</div>
            </div>
          </label>

          <label style={{
            ...S.optionCard,
            borderColor: compensationType === 'credit' ? 'var(--pk)' : 'var(--bd)',
            background:  compensationType === 'credit' ? '#fdf2f8' : '#fff',
          }}>
            <input
              type="radio"
              name="compensation"
              value="credit"
              checked={compensationType === 'credit'}
              onChange={() => { setCompensationType('credit'); setError(null) }}
              style={{ accentColor: 'var(--pk)', marginTop: 3, flexShrink: 0 }}
            />
            <div>
              <div style={S.optionLabel}>For course credit</div>
              <div style={S.optionDesc}>I am earning SONA credit for my course</div>
            </div>
          </label>
        </div>

        {compensationType === 'pay' && (
          <div style={S.fieldWrap}>
            <label style={S.fieldLabel}>Email address</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <p style={S.infoNote}>
              You will receive an e-transfer to this address within 10 business days of study completion.
            </p>
          </div>
        )}

        {compensationType === 'credit' && (
          <div style={S.fieldWrap}>
            <label style={S.fieldLabel}>SONA ID</label>
            <input
              style={S.input}
              type="text"
              placeholder="Your SONA participant ID"
              value={sonaId}
              onChange={e => setSonaId(e.target.value)}
            />
            <p style={S.infoNote}>
              Please re-enter your SONA ID so we can credit you correctly.
            </p>
          </div>
        )}

        {error && <p style={S.errMsg}>{error}</p>}

        <button
          style={{ ...S.btn, opacity: (!canSubmit || saving) ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

const S = {
  wrap:       { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 24px', minHeight: '60vh' },
  card:       { background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, padding: '36px 32px', maxWidth: 500, width: '100%' },
  heading:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  subtext:    { fontSize: 15, color: 'var(--tx2)', margin: '0 0 28px', fontFamily: '"DM Sans",system-ui,sans-serif' },
  options:    { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 },
  optionCard: { display: 'flex', gap: 12, alignItems: 'flex-start', border: '1.5px solid', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' },
  optionLabel:{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif', marginBottom: 2 },
  optionDesc: { fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  fieldWrap:  { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 },
  fieldLabel: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:      { fontSize: 15, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 14px', color: 'var(--tx)', background: '#fff', width: '100%', boxSizing: 'border-box' },
  infoNote:   { fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '6px 0 0', lineHeight: 1.55 },
  errMsg:     { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  btn:        { display: 'block', width: '100%', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '12px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', marginTop: 4 },
}
