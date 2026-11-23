import { useEffect, useRef, useState } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import { assignmentAction } from '../../lib/lazySlots'

/**
 * An invisible step that sets one assignment slot partway through a session
 * (activity category 'assignment', subcategory = the slot key; studies.assignment_slot_rules,
 * 20261123_route_by_score_lazy_draws.sql).
 *
 *   assign = 'rule'  route_by_score: the database scores this session's instruments and
 *                    records the arm. The browser receives the arm, never the scores, so
 *                    nothing about them is shown to the participant or the RA.
 *   assign = 'node'  draw_assignment, only when draw_if is met; otherwise the step passes
 *                    without drawing, so the other stratum's balance is not touched.
 *
 * Both calls are idempotent, so a reload or a remount returns the same arm. A failure is
 * retried twice; after that the participant sees a short message and a "Try again" button
 * (the RA is in the room for in-person studies). It never advances without an arm.
 *
 * Which steps run, and with which arms, is decided here; whether the session may open at
 * all is decided only by schedule_row_block_reason (CLAUDE.md "Hard gates").
 */
export default function AssignmentStep({
  slot, studyId, scheduleId, rules, assignments, supabaseClient, onAssigned, onComplete, demoMode = false,
}) {
  const db = supabaseClient ?? globalSupabase
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    let cancelled = false
    const finish = (value) => {
      if (cancelled || doneRef.current) return
      doneRef.current = true
      if (value !== undefined) onAssigned?.(slot, value)
      onComplete({})
    }

    ;(async () => {
      // The admin session demo makes no writes; there is nothing to show here.
      if (demoMode) { finish(undefined); return }
      const plan = assignmentAction(rules?.[slot], assignments)
      if (plan.action === 'error') {
        console.error(`assignment step "${slot}":`, plan.reason)
        setFailed(true)
        return
      }
      if (plan.action === 'skip') { finish(undefined); return }

      for (const delayMs of [0, 1000, 3000]) {
        if (delayMs) await new Promise(r => setTimeout(r, delayMs))
        if (cancelled) return
        const { data, error } = plan.action === 'route'
          ? await db.rpc('route_by_score', { p_study_id: studyId, p_slot_key: slot, p_schedule_id: scheduleId })
          : await db.rpc('draw_assignment', { p_study_id: studyId, p_slot_key: slot })
        if (!error && data && data.value != null) { finish(data.value); return }
        console.warn(`assignment step "${slot}" failed:`, error?.message ?? 'no value')
      }
      if (!cancelled) setFailed(true)
    })()

    return () => { cancelled = true }
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={S.wrap}>
      {failed ? (
        <>
          <p style={S.text}>Something went wrong preparing the next part of the session. Please let the researcher know.</p>
          <button style={S.btn} onClick={() => { setFailed(false); setAttempt(a => a + 1) }}>Try again</button>
        </>
      ) : (
        <p style={S.text}>One moment…</p>
      )}
    </div>
  )
}

const S = {
  wrap: { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px' },
  text: { maxWidth: 480, fontSize: 16, color: 'var(--tx2)', textAlign: 'center', lineHeight: 1.6, fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0 },
  btn:  { padding: '8px 24px', borderRadius: 24, border: '1px solid var(--pk)', background: '#fff', color: 'var(--pkd)', fontSize: 16, fontWeight: 600, fontFamily: '"DM Sans",system-ui,sans-serif', cursor: 'pointer' },
}
