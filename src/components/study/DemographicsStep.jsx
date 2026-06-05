import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'

const SES_PROMPT = `Imagine a ladder that represents where people stand in society. At the top are people who are the best off — those with the most money, most education, and the best jobs. At the bottom are people who are the worst off — those with the least money, least education, and the worst or no job. Where would you place yourself on this ladder?`

export default function DemographicsStep({ enrollment, scheduleId, onComplete, supabaseClient, isSimMode = false }) {
  const db = supabaseClient ?? globalSupabase

  const [age,        setAge]        = useState('')
  const [gender,     setGender]     = useState('')
  const [racialized, setRacialized] = useState(null)   // 'yes' | 'no' | 'prefer_not_to_answer'
  const [sesLadder,  setSesLadder]  = useState(null)   // 1–10
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  // Sim mode: auto-fill fields then submit
  useEffect(() => {
    if (!isSimMode) return
    const simAge     = String(Math.floor(Math.random() * 17) + 19)   // 19–35
    const simSes     = Math.floor(Math.random() * 4) + 4             // 4–7
    setAge(simAge)
    setGender('sim')
    setRacialized('prefer_not_to_answer')
    setSesLadder(simSes)
    // Short delay to let state settle, then submit directly
    const t = setTimeout(async () => {
      setSaving(true)
      const { error: dbErr } = await db.from('demographics').insert({
        user_id:       enrollment.profile_id ?? enrollment.user_id,
        enrollment_id: enrollment.id,
        schedule_id:   scheduleId ?? null,
        age:           parseInt(simAge),
        gender:        'sim',
        racialized:    'prefer_not_to_answer',
        ses_ladder:    simSes,
      })
      setSaving(false)
      if (dbErr) { console.error('sim demographics insert:', dbErr) }
      onComplete({})
    }, 500)
    return () => clearTimeout(t)
  }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = age !== '' && parseInt(age) > 0 && gender.trim() !== '' && racialized !== null && sesLadder !== null

  async function handleSubmit() {
    if (!canSubmit || saving) return
    setSaving(true)
    setError(null)
    const { error: dbErr } = await db.from('demographics').insert({
      user_id:       enrollment.profile_id ?? enrollment.user_id,
      enrollment_id: enrollment.id,
      schedule_id:   scheduleId ?? null,
      age:           parseInt(age),
      gender:        gender.trim(),
      racialized,
      ses_ladder:    sesLadder,
    })
    setSaving(false)
    if (dbErr) { setError('Could not save — please try again.'); console.error('demographics insert:', dbErr); return }
    onComplete({})
  }

  return (
    <div style={S.wrap}>
      <h1 style={S.title}>About You</h1>
      <p style={S.sub}>These questions help us understand our participants. All responses are confidential.</p>

      {/* Age */}
      <div style={S.section}>
        <label style={S.qLabel}>What is your age?</label>
        <input
          type="number" min={1} max={120}
          value={age}
          onChange={e => setAge(e.target.value)}
          placeholder="e.g. 24"
          style={S.numberInput}
        />
      </div>

      {/* Gender */}
      <div style={S.section}>
        <label style={S.qLabel}>What is your gender?</label>
        <input
          type="text"
          value={gender}
          onChange={e => setGender(e.target.value)}
          placeholder="e.g. woman, man, non-binary, prefer not to say…"
          style={S.textInput}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Racialized / POC */}
      <div style={S.section}>
        <label style={S.qLabel}>Do you identify as a racialized person or person of colour?</label>
        <div style={S.optionRow}>
          {[
            { value: 'yes',                  label: 'Yes' },
            { value: 'no',                   label: 'No' },
            { value: 'prefer_not_to_answer', label: 'Prefer not to answer' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setRacialized(opt.value)}
              style={{ ...S.optBtn, ...(racialized === opt.value ? S.optBtnSel : {}) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SES Ladder */}
      <div style={S.section}>
        <label style={S.qLabel}>Where do you stand on the social ladder?</label>
        <p style={S.prompt}>{SES_PROMPT}</p>
        <div style={S.ladderWrap}>
          <div style={S.ladderTopLabel}>Top — best off</div>
          <div style={S.ladderTrack}>
            {/* Left post */}
            <div style={S.post} />
            {/* Rungs: 10 at top, 1 at bottom */}
            <div style={S.rungs}>
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                <button
                  key={n}
                  onClick={() => setSesLadder(n)}
                  style={{ ...S.rung, ...(sesLadder === n ? S.rungSel : {}) }}
                >
                  <span style={S.rungNum}>{n}</span>
                </button>
              ))}
            </div>
            {/* Right post */}
            <div style={S.post} />
          </div>
          <div style={S.ladderBottomLabel}>Bottom — worst off</div>
        </div>
      </div>

      {error && <p style={S.error}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || saving}
        style={{ ...S.submitBtn, opacity: canSubmit && !saving ? 1 : 0.4, cursor: canSubmit && !saving ? 'pointer' : 'default' }}
      >
        {saving ? 'Saving…' : 'Continue →'}
      </button>
    </div>
  )
}

const S = {
  wrap: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '40px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 36,
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  title: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 32, fontWeight: 400, color: 'var(--tx)', margin: 0,
  },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: 0, lineHeight: 1.6 },

  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  qLabel:  { fontSize: 16, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.4 },
  prompt:  { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.65, margin: 0, background: '#faf7fb', border: '1px solid var(--bd)', borderRadius: 10, padding: '14px 16px' },

  numberInput: {
    width: 120, padding: '10px 14px', boxSizing: 'border-box',
    border: '1px solid var(--bd)', borderRadius: 10,
    fontFamily: '"Space Mono",monospace', fontSize: 15, color: 'var(--tx)',
    background: '#fff', outline: 'none',
  },
  textInput: {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    border: '1px solid var(--bd)', borderRadius: 10,
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 15, color: 'var(--tx)',
    background: '#fff', outline: 'none',
  },

  optionRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  optBtn: {
    padding: '10px 20px', borderRadius: 10,
    border: '1px solid var(--bd)', background: '#fff',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx2)',
    cursor: 'pointer', transition: 'all 0.12s',
  },
  optBtnSel: {
    background: 'var(--pkb)', color: 'var(--pk)',
    border: '1px solid var(--pk)', fontWeight: 600,
  },

  // Ladder
  ladderWrap:        { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, userSelect: 'none' },
  ladderTopLabel:    { fontSize: 12, color: 'var(--tx3)', fontFamily: '"Space Mono",monospace' },
  ladderBottomLabel: { fontSize: 12, color: 'var(--tx3)', fontFamily: '"Space Mono",monospace' },
  ladderTrack:       { display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 0 },
  post: {
    width: 6, background: 'var(--bd)', borderRadius: 3,
    alignSelf: 'stretch', flexShrink: 0,
  },
  rungs: { display: 'flex', flexDirection: 'column', gap: 0 },
  rung: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 200, height: 40,
    background: '#fff', border: 'none', borderTop: '2px solid var(--bd)',
    cursor: 'pointer', transition: 'background 0.1s',
  },
  rungSel: { background: 'var(--pkb)' },
  rungNum: {
    fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx)',
    fontWeight: 600,
  },

  submitBtn: {
    alignSelf: 'flex-start',
    background: 'var(--pk)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '13px 32px',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 16, fontWeight: 500,
    transition: 'opacity 0.15s',
  },
  error: { fontSize: 14, color: '#dc2626', margin: 0 },
}
