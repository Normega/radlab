import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import SurveyComponentRenderer from '../questionnaire/composable/SurveyComponentRenderer'
import { responseIsComplete, DB_COMPONENT_TYPE } from '../questionnaire/composable/componentRegistry'
import { useSubmitLock } from '../../lib/useSubmitLock'
import '../questionnaire/composable/composableSurvey.css'

/**
 * Mounts inside StepDispatcher for the standalone composable instruments
 * (categories likert_slider / multiple_choice / open_list / hierarchy;
 * subcategory = the composable_instruments slug).
 *
 * Loads the instrument definition, renders the production component with the
 * controlled config/value/onChange contract, and on submit writes ONE
 * instrument_responses row. Save path follows the CLAUDE.md participant-data
 * rules: schedule_id + step_index recorded (rule 1/3), useSubmitLock as the
 * client half and the 20260825 dedupe trigger as the DB half of the duplicate
 * guard (rule 2), instrument_slug/type denormalized onto the row so the
 * export names columns from recorded facts (rule 3).
 */


export default function ComposableInstrumentStepWrapper({
  subcategory,            // instrument slug
  enrollment,
  scheduleId = null,
  stepIndex,
  totalSteps,
  onComplete,
  supabaseClient,
  isSimMode = false,
  demoMode = false,
}) {
  const db     = supabaseClient ?? globalSupabase
  const userId = enrollment?.profile_id ?? enrollment?.user_id
  const slug   = subcategory

  const { data: instrument, isLoading, error } = useQuery({
    queryKey: ['composable-instrument', slug],
    queryFn: async () => {
      const { data, error } = await db
        .from('composable_instruments').select('*').eq('slug', slug).single()
      if (error) throw error
      return data
    },
  })

  const [value, setValue]         = useState(undefined)
  const [saveError, setSaveError] = useState(null)
  const { submit, busy } = useSubmitLock(slug)

  if (isSimMode) {
    setTimeout(() => onComplete?.({ sim: true }), 0)
    return (
      <div style={S.loading}>
        <span style={S.mono}>Sim mode — skipping instrument step</span>
      </div>
    )
  }

  if (isLoading)   return <div style={S.loading}>Loading instrument…</div>
  if (error)       return <div style={S.err}>Could not load instrument "{slug}": {error.message}</div>
  if (!instrument) return <div style={S.err}>Instrument "{slug}" not found.</div>

  const componentType = DB_COMPONENT_TYPE[instrument.type]
  if (!componentType) {
    return <div style={S.err}>Instrument "{slug}" has unknown type "{instrument.type}".</div>
  }

  const config   = { id: instrument.slug, type: componentType, ...instrument.config }
  const complete = responseIsComplete(config, value)

  async function handleSubmit() {
    if (!complete || busy) return
    setSaveError(null)
    await submit(async () => {
      if (!demoMode && userId) {
        const { error } = await db.from('instrument_responses').insert({
          user_id:         userId,
          instrument_id:   instrument.id,
          instrument_slug: instrument.slug,
          instrument_type: instrument.type,
          schedule_id:     scheduleId ?? null,
          step_index:      stepIndex ?? null,
          response:        value,
        })
        // Thrown so the lock releases and the participant can retry —
        // advancing past a failed save would lose the response silently.
        if (error) throw error
      }
      onComplete?.({ instrument_slug: instrument.slug, instrument_type: instrument.type, value })
    }).catch(err => {
      console.error('instrument_responses insert:', err)
      setSaveError(err.message)
    })
  }

  return (
    <div style={S.wrap}>
      {stepIndex != null && totalSteps != null && (
        <p style={S.partLabel}>{stepIndex + 1} of {totalSteps}</p>
      )}
      <div className="cs-page">
        <SurveyComponentRenderer config={config} value={value} onChange={setValue} />
      </div>
      {saveError && (
        <p style={S.errMsg}>Could not save your response: {saveError}. Please try again.</p>
      )}
      <div style={S.btnRow}>
        <button
          type="button"
          className="cs-primary-button"
          disabled={!complete || busy}
          onClick={handleSubmit}
        >
          {busy ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

const S = {
  wrap:      { padding: '40px 24px 60px', maxWidth: 860, margin: '0 auto', fontFamily: '"DM Sans",system-ui,sans-serif' },
  partLabel: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', margin: '0 0 16px' },
  btnRow:    { display: 'flex', justifyContent: 'flex-end', marginTop: 24 },
  errMsg:    { fontSize: 14, color: 'var(--err-tx)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 8, padding: '8px 14px', marginTop: 16 },
  loading:   { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:       { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
  mono:      { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
}
