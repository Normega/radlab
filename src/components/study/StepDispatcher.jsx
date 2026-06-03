// v2 — dispatches on activity.category + activity.subcategory from session_template_nodes
import ConsentStep             from './ConsentStep'
import DebriefStep             from './DebriefStep'
import QuestionnaireStepWrapper from './QuestionnaireStepWrapper'
import GameStepWrapper          from './GameStepWrapper'

/**
 * Props:
 *   node        — session_template_nodes row with activity nested
 *   enrollment  — study_enrollments row
 *   stepIndex   — 0-based position in this session
 *   totalSteps  — total nodes in this session
 *   onComplete  — called when the step finishes
 *   consentHtml — HTML string for consent step (from study)
 *   debriefHtml — HTML string for debrief step (from study)
 */
export default function StepDispatcher({ node, enrollment, stepIndex, totalSteps, onComplete, consentHtml, debriefHtml, supabaseClient }) {
  const activity = node?.activity ?? node?.activities
  if (!activity) {
    return (
      <div style={ERR}>
        Missing activity on node {node?.id}
      </div>
    )
  }

  const { category, subcategory } = activity

  if (category === 'form') {
    if (subcategory === 'consent') {
      return <ConsentStep enrollment={enrollment} onComplete={onComplete} html={consentHtml} />
    }
    if (subcategory === 'debrief') {
      return <DebriefStep enrollment={enrollment} onComplete={onComplete} html={debriefHtml} />
    }
  }

  if (category === 'questionnaire') {
    return (
      <QuestionnaireStepWrapper
        slug={subcategory}
        enrollment={enrollment}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onComplete={onComplete}
        supabaseClient={supabaseClient}
      />
    )
  }

  if (category === 'game') {
    return (
      <GameStepWrapper
        slug={subcategory}
        enrollment={enrollment}
        onComplete={onComplete}
        supabaseClient={supabaseClient}
      />
    )
  }

  return (
    <div style={ERR}>
      Unknown activity type: {category}/{subcategory}
    </div>
  )
}

const ERR = { padding: 40, textAlign: 'center', color: '#e04', fontFamily: '"DM Sans",system-ui,sans-serif' }
