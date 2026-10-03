import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import { dbWrite } from '../../lib/dbWrite'
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
  demoMode = false,
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
  const [setupError,     setSetupError]     = useState(null)
  const [ready,          setReady]          = useState(false)  // participant + day rows exist
  const [attempt,        setAttempt]        = useState(0)

  useEffect(() => {
    if (isSimMode) {
      setTrainingModule(SIM_MODULE)
      setReady(true)
      return
    }
    if (!moduleId) return
    if (!demoMode && !enrollment?.profile_id) return

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

      // Demo mode: module renders via InterventionPage demoMode (video gates
      // lifted, no participant/day rows, no response saves) — stop here.
      if (demoMode) { setReady(true); return }

      // From here every step must succeed before the module is shown. Before
      // 2026-10-03 a failure here returned quietly and the module rendered
      // anyway with no participant: every answer was skipped, the session
      // completed, and no intervention_responses row existed. Now the
      // participant sees the failure and a retry instead.
      const fail = (what, err) => {
        console.error(`training setup: ${what}`, err)
        setSetupError(err?.message || what)
      }

      // Ensure the liliana_participants row exists (self-created on first
      // training contact) and derive the day from the schedule row — the
      // stored current_day counter alone never advanced, which would have
      // pinned every day's data to study_day 1 (WP-L5 dry-run finding).
      const { data: lp, error: lpErr } = await supabase.rpc('ensure_liliana_participant', {
        p_schedule_id: scheduleId ?? null,
      })

      if (lpErr || !lp?.participant_id) { fail('participant record', lpErr); return }

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

      const readDay = () => supabase
        .from('liliana_day_data')
        .select('id, module_id')
        .eq('participant_id', pid)
        .eq('study_day', day)
        .maybeSingle()
      const { data: existing, error: existingErr } = await readDay()
      if (existingErr) { fail('day record', existingErr); return }

      if (existing) {
        dayRow = existing
        // Backfill the condition stamp on rows created before module_id existed
        // (or by an interrupted first attempt).
        if (!existing.module_id && moduleId) {
          await dbWrite(
            supabase.from('liliana_day_data')
              .update({ module_id: moduleId })
              .eq('id', existing.id)
              .select('id'),
            'liliana_day_data.module_id', { expectRows: true },
          )
        }
      } else {
        const { data: inserted, error: insErr } = await supabase
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
        if (insErr?.code === '23505') {
          // Created a moment ago by another tab or a remount: use that row.
          const { data: raced, error: racedErr } = await readDay()
          if (racedErr || !raced) { fail('day record', racedErr); return }
          dayRow = raced
        } else if (insErr || !inserted) {
          fail('day record', insErr); return
        } else {
          dayRow = inserted
        }
      }

      setDayDataId(dayRow.id)
      setReady(true)
    }

    setSetupError(null)
    load()
  }, [moduleId, enrollment?.profile_id, isSimMode, attempt])

  if (error) {
    return (
      <div style={S.error}>
        Failed to load training module "{moduleId}": {error}
      </div>
    )
  }

  if (setupError) {
    return (
      <div style={S.error}>
        <p style={{ margin: '0 0 16px' }}>
          Today&rsquo;s practice couldn&rsquo;t be set up ({setupError}). Please check your connection and try again.
        </p>
        <button type="button" className="cs-primary-button" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    )
  }

  if (!trainingModule || !ready) {
    return <div style={S.loading}>Loading training…</div>
  }

  return (
    <InterventionPage
      module={trainingModule}
      participantId={demoMode ? null : participantId}
      dayDataId={demoMode ? null : dayDataId}
      scheduleId={scheduleId}
      studyDay={studyDay}
      onComplete={onComplete}
      supabaseClient={supabase}
      demoMode={demoMode}
    />
  )
}

const S = {
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 300,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 15, color: 'var(--tx2)',
  },
  error: {
    padding: 40, textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 14, color: 'var(--err-tx)',
  },
}
