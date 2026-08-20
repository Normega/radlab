import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import QuestionnaireRenderer from '../questionnaire/QuestionnaireRenderer'
import { useSubmitLock } from '../../lib/useSubmitLock'

export default function QuestionnaireStepWrapper({ slug, enrollment, scheduleId, stepIndex, totalSteps, onComplete, supabaseClient, isSimMode = false, demoMode = false }) {
  // In a participant session the caller passes the participant-authenticated
  // client; reads/writes must use it so RLS (auth.uid() = user_id) is satisfied.
  // Falls back to the global client for non-session contexts (e.g. preview).
  const db = supabaseClient ?? globalSupabase

  // Carry-forward skip: if this instrument was already completed during the
  // pre-consent screener, the screener flush has already written its response
  // row (see SessionEntry.flushScreenerDraft). Skip re-administering it and
  // advance immediately. Read synchronously on first render so the questionnaire
  // never flashes on screen; only in a real participant session (never demo).
  const participantId = enrollment?.user_id ?? enrollment?.profile_id
  const carriedKey = (!demoMode && enrollment?.study_id && participantId)
    ? `screener_carried_${enrollment.study_id}_${participantId}`
    : null
  // Stored as the slug it applies to (not a boolean) so a parent that reuses
  // this instance across steps with a different slug can never inherit a stale
  // skip — that reuse is what hung the Zerin baseline at step 2.
  const [carriedFor] = useState(() => {
    if (!carriedKey) return null
    try {
      const m = JSON.parse(sessionStorage.getItem(carriedKey) || 'null')
      return (Array.isArray(m?.slugs) && m.slugs.includes(slug)) ? slug : null
    } catch { return null }
  })
  const carried = carriedFor === slug
  const carriedFiredRef = useRef(false)

  const { data: q, isLoading, error } = useQuery({
    queryKey: ['questionnaire-def', slug],
    enabled: !carried,
    queryFn: async () => {
      const { data, error } = await db
        .from('questionnaires')
        .select('definition')
        .eq('slug', slug)
        .single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!carried || carriedFiredRef.current) return
    carriedFiredRef.current = true // guard against double-fire (StrictMode / re-render)
    // Consume this slug from the marker so it can't be skipped twice.
    try {
      const m = JSON.parse(sessionStorage.getItem(carriedKey) || 'null')
      if (Array.isArray(m?.slugs)) {
        const remaining = m.slugs.filter(s => s !== slug)
        if (remaining.length) sessionStorage.setItem(carriedKey, JSON.stringify({ ...m, slugs: remaining }))
        else sessionStorage.removeItem(carriedKey)
      }
    } catch { /* marker cleanup is best-effort */ }
    onComplete({ carried_forward: true, slug })
  }, [carried]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyed by slug: one wrapper instance can be handed a second questionnaire
  // without remounting, and a lock still held from the first would swallow
  // the second's submit AND its onComplete, hanging the session outright.
  const { submit } = useSubmitLock(slug)

  if (carried) return <div style={S.loading}>Loading…</div>

  if (isLoading) return <div style={S.loading}>Loading questionnaire…</div>
  if (error)     return <div style={S.err}>Could not load questionnaire "{slug}": {error.message}</div>

  // A definition with no items would crash the renderer — surface a legible
  // message instead so the session can be diagnosed rather than blanking out.
  if (!Array.isArray(q?.definition?.items) || q.definition.items.length === 0) {
    return <div style={S.err}>Questionnaire "{slug}" is not configured (no items). Check its definition in the admin library.</div>
  }

  // This wrapper had NO guard: QuestionnaireRenderer refuses to fire onComplete
  // twice per mount, but a remount re-arms it, and the insert here would then
  // run again. That is how one participant's BFI-2-S landed twice 643 ms apart,
  // which the export then read as two separate baseline administrations.
  async function handleComplete(result) {
    const { responses } = result
    const { skipped } = await submit(async () => {
      if (!demoMode) {
        const { error } = await db.from('questionnaire_responses').insert({
          user_id:            enrollment.profile_id ?? enrollment.user_id,
          questionnaire_slug: slug,
          // Records WHICH session collected this, so the export no longer has
          // to infer the timepoint from protocol order. Null is meaningful and
          // correct for the screener, which runs pre-consent and is not a
          // scheduled session.
          schedule_id:        scheduleId ?? null,
          responses,
          completed_at:       new Date().toISOString(),
        })
        // Thrown rather than logged-and-continued so the lock releases and the
        // participant can retry; advancing on a failed save would lose the data
        // silently, which is worse than showing the question again.
        if (error) throw error
      }
      onComplete({ responses_count: Object.keys(responses).length })
    }).catch(err => {
      console.error('questionnaire_responses insert:', err)
      return { skipped: false }
    })
    if (skipped) console.warn('questionnaire submit ignored — already submitted:', slug)
  }

  return (
    <QuestionnaireRenderer
      questionnaire={q.definition}
      partNumber={stepIndex + 1}
      totalParts={totalSteps}
      onComplete={handleComplete}
      isSimMode={isSimMode}
    />
  )
}

const S = {
  loading: { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:     { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
}
