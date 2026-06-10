import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
  isSimMode = false,
}) {
  const moduleId = node?.module_id ?? node?.activities?.subcategory

  const [trainingModule,  setTrainingModule]  = useState(null)
  const [participantId,   setParticipantId]   = useState(null)
  const [studyDay,        setStudyDay]        = useState(1)
  const [error,           setError]           = useState(null)

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
      setTrainingModule(mod.definition)
      setStudyDay(mod.lesson)

      // Look up the liliana_participants row for this profile
      const { data: lp } = await supabase
        .from('liliana_participants')
        .select('id, current_day')
        .eq('profile_id', enrollment.profile_id)
        .maybeSingle()
      if (lp) {
        setParticipantId(lp.id)
        setStudyDay(lp.current_day)
      }
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
    return (
      <div style={S.loading}>Loading training…</div>
    )
  }

  return (
    <InterventionPage
      module={trainingModule}
      participantId={participantId}
      scheduleId={scheduleId}
      studyDay={studyDay}
      onComplete={onComplete}
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
