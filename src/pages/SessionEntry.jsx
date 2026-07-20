// v8 — completion screen now says when the next contact will happen
//      (complete_session_by_token returns { next_contact, has_more })
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import StepDispatcher from '../components/study/StepDispatcher'
import ScreenerPage from '../components/ScreenerPage'
import ConsentGate from '../components/study/ConsentGate'
import ContactEmailGate from '../components/study/ContactEmailGate'
import { useAssignments } from '../hooks/useAssignment'

// Dedicated client for participant sessions — never touches the shared lab/public client.
function makeParticipantClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: true, storageKey: 'sb-participant' } }
  )
}

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
  // { next_contact: {scheduled_date, send_time}|null, has_more: bool|null }
  const [completionInfo, setCompletionInfo] = useState(null)
  const fullDataRef = useRef(null)
  // Wall-clock (client Date.now) when the current step mounted — used to record
  // per-step time-on-screen. Same clock for entry+exit, so duration is accurate
  // even if the participant's absolute clock is skewed.
  const stepEnteredAtRef = useRef(null)
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

  // Stamp when each step becomes visible, so handleStepComplete can record how
  // long it was on screen. Fires on entry to step 0 (state → running) and on
  // every subsequent advance (currentIndex change).
  useEffect(() => {
    if (state !== 'running') return
    const nodes = sessionData?.nodes ?? []
    if (!nodes[currentIndex]) return
    stepEnteredAtRef.current = Date.now()
  }, [state, currentIndex, sessionData])

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
    fullDataRef.current = data // needed by handleConsentComplete if the consent gate fires below
    if (study.consent_required && study.active_consent_form_id && !enrollment?.consent_date) {
      setConsentStudyId(schedule.study_id)
      setState('needs_consent')
      return
    }
    await proceedAfterConsent(data)
  }

  async function proceedAfterConsent(data) {
    const { study, enrollment } = data
    // Contact-email gate: external (SONA/Prolific) enrollments carry a
    // synthetic, undeliverable auth email — for multi-day studies, no daily
    // link or reminder can ever reach them until they give a real address.
    // Admin-enrolled participants have real auth emails, so no gate for them.
    if (study.longitudinal && enrollment?.external_source && !enrollment?.contact_email) {
      setState('needs_contact_email')
      return
    }
    await startStepFlow(data)
  }

  async function startStepFlow(data) {
    // Consent confirmed (or not required) — flush any buffered screener responses
    await flushScreenerDraft(data.link.participant_id, data.link.study_id)
    setSessionData(data)
    setState('running')
  }

  async function handleConsentComplete() {
    await proceedAfterConsent(fullDataRef.current)
  }

  async function handleContactEmailComplete() {
    await startStepFlow(fullDataRef.current)
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
    // Carry-forward: the row(s) above ARE the baseline measure. Mark these slugs
    // so the matching in-session questionnaire node auto-skips instead of asking
    // the same instrument a second time (see QuestionnaireStepWrapper). The
    // marker lives in sessionStorage — it survives a reload of the baseline
    // session but dies when the tab closes, so a later session opened in a fresh
    // tab (e.g. the post-study PHQ-8) re-administers normally.
    if (draft.carryForward) {
      const slugs = (draft.questionnaires ?? []).map(q => q.slug)
      if (slugs.length) {
        sessionStorage.setItem(
          `screener_carried_${studyId}_${participantId}`,
          JSON.stringify({ slugs, completedAt: draft.completedAt })
        )
      }
    }
  }

  async function handleScreenerPass() {
    await proceedAfterScreener(fullDataRef.current)
  }

  function handleScreenerFail() {
    setState('screener_blocked')
  }

  async function handleStepComplete(result) {
    // Record time-on-screen for the step just finished (fire-and-forget; never
    // blocks advancing). Covers both the advance and final-step branches below.
    const exitedAt  = Date.now()
    const enteredAt = stepEnteredAtRef.current
    const timedNodes = sessionData?.nodes ?? []
    const timedNode  = timedNodes[currentIndex]
    if (enteredAt && timedNode) {
      const activity = timedNode.activity ?? timedNode.activities ?? {}
      sb.from('participant_step_timings').insert({
        participant_id:          sessionData?.link?.participant_id,
        participant_schedule_id: sessionData?.schedule?.id ?? null,
        study_id:                sessionData?.link?.study_id ?? null,
        step_index:              currentIndex,
        activity_id:             activity.id ?? timedNode.activity_id ?? null,
        category:                activity.category ?? null,
        subcategory:             activity.subcategory ?? null,
        label:                   activity.label ?? timedNode.label ?? null,
        entered_at:              new Date(enteredAt).toISOString(),
        exited_at:               new Date(exitedAt).toISOString(),
      }).then(({ error }) => { if (error) console.warn('step timing insert failed:', error.message) })
    }

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
            let v = vals
            // redemption_score = aptitude_suite.avg_pct + color_max.avg_pct, only
            // derivable once both games have reported — no {{}} arithmetic support,
            // so it's precomputed here as a plain step output instead.
            if (type === 'game' && slug === 'color_max' && v.avg_pct != null) {
              const aptitudePct = prev.game?.aptitude_suite?.avg_pct
              if (aptitudePct != null) {
                v = { ...v, redemption_score: +(aptitudePct + v.avg_pct).toFixed(2) }
              }
            }
            next[type] = { ...(next[type] ?? {}), [slug]: v }
          }
          return next
        })
      }
    }

    const nodes = sessionData?.nodes ?? []
    if (currentIndex < nodes.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      const { data: completion } = await sb.rpc('complete_session_by_token', { p_token: token })
      const redirectUrl = sessionData?.study?.completion_redirect_url
      if (redirectUrl) {
        setState('redirecting')
        setTimeout(() => { window.location.href = redirectUrl }, 2000)
      } else {
        setCompletionInfo(completion ?? null)
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

  if (state === 'completed') {
    return <FullScreen><StatusCard>You have completed this session. Thank you!</StatusCard></FullScreen>
  }

  if (state === 'session_complete') {
    return <FullScreen><StatusCard>{completionMessage(completionInfo)}</StatusCard></FullScreen>
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
    // Rendered inline (not a navigate-away to the standalone /study/:id/consent
    // route) using this component's own isolated participant client — that
    // route's global-session AuthRoute guard has nothing to authenticate a
    // genuine anonymous participant with, since sb's session is deliberately
    // never persisted to the global client/localStorage. See ConsentGate.jsx.
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #FCF0F5)', display: 'flex', justifyContent: 'center' }}>
        <ConsentGate
          studyId={consentStudyId}
          participantId={fullDataRef.current?.link?.participant_id}
          supabaseClient={sb}
          onComplete={handleConsentComplete}
        />
      </div>
    )
  }

  if (state === 'needs_contact_email') {
    // Same inline pattern as the consent gate above — must use this
    // component's isolated participant client.
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #FCF0F5)', display: 'flex', justifyContent: 'center' }}>
        <ContactEmailGate
          studyId={fullDataRef.current?.link?.study_id}
          supabaseClient={sb}
          onComplete={handleContactEmailComplete}
        />
      </div>
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
            scheduleId={sessionData.schedule?.id ?? null}
            studyDay={sessionData.schedule?.study_day ?? null}
            sendTime={sessionData.schedule?.send_time ?? null}
            stepIndex={currentIndex}
            totalSteps={totalSteps}
            onComplete={handleStepComplete}
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

// new Date('YYYY-MM-DD') parses as UTC midnight, which renders as the
// previous day anywhere west of Greenwich — parse as local time instead.
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Manual 12-hour formatting — toLocaleTimeString gives "6:00 p.m." in
// en-CA, whose trailing period doubles up against the sentence's own.
function formatSendTime(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h)) return null
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Completion copy from complete_session_by_token's { next_contact, has_more }:
// a concrete date/time for the next interaction — from a materialized schedule
// row, or (next_contact.estimated) derived from the study design when the next
// segment hasn't materialized yet (fork gate). A study-complete line at the end
// of the graph, a soft "watch your email" line only if even the design can't
// name a date, and the old generic text for legacy no-graph studies.
function completionMessage(info) {
  const generic = 'You have completed this session. Thank you!'
  if (!info) return generic

  const next = info.next_contact
  if (next?.scheduled_date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextDay = parseLocalDate(next.scheduled_date)
    const days = Math.round((nextDay - today) / 86400000)
    const time = formatSendTime(next.send_time)
    // `estimated` = derived from the design because the schedule row isn't
    // materialized yet; the date/time are still exact for a fixed-cadence study,
    // so we state them and just say to "watch for" the link rather than implying
    // it's already been sent.
    const linkLine = next.estimated
      ? 'Watch for an email with your link when it opens.'
      : 'A link will be emailed to you when it opens.'
    if (days <= 0) {
      return `Thank you — this session is complete! Your next session is later today${time ? ` at ${time}` : ''}. ${linkLine}`
    }
    const dateLabel = nextDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    const when = days === 1 ? `tomorrow (${dateLabel})` : `in ${days} days (${dateLabel})`
    return `Thank you — this session is complete! Your next session is ${when}${time ? ` at ${time}` : ''}. ${linkLine}`
  }

  if (info.has_more) {
    return 'Thank you — this session is complete! Your next session is coming soon — watch your email for the link.'
  }
  if (info.has_more === false) {
    return 'Thank you — you have completed the final session of this study!'
  }
  return generic
}
