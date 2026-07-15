import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import { slotFromSendTime } from '../../lib/checkinSlot'

// Zerin Langerian Mindfulness study — Attention-Control arm daily touchpoint.
// Shows the day/slot-specific wellness tip (identical contact cadence to the two
// mood arms, but no mood data collected) + an acknowledge step so contact time is
// matched across arms. Writes one row to zerin_daily_checkins (arm='control').
//
// Tip text is the full 21-day × 3-slot script from the study briefing (§3.1),
// verbatim. Keyed by study day (1-21) then slot.

export const CONTROL_TIPS = {
  1:  { morning: 'Good morning. Drink water.',                                afternoon: "If you've been sitting, stand up or stretch briefly.", evening: 'Take a short break from screens before bed.' },
  2:  { morning: 'Morning. Get some daylight if possible.',                   afternoon: 'Stand up and stretch for 2 minutes.',                evening: 'Slow your breathing for 1 minute.' },
  3:  { morning: 'Good morning. Choose one small task to complete today.',    afternoon: 'Pause briefly.',                                     evening: 'Do a low-effort activity before bed (e.g., music or reading).' },
  4:  { morning: 'Morning. Drink water.',                                     afternoon: 'Step outside for a minute if possible.',             evening: 'Avoid screens for 30 minutes before bed.' },
  5:  { morning: 'Good morning. Set one small goal for today.',               afternoon: 'Move or stretch briefly.',                           evening: 'Think of one thing that went okay today.' },
  6:  { morning: 'Morning. Eat a snack if needed.',                           afternoon: 'Take three slow breaths.',                           evening: 'Write one sentence about your day.' },
  7:  { morning: 'Good morning. Contact someone if needed.',                  afternoon: 'Drink water. Rest your eyes.',                       evening: 'Begin your usual bedtime routine.' },
  8:  { morning: 'Morning. Do one small personal task today.',                afternoon: 'Take a 5-minute movement break.',                    evening: 'Use a breathing exercise before sleep.' },
  9:  { morning: 'Good morning. Look around as you start the day.',           afternoon: 'Check posture and adjust.',                          evening: 'Lower light levels before bed.' },
  10: { morning: 'Morning. Set one manageable goal.',                        afternoon: 'Go outside briefly if possible.',                    evening: 'Review the day briefly.' },
  11: { morning: 'Good morning. Write a short plan for today.',              afternoon: 'Drink water.',                                       evening: 'Listen to something you like for a few minutes.' },
  12: { morning: 'Morning. Take a short walk if possible.',                  afternoon: 'Take three slow breaths.',                           evening: 'Stop using devices 30 minutes before bed.' },
  13: { morning: 'Good morning. Eat breakfast if possible.',                 afternoon: 'Stretch briefly.',                                   evening: 'Do a relaxing activity before sleep.' },
  14: { morning: 'Morning. Do one small self-directed task today.',          afternoon: 'Check for muscle tension and release it.',           evening: 'Write down one positive item from today.' },
  15: { morning: 'Good morning. Plan one simple activity today.',            afternoon: 'Take a short movement break.',                       evening: 'Listen to music while winding down.' },
  16: { morning: 'Morning. Set a small achievable task.',                    afternoon: 'Check screen usage.',                                evening: 'Tense and relax muscle groups for a few minutes.' },
  17: { morning: 'Morning. Contact someone supportive if needed.',           afternoon: 'Avoid social media for 10 minutes.',                 evening: 'Read or listen to something light.' },
  18: { morning: 'Good morning. Eat a snack if energy is low.',              afternoon: 'Focus on breathing for 60 seconds.',                 evening: 'Stretch lightly before bed.' },
  19: { morning: 'Morning. Choose one concrete task to complete.',           afternoon: 'Pause for two minutes.',                             evening: 'Write one sentence about today.' },
  20: { morning: 'Morning. Get daylight exposure if possible.',              afternoon: 'Stretch and drink water.',                           evening: 'Do a calm activity before bed.' },
  21: { morning: 'Final morning: thank you for participating.',              afternoon: 'Take a short pause.',                                evening: 'Final reminder: complete the post-study survey tomorrow.' },
}

export default function WellnessTipStep({
  enrollment,
  scheduleId = null,
  studyDay = null,
  sendTime = null,
  onComplete,
  supabaseClient,
  isSimMode = false,
  previewMode = false,
}) {
  const db = supabaseClient ?? globalSupabase
  const slot = slotFromSendTime(sendTime)

  // Live: look up by day+slot. Preview (no schedule context): show a sample.
  const effectiveDay  = previewMode && studyDay == null ? 1 : studyDay
  const effectiveSlot = previewMode && slot == null ? 'morning' : slot
  const tip = CONTROL_TIPS[effectiveDay]?.[effectiveSlot]
    ?? 'Take a brief moment for yourself before continuing.'

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const studyId = enrollment?.studies?.id ?? enrollment?.study_id ?? null
  const userId  = enrollment?.profile_id ?? enrollment?.user_id ?? null

  useEffect(() => {
    if (!isSimMode) return
    const t = setTimeout(() => acknowledge(), 400)
    return () => clearTimeout(t)
  }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function acknowledge() {
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
      arm:         'control',
      rating:      null,
      direction:   null,
      reason:      null,
      tip_text:    tip,
    })
    setSaving(false)
    if (dbErr) {
      setError('Could not save — please try again.')
      console.error('zerin_daily_checkins (control) insert:', dbErr)
      return
    }
    onComplete?.({})
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <p style={S.eyebrow}>Daily check-in{effectiveDay ? ` · Day ${effectiveDay}` : ''}</p>
        <p style={S.tip}>{tip}</p>
        {error && <p style={S.errMsg}>{error}</p>}
        <button
          style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}
          onClick={acknowledge}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Got it'}
        </button>
      </div>
    </div>
  )
}

const S = {
  wrap:    { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '60px 24px', minHeight: '60vh' },
  card:    { background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, padding: '40px 34px', maxWidth: 480, width: '100%', textAlign: 'center' },
  eyebrow: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 20px' },
  tip:     { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 24, lineHeight: 1.4, color: 'var(--tx)', margin: '0 0 32px' },
  errMsg:  { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: '0 0 16px' },
  btn:     { display: 'block', width: '100%', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '13px 20px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
