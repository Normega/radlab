import ConsentStep              from './ConsentStep'
import DebriefStep               from './DebriefStep'
import QuestionnaireStepWrapper  from './QuestionnaireStepWrapper'
import GameStepWrapper           from './GameStepWrapper'

export default function StepDispatcher({ step, enrollment, stepIndex, totalSteps, onComplete }) {
  switch (step.type) {
    case 'consent':
      return <ConsentStep enrollment={enrollment} onComplete={onComplete} />

    case 'debrief':
      return <DebriefStep enrollment={enrollment} onComplete={onComplete} />

    case 'questionnaire':
      return (
        <QuestionnaireStepWrapper
          slug={step.slug}
          enrollment={enrollment}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          onComplete={onComplete}
        />
      )

    case 'game':
      return (
        <GameStepWrapper
          slug={step.slug}
          enrollment={enrollment}
          onComplete={onComplete}
        />
      )

    default:
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#e04', fontFamily: '"DM Sans",system-ui,sans-serif' }}>
          Unknown step type: {step.type}
        </div>
      )
  }
}
