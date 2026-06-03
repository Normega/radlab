// v2 — reads session_template_nodes; route param :studySessionId
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { advanceSchedule } from '../../lib/scheduleGenerator'
import StepDispatcher from '../../components/study/StepDispatcher'

const PHASE = { LOADING: 'LOADING', RUNNING: 'RUNNING', SAVING: 'SAVING', COMPLETE: 'COMPLETE' }

export default function StudySessionRunner() {
  const { id: studyId, enrollmentId, studySessionId } = useParams()
  const navigate = useNavigate()
  const [phase,       setPhase]       = useState(PHASE.LOADING)
  const [currentStep, setCurrentStep] = useState(0)

  // Fetch enrollment (for participant context and consent/debrief HTML)
  const { data: enrollment, isLoading: enrollLoading } = useQuery({
    queryKey: ['enrollment', enrollmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_enrollments')
        .select(`
          id, profile_id, external_id, status,
          studies!study_id(
            id, name,
            study_consent_forms:active_consent_form_id(html_content),
            study_debrief_forms:active_debrief_form_id(html_content)
          )
        `)
        .eq('id', enrollmentId)
        .single()
      if (error) throw error
      return data
    },
  })

  // Fetch session template nodes for this study_session
  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ['session-nodes', studySessionId],
    enabled: !!studySessionId,
    queryFn: async () => {
      const { data: sessionRow, error: se } = await supabase
        .from('study_sessions')
        .select('session_template_id')
        .eq('id', studySessionId)
        .single()
      if (se) throw se

      const { data, error } = await supabase
        .from('session_template_nodes')
        .select('id, order_index, label, activity_id, activities!activity_id(id, category, subcategory, label)')
        .eq('session_template_id', sessionRow.session_template_id)
        .order('order_index', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  // Find the participant_schedule row for this session (for completion tracking)
  const { data: scheduleRow } = useQuery({
    queryKey: ['sched-row', enrollmentId, studySessionId],
    enabled: !!enrollment?.profile_id && !!studySessionId,
    queryFn: async () => {
      const { data } = await supabase
        .from('participant_schedule')
        .select('id, status')
        .eq('participant_id', enrollment.profile_id)
        .eq('study_session_id', studySessionId)
        .maybeSingle()
      return data
    },
  })

  const isLoading = enrollLoading || nodesLoading

  useEffect(() => {
    if (!isLoading && nodes.length > 0) setPhase(PHASE.RUNNING)
    else if (!isLoading && nodes.length === 0) setPhase(PHASE.COMPLETE)
  }, [isLoading, nodes.length])

  const advanceStep = useMutation({
    mutationFn: async () => {
      const newStep = currentStep + 1
      const isDone  = newStep >= nodes.length

      if (isDone && scheduleRow?.id) {
        const now = new Date().toISOString()
        await supabase
          .from('participant_schedule')
          .update({ status: 'completed', completed_at: now })
          .eq('id', scheduleRow.id)

        // Mark enrollment in-progress or completed
        const { data: allRows } = await supabase
          .from('participant_schedule')
          .select('id, status')
          .eq('participant_id', enrollment.profile_id)
          .eq('study_id', studyId)
        const allDone = allRows?.every(r => r.status === 'completed')
        await supabase
          .from('study_enrollments')
          .update({ status: allDone ? 'completed' : 'in_progress' })
          .eq('id', enrollmentId)

        if (!allDone) {
          await advanceSchedule(enrollment.profile_id, studyId, scheduleRow.id)
        }
      }

      return { newStep, isDone }
    },
    onSuccess: ({ newStep, isDone }) => {
      if (isDone) {
        setPhase(PHASE.COMPLETE)
      } else {
        setCurrentStep(newStep)
        setPhase(PHASE.RUNNING)
      }
    },
  })

  async function handleStepComplete() {
    setPhase(PHASE.SAVING)
    advanceStep.mutate()
  }

  if (isLoading || phase === PHASE.LOADING) {
    return (
      <div style={S.fullScreen}>
        <p style={S.loadingText}>Loading session…</p>
      </div>
    )
  }

  const studyName     = enrollment?.studies?.name ?? ''
  const externalId    = enrollment?.external_id ?? ''
  const consentHtml   = enrollment?.studies?.study_consent_forms?.html_content ?? null
  const debriefHtml   = enrollment?.studies?.study_debrief_forms?.html_content ?? null
  const totalSteps    = nodes.length
  const node          = nodes[currentStep]
  const activity      = node?.activities
  const stepLabel     = node
    ? `Step ${currentStep + 1} of ${totalSteps} — ${activity?.label ?? activity?.subcategory ?? ''}`
    : ''
  const progressPct   = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  if (phase === PHASE.COMPLETE) {
    return (
      <div style={S.fullScreen}>
        <div style={S.completeBox}>
          <div style={S.checkmark}>✓</div>
          <h1 style={S.completeTitle}>Session Complete</h1>
          <p style={S.completeBody}>
            {externalId
              ? <>Participant <span style={S.monoInline}>{externalId}</span> has finished this session.</>
              : 'Session complete.'}
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

  return (
    <div style={S.fullScreen}>
      <div style={S.progressBarWrap}>
        <div style={{ ...S.progressBarFill, width: `${progressPct}%` }} />
      </div>
      <p style={S.stepLabel}>{stepLabel}</p>

      <div style={S.stepContent}>
        {node ? (
          <StepDispatcher
            node={node}
            enrollment={enrollment}
            stepIndex={currentStep}
            totalSteps={totalSteps}
            onComplete={handleStepComplete}
            consentHtml={consentHtml}
            debriefHtml={debriefHtml}
          />
        ) : (
          <p style={S.loadingText}>No content at step {currentStep}</p>
        )}
      </div>
    </div>
  )
}

const S = {
  fullScreen:       { position: 'fixed', inset: 0, background: '#FCF0F5', display: 'flex', flexDirection: 'column', zIndex: 200, overflowY: 'auto' },
  progressBarWrap:  { height: 4, background: '#e9d5e4', flexShrink: 0 },
  progressBarFill:  { height: '100%', background: 'var(--pk)', transition: 'width 0.4s ease' },
  stepLabel:        { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'center', padding: '8px 24px 0', margin: 0, flexShrink: 0 },
  stepContent:      { flex: 1, overflowY: 'auto' },
  loadingText:      { textAlign: 'center', padding: '80px 24px', fontSize: 16, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  completeBox:      { maxWidth: 480, margin: 'auto', padding: '60px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' },
  checkmark:        { width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#15803d' },
  completeTitle:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 30, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  completeBody:     { fontSize: 15, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0, lineHeight: 1.6 },
  monoInline:       { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx)' },
  btnPrimary:       { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', marginTop: 8 },
}
