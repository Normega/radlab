import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import { useSubmitLock } from '../../lib/useSubmitLock'
import SaveRetryBanner from './SaveRetryBanner'
import PacedBreathing from './practiceTask/PacedBreathing'
import ReadingTask from './practiceTask/ReadingTask'
import './practiceTask/practiceTask.css'

/**
 * Mounts inside StepDispatcher for category 'practice_task' (2026-11-04).
 *
 * Sandy Study 4, step 6: after the stressor, each participant does either a
 * breathing practice or a short reading task, at random. One session step
 * covers both arms; which one a participant gets is the study's assignment
 * slot (studies.assignment_slots, drawn by draw_assignment before the session
 * starts and passed down as `assignments`). The arms are never named
 * relaxation or control on screen.
 *
 *   subcategory 'breathing_or_reading' → composable instrument
 *   'breathing-or-reading'. Its `config` may set:
 *     slot               the assignment slot to read   (default 'relaxation_arm')
 *     breathing_seconds  inhale_ms  exhale_ms  settle_ms   (defaults 240 / 4000 / 6000 / 2500)
 *     shape              'natural' or 'symmetric' pacer (default 'natural', breathTiming.js)
 *     voice_base         folder of recorded cues for the breathing arm
 *     hold_to_inhale     true: hold a button or the space bar while breathing in,
 *                        scored as an adherence check (breathHold.js)
 *     passage            reading passage key           (default 'mail_sorting_centre')
 *
 * Saved as ONE instrument_responses row (instrument type 'practice_task',
 * schedule_id and step_index recorded: CLAUDE.md data rules 1-3), behind
 * useSubmitLock and the table's duplicate trigger (rules 2 and 5). A failed save
 * stays on screen with a retry and never advances the session.
 *
 * Fails closed on the arm: if the slot has no drawn value, the step does not
 * start. It never picks an arm itself, because the server owns the balance.
 *
 * demoMode (the session demo, and /admin/practice-preview) renders the real
 * screens and writes nothing; an arm picker stands in for the draw.
 */

const SOURCES = {
  breathing_or_reading: { slug: 'breathing-or-reading' },
}

const ARMS = ['breathing', 'reading']
const DEFAULT_SLOT = 'relaxation_arm'
const VERSION = 'practice_task_v1'

export default function PracticeTaskStep({
  subcategory,
  enrollment,
  scheduleId = null,
  stepIndex,
  onComplete,
  supabaseClient,
  isSimMode = false,
  demoMode = false,
  assignments = null,
  previewArm = null,      // /admin/practice-preview: arm chosen on the page
  previewConfig = null,   // …and its timing overrides (a short practice)
}) {
  const db     = supabaseClient ?? globalSupabase
  const userId = enrollment?.profile_id ?? enrollment?.user_id
  const source = SOURCES[subcategory]
  const live   = !demoMode && !isSimMode

  const [demoArm, setDemoArm]     = useState(previewArm)
  const [saveError, setSaveError] = useState(null)
  const [pending, setPending]     = useState(null)
  const [demoResult, setDemoResult] = useState(null)
  const shownAt = useRef(new Date().toISOString())
  const { submit, busy } = useSubmitLock(`practice:${subcategory}:${scheduleId ?? 'none'}`)

  const { data: instrument, error: instErr, isLoading } = useQuery({
    queryKey: ['composable-instrument', source?.slug],
    enabled:  !!source && live,
    queryFn:  async () => {
      const { data, error } = await db.from('composable_instruments').select('id, slug, type, config').eq('slug', source.slug).single()
      if (error) throw error
      return data
    },
  })

  const config = { ...(instrument?.config ?? {}), ...(previewConfig ?? {}) }
  const slot   = config.slot ?? DEFAULT_SLOT
  const drawn  = assignments?.[slot]
  const arm    = demoMode ? demoArm : (ARMS.includes(drawn) ? drawn : null)

  const save = useCallback(async response => {
    setSaveError(null)
    setPending(response)
    await submit(async () => {
      if (live) {
        // a live step with no participant would otherwise "finish" unsaved
        if (!userId) throw new Error('no participant on this session')
        const { error } = await db.from('instrument_responses').insert({
          user_id:         userId,
          instrument_id:   instrument.id,
          instrument_slug: instrument.slug,
          instrument_type: instrument.type,
          schedule_id:     scheduleId ?? null,
          step_index:      stepIndex ?? null,
          response,
        })
        // thrown so the lock releases and the save can be retried
        if (error) throw error
      }
      if (demoMode && !onComplete) { setDemoResult(response); return }
      onComplete?.({ instrument_slug: source.slug, instrument_type: 'practice_task', value: response })
    }).catch(err => {
      console.error('practice task save:', err)
      setSaveError(err.message)
    })
  }, [submit, live, userId, instrument, db, scheduleId, stepIndex, onComplete, source, demoMode])

  const finish = useCallback(result => {
    save({
      version:   VERSION,
      arm,
      slot,
      completed: true,
      shown_at:  shownAt.current,
      ended_at:  new Date().toISOString(),
      breathing: arm === 'breathing' ? result : null,
      reading:   arm === 'reading' ? result : null,
    })
  }, [save, arm, slot])

  // simulation: nothing to run
  useEffect(() => { if (isSimMode) onComplete?.({ simulated: true }) }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!source) return <div className="pt-note">Unknown practice task “{subcategory}”.</div>
  if (isSimMode) return null
  if (live && instErr) return <div className="pt-note">This part of the session could not load ({instErr.message}). Please reload the page.</div>
  if (live && isLoading) return null
  if (live && !arm) {
    console.error(`practice task: no drawn value for assignment slot "${slot}"`, assignments)
    return <div className="pt-note">This part of the session could not start. Please reload the page. If it happens again, contact the research team.</div>
  }

  if (demoMode && !arm) {
    return (
      <div className="pt-page">
        <div className="pt-demo">
          <strong>Demo:</strong> participants are assigned one of these at random (slot <code>{slot}</code>). Pick one to see it.
          <div className="pt-actions">
            <button type="button" className="pt-btn-quiet" onClick={() => setDemoArm('breathing')}>Breathing practice</button>
            <button type="button" className="pt-btn-quiet" onClick={() => setDemoArm('reading')}>Reading task</button>
            {onComplete && <button type="button" className="pt-btn-quiet" onClick={() => onComplete({ demo_skipped: true })}>Skip step</button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-page">
      {demoResult ? (
        <div className="pt-demo">
          <strong>Preview finished. Nothing was saved.</strong> This is the record a participant’s session would save:
          <pre>{JSON.stringify(demoResult, null, 2)}</pre>
        </div>
      ) : arm === 'breathing' ? (
        <PacedBreathing config={config} demoMode={demoMode} onDone={finish} />
      ) : (
        <ReadingTask config={config} onDone={finish} />
      )}
      {saveError && <SaveRetryBanner message={saveError} busy={busy} onRetry={() => save(pending)} />}
    </div>
  )
}
