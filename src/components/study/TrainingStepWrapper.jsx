import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import InterventionPage from './InterventionPage'

const SIM_MODULE = {
  module_id: 'sim-training',
  condition:  'non_reactivity',
  phase:      'phase1',
  lesson:     1,
  title:      'Training (simulation)',
  subtitle:   'Sim mode — no data saved',
  lead_in:    { owl: 'owl_waving',  text: 'Welcome to today\'s training. (Simulation mode)' },
  steps:      [],
  lead_out:   { owl: 'owl_happy',   text: 'Practice complete. (Simulation)' },
}

export default function TrainingStepWrapper({
  node,
  enrollment,
  scheduleId,
  onComplete,
  supabaseClient = null,
  isSimMode = false,
}) {
  // Participant sessions run on SessionEntry's isolated authenticated client;
  // the global client (anon on a link) would silently fail every save.
  const supabase = supabaseClient ?? globalSupabase

  const moduleId = node?.module_id ?? node?.activities?.subcategory

  const [trainingModule, setTrainingModule] = useState(null)
  const [participantId,  setParticipantId]  = useState(null)
  const [dayDataId,      setDayDataId]      = useState(null)
  const [studyDay,       setStudyDay]       = useState(1)
  const [error,          setError]          = useState(null)

  useEffect(() => {
    if (isSimMode) {
      setTrainingModule(SIM_MODULE)
      return
    }
    if (!moduleId || !enrollment?.profile_id) return

    async function load() {
      // Fetch the module definition
      const { data: mod, error: me } = await supabase
        .from('intervention_modules')
        .select('definition, lesson')
        .eq('module_id', moduleId)
        .single()
      if (me) { setError(me.message); return }

      const definition = mod.definition
      setTrainingModule(definition)

      // Ensure the liliana_participants row exists (self-created on first
      // training contact) and derive the day from the schedule row — the
      // stored current_day counter alone never advanced, which would have
      // pinned every day's data to study_day 1 (WP-L5 dry-run finding).
      const { data: lp, error: lpErr } = await supabase.rpc('ensure_liliana_participant', {
        p_schedule_id: scheduleId ?? null,
      })

      if (lpErr || !lp?.participant_id) return  // no participant context — nothing saved

      const pid      = lp.participant_id
      const day      = lp.study_day
      const phaseLbl = definition.phase === 'phase1' ? 'Phase 1' : 'Phase 2'
      const sessName = `${phaseLbl} · Day ${day}`

      setParticipantId(pid)
      setStudyDay(day)

      // Create the day row on first attempt; SELECT the existing one on re-entry.
      // UNIQUE(participant_id, study_day) means only the first attempt creates it —
      // re-openers get the existing row and preserve the original started_at.
      let dayRow = null

      const { data: existing } = await supabase
        .from('liliana_day_data')
        .select('id, module_id')
        .eq('participant_id', pid)
        .eq('study_day', day)
        .maybeSingle()

      if (existing) {
        dayRow = existing
        // Backfill the condition stamp on rows created before module_id existed
        // (or by an interrupted first attempt).
        if (!existing.module_id && moduleId) {
          await supabase
            .from('liliana_day_data')
            .update({ module_id: moduleId })
            .eq('id', existing.id)
        }
      } else {
        const { data: inserted } = await supabase
          .from('liliana_day_data')
          .insert({
            participant_id: pid,
            study_day:      day,
            session_name:   sessName,
            module_id:      moduleId,
            started_at:     new Date().toISOString(),
          })
          .select('id')
          .single()
        dayRow = inserted
      }

      if (dayRow) setDayDataId(dayRow.id)
    }

    load()
  }, [moduleId, enrollment?.profile_id, isSimMode])

  if (error) {
    return (
      <div style={S.error}>
        Failed to load training module "{moduleId}": {error}
      </div>
    )
  }

  if (!trainingModule) {
    return <div style={S.loading}>Loading training…</div>
  }

  return (
    <InterventionPage
      module={trainingModule}
      participantId={participantId}
      dayDataId={dayDataId}
      scheduleId={scheduleId}
      studyDay={studyDay}
      onComplete={onComplete}
      supabaseClient={supabase}
    />
  )
}

const S = {
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 300,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 15, color: '#888780',
  },
  error: {
    padding: 40, textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 14, color: '#c0392b',
  },
}
