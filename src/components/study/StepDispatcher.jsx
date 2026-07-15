// v5 — video step category; demoMode (admin session demo: real UI, no writes)
import ConsentStep              from './ConsentStep'
import DisplayStepWrapper       from './DisplayStepWrapper'
import DebriefStep              from './DebriefStep'
import DemographicsStep         from './DemographicsStep'
import EquityCensusStep         from './EquityCensusStep'
import CompensationStep         from './CompensationStep'
import MoodCheckinStep          from './MoodCheckinStep'
import WellnessTipStep          from './WellnessTipStep'
import QuestionnaireStepWrapper from './QuestionnaireStepWrapper'
import GameStepWrapper          from './GameStepWrapper'
import PhysioSetupStep          from './PhysioSetupStep'
import TrainingStepWrapper      from './TrainingStepWrapper'
import VasStepWrapper          from './VasStepWrapper'
import MidpointStep            from './MidpointStep'
import VideoStepWrapper        from './VideoStepWrapper'
import AssessmentLeadInStep    from './AssessmentLeadInStep'
import DailyWelcomeStep        from './DailyWelcomeStep'
import DailyFarewellStep       from './DailyFarewellStep'

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
 *   demoMode    — bool — admin session demo: render the real participant UI
 *                 with zero DB writes; steps that require participant/server
 *                 context (forms, games, physio) show a skip card instead
 *   assignments — { [slotKey]: arm } from draw_assignment, or null
 *   stepOutputs — { slider: {...}, vas: {...}, game: {...} } accumulated from
 *                 earlier steps this session; consumed by display steps
 */
export default function StepDispatcher({ node, enrollment, scheduleId, studyDay = null, sendTime = null, stepIndex, totalSteps, onComplete, consentHtml, debriefHtml, supabaseClient, isSimMode = false, demoMode = false, assignments = null, stepOutputs = null }) {
  const activity = node?.activity ?? node?.activities
  if (!activity) {
    return (
      <div style={ERR}>
        Missing activity on node {node?.id}
      </div>
    )
  }

  const { category, subcategory } = activity
  const label = activity.label ?? node?.label ?? subcategory

  // In demo mode, steps whose real UI is inseparable from participant/server
  // context are represented by a card rather than a broken render.
  if (demoMode && (category === 'form' || category === 'game' || category === 'physio')) {
    return <DemoSkipCard category={category} subcategory={subcategory} label={label} onComplete={onComplete} />
  }

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
    if (subcategory === 'equity_census') {
      return <EquityCensusStep enrollment={enrollment} scheduleId={scheduleId} onComplete={onComplete} supabaseClient={supabaseClient} isSimMode={isSimMode} />
    }
    if (subcategory === 'compensation') {
      return <CompensationStep enrollment={enrollment} onComplete={onComplete} supabaseClient={supabaseClient} isSimMode={isSimMode} />
    }
    if (subcategory === 'mood_checkin' || subcategory === 'mood_checkin_reflective') {
      return (
        <MoodCheckinStep
          enrollment={enrollment}
          scheduleId={scheduleId}
          studyDay={studyDay}
          sendTime={sendTime}
          subcategory={subcategory}
          onComplete={onComplete}
          supabaseClient={supabaseClient}
          isSimMode={isSimMode}
        />
      )
    }
    if (subcategory === 'wellness_tip') {
      return (
        <WellnessTipStep
          enrollment={enrollment}
          scheduleId={scheduleId}
          studyDay={studyDay}
          sendTime={sendTime}
          onComplete={onComplete}
          supabaseClient={supabaseClient}
          isSimMode={isSimMode}
        />
      )
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
        demoMode={demoMode}
      />
    )
  }

  if (category === 'game') {
    return (
      <GameStepWrapper
        slug={subcategory}
        enrollment={enrollment}
        scheduleId={scheduleId}
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
        supabaseClient={supabaseClient}
        isSimMode={isSimMode}
        demoMode={demoMode}
      />
    )
  }

  if (category === 'vas') {
    return (
      <VasStepWrapper
        subcategory={subcategory}
        enrollment={enrollment}
        scheduleId={scheduleId}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onComplete={onComplete}
        supabaseClient={supabaseClient}
        isSimMode={isSimMode}
        demoMode={demoMode}
      />
    )
  }

  if (category === 'midpoint') {
    return (
      <MidpointStep
        enrollment={enrollment}
        onComplete={onComplete}
        supabaseClient={supabaseClient}
        isSimMode={isSimMode}
        demoMode={demoMode}
      />
    )
  }

  if (category === 'assessment_leadin') {
    return (
      <AssessmentLeadInStep
        variant={subcategory}
        onComplete={onComplete}
      />
    )
  }

  if (category === 'daily_welcome') {
    return (
      <DailyWelcomeStep
        enrollment={enrollment}
        scheduleId={scheduleId}
        onComplete={onComplete}
        supabaseClient={supabaseClient}
        demoMode={demoMode}
      />
    )
  }

  if (category === 'daily_farewell') {
    return (
      <DailyFarewellStep
        condition={subcategory}
        onComplete={onComplete}
      />
    )
  }

  if (category === 'video') {
    return (
      <VideoStepWrapper
        subcategory={subcategory}
        label={label}
        enrollment={enrollment}
        scheduleId={scheduleId}
        onComplete={onComplete}
        supabaseClient={supabaseClient}
        isSimMode={isSimMode}
        demoMode={demoMode}
      />
    )
  }

  if (category === 'display') {
    return (
      <DisplayStepWrapper
        slug={subcategory}
        assignments={assignments}
        stepOutputs={stepOutputs}
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

// Demo placeholder for steps that can't render meaningfully without a real
// participant (consent/demographics forms, games, physio setup).
function DemoSkipCard({ category, subcategory, label, onComplete }) {
  return (
    <div style={CARD.wrap}>
      <div style={CARD.box}>
        <span style={CARD.chip}>{category}{subcategory ? ` · ${subcategory}` : ''}</span>
        <p style={CARD.title}>{label}</p>
        <p style={CARD.sub}>
          Participants see the real {category === 'game' ? 'game' : 'step'} here — it needs a live
          participant session, so it's represented by this card in the demo.
        </p>
        <button style={CARD.btn} onClick={() => onComplete?.({ demo_skipped: true })}>Continue</button>
      </div>
    </div>
  )
}

const CARD = {
  wrap: { display: 'flex', justifyContent: 'center', padding: '60px 24px', fontFamily: '"DM Sans",system-ui,sans-serif' },
  box:  { maxWidth: 440, width: '100%', textAlign: 'center', background: '#faf9f7', border: '1px dashed #c8c5c0', borderRadius: 14, padding: '32px 28px' },
  chip: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  title:{ fontSize: 18, fontWeight: 600, color: 'var(--tx)', margin: '10px 0 8px' },
  sub:  { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.55, margin: '0 0 20px' },
  btn:  { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}

const ERR = { padding: 40, textAlign: 'center', color: '#e04', fontFamily: '"DM Sans",system-ui,sans-serif' }
