// v7 — VAS/slider package item values captured individually into the context
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import StepDispatcher from '../components/study/StepDispatcher'
import ScreenerPage from '../components/ScreenerPage'
import { useAssignments } from '../hooks/useAssignment'

// Dedicated client for participant sessions — never touches the shared lab/public client.
function makeParticipantClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: true, storageKey: 'sb-participant' } }
  )
}

const CONSENT_URL = (studyId) => `/study/${studyId}/consent`

export default function SessionEntry() {
  const { token } = useParams()
  const [state,          setState]          = useState('loading')
  const [sessionData,    setSessionData]    = useState(null)
  const [currentIndex,   setCurrentIndex]   = useState(0)
  const [consentStudyId, setConsentStudyId] = useState(null)
  const [screenerSpec,   setScreenerSpec]   = useState(null) // { screener, participantId, studyId }
  // Session context for display steps: outputs of completed steps, keyed
  // by element type then slug (see src/lib/elementOutputs.js). In-memory only —
  // a mid-session reload restarts the flow, so outputs rebuild as steps redo.
  const [stepOutputs,    setStepOutputs]    = useState({})
  const fullDataRef = useRef(null)
  // Isolated Supabase client — never modifies the global lab session.
  const sbRef = useRef(makeParticipantClient())
  const sb    = sbRef.current

  // Condition assignment: draw every slot before the step flow starts.
  // Draws are idempotent server-side, so refresh returns the same arms.
  const slotKeys = sessionData?.study?.assignment_slots
    ? Object.keys(sessionData.study.assignment_slots)
    : []
  const {
    assignments,
    isLoading: assignmentsLoading,
    isError:   assignmentsError,
  } = useAssignments(sessionData?.link?.study_id, slotKeys, {
    enabled: state === 'running' && slotKeys.length > 0,
    client:  sb,
  })

  useEffect(() => { resolveToken() }, [token])

  async function resolveToken() {
    // 1. Exchange link token for a participant Supabase session
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign_in_with_link`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey:          anonKey,
          Authorization:  `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ token }),
      }
    )
    const authResult = await resp.json()

    if (authResult.error === 'not_found') { setState('not_found'); return }
    if (authResult.error === 'revoked')   { setState('revoked');   return }
    if (authResult.error)                 { setState('not_found'); return }

    // 2. Set session on the isolated client only — never touches the global lab session
    await sb.auth.setSession({
      access_token:  authResult.access_token,
      refresh_token: authResult.refresh_token,
    })

    // 3. Load session data via RPC (now authenticated)
    const { data, error } = await sb.rpc('get_session_by_token', { p_token: token })
    if (error || !data || data.error) { setState('not_found'); return }

    const { link, schedule, study, enrollment } = data

    if (link.status === 'revoked')              { setState('revoked');   return }
    if (link.status === 'used' || link.status === 'completed') {
      setState('completed')
      return
    }
    if (link.status === 'expired')              { setState('expired');   return }

    if (schedule.scheduled_date && new Date(schedule.scheduled_date) > new Date()) {
      setState('too_early')
      return
    }

    // Screener gate — runs before consent
    if (study.screener) {
      const { data: priorResult } = await sb
        .from('screener_results')
        .select('phase1_passed, phase2_passed')
        .eq('participant_id', link.participant_id)
        .eq('study_id', link.study_id)
        .maybeSingle()

      const alreadyPassed = priorResult?.phase1_passed === true && priorResult?.phase2_passed === true
      const previouslyFailed = priorResult && !alreadyPassed

      if (previouslyFailed) {
        setState('screener_blocked')
        return
      }

      if (!alreadyPassed) {
        fullDataRef.current = data
        setScreenerSpec({
          screener:      study.screener,
          participantId: link.participant_id,
          studyId:       link.study_id,
        })
        setState('needs_screener')
        return
      }
    }

    proceedAfterScreener(data)
  }

  async function proceedAfterScreener(data) {
    const { schedule, study, enrollment } = data
    if (study.consent_required && study.active_consent_form_id && !enrollment?.consent_date) {
      setConsentStudyId(schedule.study_id)
      setState('needs_consent')
      return
    }
    // Consent confirmed (or not required) — flush any buffered screener responses
    await flushScreenerDraft(data.link.participant_id, data.link.study_id)
    setSessionData(data)
    setState('running')
  }

  // Write screener questionnaire answers buffered pre-consent into questionnaire_responses.
  // Called only after consent is confirmed. If no draft exists, this is a no-op.
  async function flushScreenerDraft(participantId, studyId) {
    const draftKey = `screener_draft_${studyId}_${participantId}`
    const raw = sessionStorage.getItem(draftKey)
    if (!raw) return
    let draft
    try { draft = JSON.parse(raw) } catch { sessionStorage.removeItem(draftKey); return }
    sessionStorage.removeItem(draftKey) // remove before inserting to prevent double-flush on retry
    for (const q of draft.questionnaires ?? []) {
      const { error } = await sb.from('questionnaire_responses').insert({
        user_id:            participantId,
        questionnaire_slug: q.slug,
        responses:          q.responses,
        completed_at:       draft.completedAt,
      })
      if (error) console.warn('[Screener] flush error for', q.slug, error.message)
    }
  }

  async function handleScreenerPass() {
    await proceedAfterScreener(fullDataRef.current)
  }

  function handleScreenerFail() {
    setState('screener_blocked')
  }

  async function handleStepComplete(result) {
    // Capture named outputs from steps that report them (games, sliders, VAS)
    // so later display steps can interpolate {{game.<slug>.<key>}} etc.
    if (result && typeof result === 'object') {
      const entries = [] // [type, slug, vals]
      if (result.game_slug) {
        const { game_slug, ...rest } = result
        entries.push(['game', game_slug, rest])
      } else if (result.slider_slug) {
        entries.push(['slider', result.slider_slug, { value: result.value }])
      } else if (result.scale_slug) {
        entries.push(['vas', result.scale_slug, { value: result.value }])
      } else if (result.package_slug && Array.isArray(result.item_values)) {
        for (const iv of result.item_values) {
          entries.push([iv.type, iv.slug, { value: iv.value }])
        }
      }
      if (entries.length) {
        setStepOutputs(prev => {
          const next = { ...prev }
          for (const [type, slug, vals] of entries) {
            next[type] = { ...(next[type] ?? {}), [slug]: vals }
          }
          return next
        })
      }
    }

    const nodes = sessionData?.nodes ?? []
    if (currentIndex < nodes.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      await sb.rpc('complete_session_by_token', { p_token: token })
      const redirectUrl = sessionData?.study?.completion_redirect_url
      if (redirectUrl) {
        setState('redirecting')
        setTimeout(() => { window.location.href = redirectUrl }, 2000)
      } else {
        setState('session_complete')
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return <FullScreen><StatusCard>Loading…</StatusCard></FullScreen>
  }

  if (state === 'not_found' || state === 'revoked') {
    return (
      <FullScreen>
        <StatusCard>
          {state === 'revoked'
            ? 'This link is no longer active. Please contact your researcher.'
            : 'This link is not valid.'}
        </StatusCard>
      </FullScreen>
    )
  }

  if (state === 'redirecting') {
    return <FullScreen><StatusCard>Session complete — thank you! Redirecting…</StatusCard></FullScreen>
  }

  if (state === 'completed' || state === 'session_complete') {
    return <FullScreen><StatusCard>You have completed this session. Thank you!</StatusCard></FullScreen>
  }

  if (state === 'expired') {
    return <FullScreen><StatusCard>This session window has closed. Please contact your researcher.</StatusCard></FullScreen>
  }

  if (state === 'too_early') {
    const d = sessionData?.schedule?.scheduled_date
    return (
      <FullScreen>
        <StatusCard>
          Your session opens on {d
            ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
            : 'a scheduled date'}.
        </StatusCard>
      </FullScreen>
    )
  }

  if (state === 'needs_screener' && screenerSpec) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #FCF0F5)', display: 'flex', justifyContent: 'center' }}>
        <ScreenerPage
          study={{ id: screenerSpec.studyId, screener: screenerSpec.screener }}
          participant={{ id: screenerSpec.participantId }}
          supabaseClient={sb}
          onPass={handleScreenerPass}
          onFail={handleScreenerFail}
        />
      </div>
    )
  }

  if (state === 'screener_blocked') {
    return (
      <FullScreen>
        <StatusCard>
          Thank you for your interest. Based on a previous eligibility check, this study is not the right fit for you at this time. Please reach out to the research team if you have any questions.
        </StatusCard>
      </FullScreen>
    )
  }

  if (state === 'needs_consent') {
    const returnTo = encodeURIComponent(`/s/${token}`)
    return (
      <FullScreen>
        <div style={{ maxWidth: 480, padding: '0 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 24 }}>
            Before beginning this study, you need to read and sign the consent form.
          </p>
          <a
            href={`${CONSENT_URL(consentStudyId)}?returnTo=${returnTo}`}
            style={{ display: 'inline-block', padding: '12px 32px', borderRadius: 12, background: 'var(--pk)', color: '#fff', fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500, textDecoration: 'none' }}
          >
            Review consent form →
          </a>
        </div>
      </FullScreen>
    )
  }

  if (state === 'running' && sessionData) {
    // Block the step flow until condition draws resolve — never start unassigned.
    if (slotKeys.length > 0 && assignmentsLoading) {
      return <FullScreen><StatusCard>Preparing your session…</StatusCard></FullScreen>
    }
    if (slotKeys.length > 0 && assignmentsError) {
      return (
        <FullScreen>
          <StatusCard>
            Something went wrong preparing your session. Please refresh the page, or contact your researcher if the problem continues.
          </StatusCard>
        </FullScreen>
      )
    }

    const nodes       = sessionData.nodes ?? []
    const node        = nodes[currentIndex]
    const consentHtml = sessionData.consent_html ?? null
    const debriefHtml = sessionData.debrief_html ?? null

    // Build a minimal enrollment object for StepDispatcher child components.
    // user_id must match profile_id — GameStepWrapper passes this as userId to games.
    const enrollment = {
      id:         sessionData.enrollment?.id,
      profile_id: sessionData.link?.participant_id,
      user_id:    sessionData.link?.participant_id,
      study_id:   sessionData.link?.study_id,
      studies:    { id: sessionData.link?.study_id },
    }

    if (!node) {
      return <FullScreen><StatusCard>No activities in this session.</StatusCard></FullScreen>
    }

    const totalSteps  = nodes.length
    const progressPct = totalSteps > 0 ? (currentIndex / totalSteps) * 100 : 0

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#FCF0F5', display: 'flex', flexDirection: 'column', zIndex: 200, overflowY: 'auto' }}>
        <div style={{ height: 4, background: '#e9d5e4', flexShrink: 0 }}>
          <div style={{ height: '100%', background: 'var(--pk)', width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'center', padding: '8px 24px 0', margin: 0, flexShrink: 0 }}>
          Step {currentIndex + 1} of {totalSteps}
        </p>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <StepDispatcher
            node={node}
            enrollment={enrollment}
            stepIndex={currentIndex}
            totalSteps={totalSteps}
            onComplete={handleStepComplete}
            consentHtml={consentHtml}
            debriefHtml={debriefHtml}
            supabaseClient={sb}
            assignments={slotKeys.length > 0 ? assignments : null}
            stepOutputs={stepOutputs}
          />
        </div>
      </div>
    )
  }

  return null
}

function FullScreen({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      {children}
    </div>
  )
}

function StatusCard({ children }) {
  return (
    <p style={{ maxWidth: 480, padding: '0 24px', fontSize: 18, color: 'var(--tx2)', textAlign: 'center', lineHeight: 1.6, fontFamily: '"DM Sans",system-ui,sans-serif' }}>
      {children}
    </p>
  )
}
