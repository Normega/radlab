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

  const { error: trialsErr } = await supabase.from('trials').insert(
    trials.map(t => ({
      session_id:       sessionId,
      trial_number:     t.trialNumber,
      stimulus_type:    t.stimulusType,
      is_target:        t.isTarget,
      responded:        t.responded,
      reaction_time_ms: t.reactionTime,
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
