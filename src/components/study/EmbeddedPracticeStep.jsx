import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import { useSubmitLock } from '../../lib/useSubmitLock'

/**
 * Mounts inside StepDispatcher for category 'embedded_practice' (2026-10-08).
 *
 * A practice that lives on another site, run full-screen in a frame inside the
 * radlab session, so a study arm whose practice is elsewhere is still one radlab
 * link a day, with the session's own steps before and after it. The first, and
 * so far only, source is 'sense_foraging': one day of Sense Foraging
 * Foundations in its light version, senseforaging.com/embed/day/N, where N is
 * the schedule row's study day (the Sense Foraging arm of the Fall 2026 class trial).
 *
 * The page posts { source: 'senseforaging', type: 'ready' | 'done', day, ... }
 * to its parent; messages are accepted only from the source's own origins.
 * 'done' carries { practice, sense, practiceMs, quiet }, and is saved as ONE
 * instrument_responses row (instrument type 'embedded_practice', schedule_id and
 * step_index recorded, rules 1-3), behind useSubmitLock and the table's
 * duplicate trigger (rule 2).
 *
 * If the frame has not said 'ready' after FRAME_WAIT_MS, a link opens the same
 * page in a tab of its own; it reports back through window.opener the same way.
 * Where even that is lost (some phone browsers drop the opener), "I've done it"
 * records a self-report, saved as such (completed: null, self_reported: true):
 * a finish the page itself never reported is never written down as one (rule 4).
 */

const SOURCES = {
  sense_foraging: {
    slug: 'sense-foraging-day',
    origins: ['https://senseforaging.com', 'https://www.senseforaging.com'],
    url: day => `https://senseforaging.com/embed/day/${day}`,
    tag: 'senseforaging',
  },
}

const FRAME_WAIT_MS = 12000

export default function EmbeddedPracticeStep({
  subcategory,
  enrollment,
  scheduleId = null,
  studyDay = null,
  stepIndex,
  onComplete,
  supabaseClient,
  isSimMode = false,
  demoMode = false,
}) {
  const db     = supabaseClient ?? globalSupabase
  const userId = enrollment?.profile_id ?? enrollment?.user_id
  const source = SOURCES[subcategory]
  const day    = Math.min(28, Math.max(1, Number(studyDay) || 1))
  const url    = source?.url(day)

  const [ready, setReady]       = useState(false)
  const [slow, setSlow]         = useState(false)
  const [tabbed, setTabbed]     = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [pending, setPending]   = useState(null)   // a result waiting on a retry
  const { submit, busy } = useSubmitLock(`embedded:${subcategory}:${scheduleId ?? 'none'}`)

  const { data: instrument, error: instErr } = useQuery({
    queryKey: ['composable-instrument', source?.slug],
    enabled:  !!source && !demoMode && !isSimMode,
    queryFn:  async () => {
      const { data, error } = await db.from('composable_instruments').select('id, slug, type').eq('slug', source.slug).single()
      if (error) throw error
      return data
    },
  })

  const save = useCallback(async response => {
    setSaveError(null)
    setPending(response)
    await submit(async () => {
      if (!demoMode && !isSimMode && userId) {
        if (!instrument) throw new Error('The practice record is not ready yet. Try again in a moment.')
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
      onComplete?.({ instrument_slug: source.slug, instrument_type: 'embedded_practice', value: response })
    }).catch(err => {
      console.error('embedded practice save:', err)
      setSaveError(err.message)
    })
  }, [submit, demoMode, isSimMode, userId, instrument, db, scheduleId, stepIndex, onComplete, source])

  // the page's messages, from its own origins only
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save }, [save])
  const frameRef = useRef(null)
  useEffect(() => {
    if (!source) return
    const onMessage = e => {
      if (!source.origins.includes(e.origin)) return
      const m = e.data
      if (!m || m.source !== source.tag) return
      if (m.type === 'ready') setReady(true)
      if (m.type === 'done') {
        saveRef.current({
          day,
          completed:   true,
          practice:    m.practice ?? null,
          sense:       m.sense ?? null,
          practice_ms: Number.isFinite(m.practiceMs) ? Math.round(m.practiceMs) : null,
          quiet:       !!m.quiet,
          via:         e.source === frameRef.current?.contentWindow ? 'frame' : 'tab',
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [source, day])

  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setSlow(true), FRAME_WAIT_MS)
    return () => clearTimeout(t)
  }, [ready])

  // simulation: nothing to run
  useEffect(() => { if (isSimMode) onComplete?.({ simulated: true }) }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!source) return <div style={S.note}>Unknown embedded practice “{subcategory}”.</div>
  if (isSimMode) return null
  if (instErr) return <div style={S.note}>Today’s practice could not load ({instErr.message}). Please reload the page.</div>

  const openTab = () => { window.open(url, '_blank'); setTabbed(true) }

  return (
    <div style={S.shell}>
      <iframe
        ref={frameRef}
        src={url}
        title="Today’s practice"
        allow="autoplay; fullscreen"
        style={S.frame}
      />
      {(saveError || busy) && (
        <div style={S.bar}>
          {busy && !saveError && <span>Saving today’s practice…</span>}
          {saveError && (
            <>
              <span>Today’s practice didn’t save ({saveError}).</span>
              <button type="button" style={S.btn} onClick={() => save(pending)}>Try again</button>
            </>
          )}
        </div>
      )}
      {!busy && !saveError && (slow || demoMode) && (
        <div style={S.bar}>
          {!tabbed
            ? <><span>Not loading?</span><button type="button" style={S.btn} onClick={openTab}>Open today’s practice in a new tab</button></>
            : <><span>When you’ve finished the practice in the other tab:</span>
                <button type="button" style={S.btn} onClick={() => save({ day, completed: null, self_reported: true, via: 'tab' })}>I’ve done it</button></>}
          {demoMode && <button type="button" style={S.btnQuiet} onClick={() => onComplete?.({ demo_skipped: true })}>Skip (demo)</button>}
        </div>
      )}
    </div>
  )
}

const S = {
  shell: { position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bgc)', display: 'flex', flexDirection: 'column' },
  frame: { flex: 1, width: '100%', border: 0, display: 'block' },
  bar: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '8px 16px', borderTop: '1px solid var(--bd)', background: 'var(--bgc)',
    fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14, color: 'var(--tx2)',
  },
  btn: { border: 0, borderRadius: 24, padding: '8px 16px', background: 'var(--pkd)', color: 'var(--bgc)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnQuiet: { border: '1px solid var(--bd)', borderRadius: 24, padding: '8px 16px', background: 'transparent', color: 'var(--tx2)', fontSize: 14, cursor: 'pointer' },
  note: { padding: 24, fontSize: 14, color: 'var(--tx2)' },
}
