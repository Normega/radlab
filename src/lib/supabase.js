import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Save a completed PondWatch session to Supabase.
// Inserts game_sessions → trials (bulk) → performance in sequence.
export async function savePondWatchSession({ userId, studyId, gameName, startedAt, endedAt, trials, metrics }) {
  const { data: session, error: sessionErr } = await supabase
    .from('game_sessions')
    .insert({ user_id: userId, game_name: gameName, study_id: studyId, started_at: startedAt, ended_at: endedAt })
    .select('id')
    .single()

  if (sessionErr) { console.error('savePondWatchSession: session insert failed', sessionErr); return null }

  const sessionId = session.id

  // Get the current max cumulative trial number for this user across all games
  const { data: maxRow } = await supabase
    .from('trials')
    .select('cumulative_trial_number, game_sessions!inner(user_id)')
    .eq('game_sessions.user_id', userId)
    .order('cumulative_trial_number', { ascending: false })
    .limit(1)
    .single()

  const nextCumulativeTrialNumber = (maxRow?.cumulative_trial_number ?? 0) + 1

  const { error: trialsErr } = await supabase.from('trials').insert(
    trials.map((t, i) => ({
      session_id:               sessionId,
      trial_number:             t.trialNumber,
      cumulative_trial_number:  nextCumulativeTrialNumber + i,
      stimulus_type:            t.stimulusType,
      is_target:                t.isTarget,
      responded:                t.responded,
      reaction_time_ms:         t.reactionTime,
    }))
  )
  if (trialsErr) console.error('savePondWatchSession: trials insert failed', trialsErr)

  const { error: perfErr } = await supabase.from('performance').insert({
    session_id:       sessionId,
    hit_rate:         metrics.hitRate,
    false_alarm_rate: metrics.falseAlarmRate,
    d_prime:          metrics.dPrime,
    criterion:        metrics.criterion,
    median_rt_ms:     metrics.medianRtMs,
    rt_sd_ms:         metrics.rtSdMs,
    accuracy:         metrics.accuracy,
  })
  if (perfErr) console.error('savePondWatchSession: performance insert failed', perfErr)

  return sessionId
}

// Save a completed Ebb & Flow session to Supabase.
// Inserts game_sessions → trials (bulk), updates profiles ebb_flow_* columns.
export async function saveEbbFlowSession({
  user_id, trials, session_score, total_score, total_trials,
  quest_state, game_mode, new_mode_unlocked, session_sync_mean,
}) {
  const now = new Date().toISOString()

  // Insert game session record
  const { data: gameSession, error: sessionErr } = await supabase
    .from('game_sessions')
    .insert({ user_id, game_name: 'ebb_flow', started_at: now, ended_at: now })
    .select('id')
    .single()

  if (sessionErr) { console.error('saveEbbFlowSession: session insert failed', sessionErr); return null }

  const sessionId = gameSession.id

  // Insert per-trial rows (metrics as JSONB)
  if (trials?.length) {
    // Get the current max cumulative trial number for this user across all games
    const { data: maxRow } = await supabase
      .from('trials')
      .select('cumulative_trial_number, game_sessions!inner(user_id)')
      .eq('game_sessions.user_id', user_id)
      .order('cumulative_trial_number', { ascending: false })
      .limit(1)
      .single()

    const nextCumulativeTrialNumber = (maxRow?.cumulative_trial_number ?? 0) + 1

    const { error: trialsErr } = await supabase.from('trials').insert(
      trials.map((t, i) => ({
        session_id:               sessionId,
        trial_number:             t.trial_number,
        cumulative_trial_number:  nextCumulativeTrialNumber + i,
        stimulus_type:            t.trial_type,
        is_target:                t.trial_type !== 'catch',
        responded:                t.response !== null,
        reaction_time_ms:         t.reaction_time_ms,
        metrics:                  t,
      }))
    )
    if (trialsErr) console.error('saveEbbFlowSession: trials insert failed', trialsErr)
  }

  // Update profiles ebb_flow_* columns
  const profileUpdate = {
    ebb_flow_total_trials:   total_trials,
    ebb_flow_total_score:    total_score,
    ebb_flow_quest_state:    quest_state,
    ebb_flow_game_mode:      game_mode,
    ebb_flow_last_session_at: now,
    points:                  total_score, // mirror to main points column
  }
  if (new_mode_unlocked === 'listener') profileUpdate.ebb_flow_listener_unlocked_at = now
  if (new_mode_unlocked === 'empath')   profileUpdate.ebb_flow_empath_unlocked_at   = now

  const { error: profileErr } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user_id)
  if (profileErr) console.error('saveEbbFlowSession: profile update failed', profileErr)

  return sessionId
}
