// v3 — carries condition assignments ({ [slotKey]: arm }) into step components
import ConsentStep              from './ConsentStep'
import DebriefStep              from './DebriefStep'
import DemographicsStep         from './DemographicsStep'
import CompensationStep         from './CompensationStep'
import QuestionnaireStepWrapper from './QuestionnaireStepWrapper'
import GameStepWrapper          from './GameStepWrapper'
import PhysioSetupStep          from './PhysioSetupStep'
import TrainingStepWrapper      from './TrainingStepWrapper'
import VasStepWrapper          from './VasStepWrapper'

/**
 * Props:
 *   node        — session_template_nodes row with activity nested
 *   enrollment  — study_enrollments row
 *   stepIndex   — 0-based position in this session
 *   totalSteps  — total nodes in this session
 *   onComplete  — called when the step finishes
 *   consentHtml — HTML string for consent step (from study)
 *   debriefHtml — HTML string for debrief step (from study)
 *   isSimMode   — bool — when true all steps auto-complete
 *   assignments — { [slotKey]: arm } from draw_assignment, or null
 */
export default function StepDispatcher({ node, enrollment, scheduleId, stepIndex, totalSteps, onComplete, consentHtml, debriefHtml, supabaseClient, isSimMode = false, assignments = null }) {
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
      return <ConsentStep enrollment={enrollment} onComplete={onComplete} html={consentHtml} isSimMode={isSimMode} />
    }
    if (subcategory === 'debrief') {
      return <DebriefStep enrollment={enrollment} onComplete={onComplete} html={debriefHtml} isSimMode={isSimMode} />
    }
    if (subcategory === 'demographics') {
      return <DemographicsStep enrollment={enrollment} scheduleId={scheduleId} onComplete={onComplete} supabaseClient={supabaseClient} isSimMode={isSimMode} />
    }
    if (subcategory === 'compensation') {
      return <CompensationStep enrollment={enrollment} onComplete={onComplete} supabaseClient={supabaseClient} isSimMode={isSimMode} />
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
        isSimMode={isSimMode}
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
        isSimMode={isSimMode}
        assignments={assignments}
      />
    )
  }

  if (category === 'training') {
    return (
      <TrainingStepWrapper
        node={node}
        enrollment={enrollment}
        scheduleId={scheduleId}
        onComplete={onComplete}
        isSimMode={isSimMode}
      />
    )
  }

  if (category === 'vas') {
    return (
      <VasStepWrapper
        subcategory={subcategory}
        enrollment={enrollment}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onComplete={onComplete}
        supabaseClient={supabaseClient}
        isSimMode={isSimMode}
      />
    )
  }

  if (category === 'physio' && subcategory === 'belt_setup') {
    return (
      <PhysioSetupStep
        enrollment={enrollment}
        onComplete={onComplete}
        isSimMode={isSimMode}
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
