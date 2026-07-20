import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import QuestionnaireRenderer from '../questionnaire/QuestionnaireRenderer'

export default function QuestionnaireStepWrapper({ slug, enrollment, stepIndex, totalSteps, onComplete, supabaseClient, isSimMode = false, demoMode = false }) {
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
  const [carried] = useState(() => {
    if (!carriedKey) return false
    try {
      const m = JSON.parse(sessionStorage.getItem(carriedKey) || 'null')
      return Array.isArray(m?.slugs) && m.slugs.includes(slug)
    } catch { return false }
  })
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

  if (carried) return <div style={S.loading}>Loading…</div>

  if (isLoading) return <div style={S.loading}>Loading questionnaire…</div>
  if (error)     return <div style={S.err}>Could not load questionnaire "{slug}": {error.message}</div>

  // A definition with no items would crash the renderer — surface a legible
  // message instead so the session can be diagnosed rather than blanking out.
  if (!Array.isArray(q?.definition?.items) || q.definition.items.length === 0) {
    return <div style={S.err}>Questionnaire "{slug}" is not configured (no items). Check its definition in the admin library.</div>
  }

  async function handleComplete(result) {
    const { responses } = result
    if (!demoMode) {
      const { error } = await db.from('questionnaire_responses').insert({
        user_id:            enrollment.profile_id ?? enrollment.user_id,
        questionnaire_slug: slug,
        responses,
        completed_at:       new Date().toISOString(),
      })
      if (error) console.error('questionnaire_responses insert:', error)
    }
    onComplete({ responses_count: Object.keys(responses).length })
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
