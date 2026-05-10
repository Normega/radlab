import { supabase } from '../../../lib/supabase.js'

/**
 * Save a completed Farm Joy session to Supabase.
 *
 * data shape:
 *   userId, startedAt,
 *   decisions       — [{word, category, veggie, round1_choice, round1_rt_ms}] × 24
 *   greenhouse      — [value obj] up to 6 (null slots excluded)
 *   finalValues     — [value obj] up to 3
 *   endedEarly      — boolean (zero-plant path)
 *   feedbackEvents  — [{round, user_responded, suggested_value}]
 *   durationMs      — total session ms
 */
export async function saveFarmJoySession({
  userId, startedAt,
  decisions, greenhouse, finalValues,
  endedEarly, feedbackEvents, durationMs,
}) {
  if (!userId) return null

  const now        = new Date().toISOString()
  const ghWords    = greenhouse.map(v => v.word)
  const finalWords = finalValues.map(v => v.word)
  const planted    = decisions.filter(d => d.round1_choice === 'selected')
  const sampled    = decisions.map(d => d.word)

  // 1. game_sessions row
  const { data: gs, error: gsErr } = await supabase
    .from('game_sessions')
    .insert({ user_id: userId, game_name: 'farm_joy', started_at: startedAt, ended_at: now })
    .select('id').single()
  if (gsErr) { console.error('FarmJoy: game_sessions insert', gsErr); return null }
  const sessionId = gs.id

  // 2. farm_joy_trials (one per value shown)
  const trialRows = decisions.map((d, i) => ({
    session_id:    sessionId,
    user_id:       userId,
    trial_number:  i + 1,
    value_word:    d.word,
    category:      d.category,
    veggie:        d.veggie,
    round1_choice: d.round1_choice,
    round1_rt_ms:  d.round1_rt_ms ?? null,
    in_greenhouse: ghWords.includes(d.word),
    in_final:      finalWords.includes(d.word),
  }))
  const { error: trErr } = await supabase.from('farm_joy_trials').insert(trialRows)
  if (trErr) console.error('FarmJoy: farm_joy_trials insert', trErr)

  // 3. farm_joy_performance
  const { error: perfErr } = await supabase.from('farm_joy_performance').insert({
    session_id:        sessionId,
    user_id:           userId,
    values_sampled:    sampled,
    values_planted:    planted.map(d => d.word),
    values_greenhouse: ghWords,
    values_final:      finalWords,
    ended_early:       endedEarly,
    duration_ms:       durationMs,
  })
  if (perfErr) console.error('FarmJoy: farm_joy_performance insert', perfErr)

  // 4. farm_joy_feedback (one row per feedback event, if any)
  if (feedbackEvents.length > 0) {
    const fbRows = feedbackEvents.map(ev => ({
      session_id:      sessionId,
      user_id:         userId,
      round_triggered: ev.round,
      user_responded:  ev.user_responded,
      suggested_value: ev.suggested_value ?? null,
      values_sampled:  sampled,
    }))
    const { error: fbErr } = await supabase.from('farm_joy_feedback').insert(fbRows)
    if (fbErr) console.error('FarmJoy: farm_joy_feedback insert', fbErr)
  }

  // 5. farm_joy_value_history — read existing then upsert incremented totals
  const { data: existing } = await supabase
    .from('farm_joy_value_history')
    .select('value_word, times_shown, times_planted, times_greenhouse, times_final')
    .eq('user_id', userId)
    .in('value_word', sampled)

  const exMap = new Map((existing ?? []).map(r => [r.value_word, r]))

  const histRows = decisions.map(d => {
    const ex = exMap.get(d.word) ?? {}
    return {
      user_id:          userId,
      value_word:       d.word,
      times_shown:      (ex.times_shown      ?? 0) + 1,
      times_planted:    (ex.times_planted    ?? 0) + (d.round1_choice === 'selected' ? 1 : 0),
      times_greenhouse: (ex.times_greenhouse ?? 0) + (ghWords.includes(d.word)   ? 1 : 0),
      times_final:      (ex.times_final      ?? 0) + (finalWords.includes(d.word) ? 1 : 0),
      updated_at:       now,
    }
  })
  const { error: histErr } = await supabase
    .from('farm_joy_value_history')
    .upsert(histRows, { onConflict: 'user_id,value_word' })
  if (histErr) console.error('FarmJoy: farm_joy_value_history upsert', histErr)

  // 6. profiles — increment sessions, store last core values, award points
  const { data: prof } = await supabase
    .from('profiles').select('farm_joy_sessions, points').eq('id', userId).single()
  const { error: profErr } = await supabase.from('profiles').update({
    farm_joy_sessions:         (prof?.farm_joy_sessions ?? 0) + 1,
    farm_joy_last_core_values: finalWords.length > 0 ? finalWords : null,
    points:                    (prof?.points ?? 0) + (endedEarly ? 5 : 10),
  }).eq('id', userId)
  if (profErr) console.error('FarmJoy: profiles update', profErr)

  return sessionId
}
