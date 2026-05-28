import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import StepDispatcher from '../../components/study/StepDispatcher'

const PHASE = { LOADING: 'LOADING', RUNNING: 'RUNNING', SAVING: 'SAVING', COMPLETE: 'COMPLETE' }

export default function StudySessionRunner() {
  const { id: studyId, enrollmentId } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState(PHASE.LOADING)
  const [currentStep, setCurrentStep] = useState(0)

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ['enrollment', enrollmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_enrollments')
        .select('*, studies(protocol, name)')
        .eq('id', enrollmentId)
        .single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!enrollment) return
    const step = enrollment.current_step ?? 0
    setCurrentStep(step)
    setPhase(step >= (enrollment.studies?.protocol?.length ?? 0) ? PHASE.COMPLETE : PHASE.RUNNING)
  }, [enrollment])

  const advanceStep = useMutation({
    mutationFn: async (stepData) => {
      const steps     = enrollment.studies.protocol ?? []
      const newStep   = currentStep + 1
      const completed = [
        ...(enrollment.completed_steps ?? []),
        {
          step:         currentStep,
          slug:         steps[currentStep]?.slug,
          type:         steps[currentStep]?.type,
          completed_at: new Date().toISOString(),
          ...stepData,
        },
      ]
      const isDone = newStep >= steps.length

      const { error } = await supabase.from('study_enrollments').update({
        current_step:    newStep,
        completed_steps: completed,
        status:          isDone ? 'completed' : 'in_progress',
        started_at:      enrollment.started_at ?? new Date().toISOString(),
        completed_at:    isDone ? new Date().toISOString() : null,
      }).eq('id', enrollmentId)

      if (error) throw error
      return { newStep, isDone }
    },
    onSuccess: ({ newStep, isDone }) => {
      setCurrentStep(newStep)
      setPhase(isDone ? PHASE.COMPLETE : PHASE.RUNNING)
    },
  })

  async function handleStepComplete(stepData = {}) {
    setPhase(PHASE.SAVING)
    advanceStep.mutate(stepData)
  }

  if (isLoading || phase === PHASE.LOADING) {
    return (
      <div style={S.fullScreen}>
        <p style={S.loadingText}>Loading session…</p>
      </div>
    )
  }

  const steps      = enrollment?.studies?.protocol ?? []
  const totalSteps = steps.length
  const studyName  = enrollment?.studies?.name ?? ''
  const participantId = enrollment?.participant_id ?? ''

  if (phase === PHASE.COMPLETE) {
    return (
      <div style={S.fullScreen}>
        <div style={S.completeBox}>
          <div style={S.checkmark}>✓</div>
          <h1 style={S.completeTitle}>Session Complete</h1>
          <p style={S.completeBody}>
            Participant <span style={S.monoInline}>{participantId}</span> has finished all steps.
          </p>
          <button style={S.btnPrimary} onClick={() => navigate(`/admin/studies/${studyId}`)}>
            Return to Study →
          </button>
        </div>
      </div>
    )
  }

  if (phase === PHASE.SAVING) {
    return (
      <div style={S.fullScreen}>
        <p style={S.loadingText}>Saving…</p>
      </div>
    )
  }

  const step         = steps[currentStep]
  const stepLabel    = step ? `Step ${currentStep + 1} of ${totalSteps} — ${labelFor(step)}` : ''
  const progressPct  = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  return (
    <div style={S.fullScreen}>
      {/* Progress bar */}
      <div style={S.progressBarWrap}>
        <div style={{ ...S.progressBarFill, width: `${progressPct}%` }} />
      </div>
      <p style={S.stepLabel}>{stepLabel}</p>

      {/* Step content */}
      <div style={S.stepContent}>
        {step ? (
          <StepDispatcher
            step={step}
            enrollment={enrollment}
            stepIndex={currentStep}
            totalSteps={totalSteps}
            onComplete={handleStepComplete}
          />
        ) : (
          <p style={S.loadingText}>Unknown step at index {currentStep}</p>
        )}
      </div>
    </div>
  )
}

function labelFor(step) {
  if (step.type === 'consent')       return 'Consent'
  if (step.type === 'debrief')       return 'Debrief'
  if (step.type === 'game')          return 'Task'
  if (step.type === 'questionnaire') return 'Questionnaire'
  return step.type
}

const S = {
  fullScreen: {
    position: 'fixed',
    inset: 0,
    background: '#FCF0F5',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    overflowY: 'auto',
  },
  progressBarWrap: {
    height: 4,
    background: '#e9d5e4',
    flexShrink: 0,
  },
  progressBarFill: {
    height: '100%',
    background: 'var(--pk)',
    transition: 'width 0.4s ease',
  },
  stepLabel: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 11,
    color: 'var(--tx3)',
    textAlign: 'center',
    padding: '8px 24px 0',
    margin: 0,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
    overflowY: 'auto',
  },
  loadingText: {
    textAlign: 'center',
    padding: '80px 24px',
    fontSize: 16,
    color: 'var(--tx3)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  completeBox: {
    maxWidth: 480,
    margin: 'auto',
    padding: '60px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    textAlign: 'center',
  },
  checkmark: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#f0fdf4',
    border: '2px solid #86efac',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: '#15803d',
  },
  completeTitle: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 30,
    fontWeight: 400,
    color: 'var(--tx)',
    margin: 0,
  },
  completeBody: {
    fontSize: 15,
    color: 'var(--tx2)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    margin: 0,
    lineHeight: 1.6,
  },
  monoInline: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 13,
    color: 'var(--tx)',
  },
  btnPrimary: {
    background: 'var(--pk)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 28px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    marginTop: 8,
  },
}
