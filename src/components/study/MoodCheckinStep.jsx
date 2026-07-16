import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import { slotFromSendTime, comparisonAnchor } from '../../lib/checkinSlot'

// Zerin Langerian Mindfulness study — daily mood check-in.
//   subcategory 'mood_checkin'            → Self-Monitoring arm (rating + direction)
//   subcategory 'mood_checkin_reflective' → Reflective arm (rating + direction + reason)
// Day + time slot come from the schedule (studyDay / sendTime), so one widget
// serves all three daily slots. Writes one row to zerin_daily_checkins.

const RATING_MIN = 1
const RATING_MAX = 7
const DIRECTIONS = [
  { value: 'better', label: 'Better' },
  { value: 'same',   label: 'About the same' },
  { value: 'worse',  label: 'Worse' },
]

export default function MoodCheckinStep({
  enrollment,
  scheduleId = null,
  studyDay = null,
  sendTime = null,
  subcategory = 'mood_checkin',
  onComplete,
  supabaseClient,
  isSimMode = false,
  previewMode = false,
}) {
  const db = supabaseClient ?? globalSupabase
  const reflective = subcategory === 'mood_checkin_reflective'
  const arm  = reflective ? 'reflective' : 'self_monitoring'
  const slot = slotFromSendTime(sendTime)
  const anchor = comparisonAnchor(slot)

  const [rating,    setRating]    = useState(null)
  const [direction, setDirection] = useState(null)
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  const studyId = enrollment?.studies?.id ?? enrollment?.study_id ?? null
  const userId  = enrollment?.profile_id ?? enrollment?.user_id ?? null

  // Admin simulate run: auto-fill and submit so the flow advances.
  useEffect(() => {
    if (!isSimMode) return
    const t = setTimeout(() => { submit(5, 'same', reflective ? 'Simulated response.' : '') }, 400)
    return () => clearTimeout(t)
  }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit =
    rating != null &&
    direction != null &&
    (!reflective || reason.trim().length > 0)

  async function submit(r, d, why) {
    if (previewMode) { onComplete?.({ preview: true }); return }
    setSaving(true)
    setError(null)
    const { error: dbErr } = await db.from('zerin_daily_checkins').insert({
      user_id:     userId,
      study_id:    studyId,
      external_id: enrollment?.external_id ?? null,
      schedule_id: scheduleId,
      study_day:   studyDay,
      slot,
      arm,
      rating:      r,
      direction:   d,
      reason:      reflective ? (why ?? '').trim() : null,
      tip_text:    null,
    })
    setSaving(false)
    if (dbErr) {
      setError('Could not save — please try again.')
      console.error('zerin_daily_checkins insert:', dbErr)
      return
    }
    onComplete?.({})
  }

  function handleSubmit() {
    if (!canSubmit || saving) return
    submit(rating, direction, reason)
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <p style={S.eyebrow}>Daily check-in{studyDay ? ` · Day ${studyDay}` : ''}</p>
        <h2 style={S.heading}>How are you feeling right now?</h2>
        <p style={S.scaleHint}>1 = very bad&nbsp;&nbsp;·&nbsp;&nbsp;7 = very good</p>

        <div style={S.ratingRow}>
          {Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => { setRating(n); setError(null) }}
              style={{
                ...S.ratingBtn,
                borderColor: rating === n ? 'var(--pk)' : 'var(--bd)',
                background:  rating === n ? 'var(--pk)' : '#fff',
                color:       rating === n ? '#fff' : 'var(--tx)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={S.anchorRow}>
          <span>Very bad</span>
          <span>Very good</span>
        </div>

        <p style={S.qLabel}>Compared to {anchor}, how are you feeling?</p>
        <div style={S.dirRow}>
          {DIRECTIONS.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => { setDirection(d.value); setError(null) }}
              style={{
                ...S.dirBtn,
                borderColor: direction === d.value ? 'var(--pk)' : 'var(--bd)',
                background:  direction === d.value ? 'var(--bg)' : '#fff',
                color:       direction === d.value ? 'var(--pk)' : 'var(--tx)',
                fontWeight:  direction === d.value ? 600 : 400,
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {reflective && (
          <div style={S.reasonWrap}>
            <label style={S.qLabel}>In a sentence or two, what&rsquo;s behind how you feel?</label>
            <textarea
              style={S.textarea}
              rows={3}
              placeholder="e.g. I just finished a workout and feel more relaxed."
              value={reason}
              onChange={e => { setReason(e.target.value); setError(null) }}
            />
          </div>
        )}

        {error && <p style={S.errMsg}>{error}</p>}

        <button
          style={{ ...S.btn, opacity: (!canSubmit || saving) ? 0.5 : 1 }}
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
  wrap:      { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 24px', minHeight: '60vh' },
  card:      { background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, padding: '36px 32px', maxWidth: 540, width: '100%' },
  eyebrow:   { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' },
  heading:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  scaleHint: { fontSize: 13, color: 'var(--tx2)', margin: '0 0 18px', fontFamily: '"DM Sans",system-ui,sans-serif' },
  ratingRow: { display: 'flex', gap: 8, justifyContent: 'space-between' },
  ratingBtn: { flex: 1, aspectRatio: '1 / 1', minWidth: 0, border: '1.5px solid', borderRadius: 10, fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', transition: 'all 0.12s' },
  anchorRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '6px 2px 24px' },
  qLabel:    { fontSize: 15, fontWeight: 600, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '0 0 10px', display: 'block' },
  dirRow:    { display: 'flex', gap: 10, marginBottom: 8 },
  dirBtn:    { flex: 1, border: '1.5px solid', borderRadius: 10, padding: '12px 10px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', transition: 'all 0.12s' },
  reasonWrap:{ marginTop: 22 },
  textarea:  { width: '100%', boxSizing: 'border-box', fontSize: 15, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 14px', color: 'var(--tx)', background: '#fff', resize: 'vertical', lineHeight: 1.5 },
  errMsg:    { fontSize: 13, color: '#e04', background: 'var(--err-bg)', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: '16px 0 0' },
  btn:       { display: 'block', width: '100%', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '13px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', marginTop: 24 },
}
