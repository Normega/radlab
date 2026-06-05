import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import QuestionnaireRenderer from '../questionnaire/QuestionnaireRenderer'

export default function QuestionnaireStepWrapper({ slug, enrollment, stepIndex, totalSteps, onComplete, supabaseClient, isSimMode = false }) {
  // In a participant session the caller passes the participant-authenticated
  // client; reads/writes must use it so RLS (auth.uid() = user_id) is satisfied.
  // Falls back to the global client for non-session contexts (e.g. preview).
  const db = supabaseClient ?? globalSupabase

  const { data: q, isLoading, error } = useQuery({
    queryKey: ['questionnaire-def', slug],
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

  if (isLoading) return <div style={S.loading}>Loading questionnaire…</div>
  if (error)     return <div style={S.err}>Could not load questionnaire "{slug}": {error.message}</div>

  // A definition with no items would crash the renderer — surface a legible
  // message instead so the session can be diagnosed rather than blanking out.
  if (!Array.isArray(q?.definition?.items) || q.definition.items.length === 0) {
    return <div style={S.err}>Questionnaire "{slug}" is not configured (no items). Check its definition in the admin library.</div>
  }

  async function handleComplete(result) {
    const { responses } = result
    const { error } = await db.from('questionnaire_responses').insert({
      user_id:            enrollment.profile_id ?? enrollment.user_id,
      questionnaire_slug: slug,
      responses,
      completed_at:       new Date().toISOString(),
    })
    if (error) console.error('questionnaire_responses insert:', error)
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
