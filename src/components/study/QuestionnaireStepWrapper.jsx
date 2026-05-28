import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import QuestionnaireRenderer from '../questionnaire/QuestionnaireRenderer'

export default function QuestionnaireStepWrapper({ slug, enrollment, stepIndex, totalSteps, onComplete }) {
  const { data: q, isLoading, error } = useQuery({
    queryKey: ['questionnaire-def', slug],
    queryFn: async () => {
      const { data, error } = await supabase
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

  async function handleComplete(result) {
    const { responses } = result
    await supabase.from('questionnaire_responses').insert({
      user_id:            enrollment.user_id,
      questionnaire_slug: slug,
      responses,
      completed_at:       new Date().toISOString(),
    })
    onComplete({ responses_count: Object.keys(responses).length })
  }

  return (
    <QuestionnaireRenderer
      questionnaire={q.definition}
      partNumber={stepIndex + 1}
      totalParts={totalSteps}
      onComplete={handleComplete}
    />
  )
}

const S = {
  loading: { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:     { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
}
