import { supabase } from './supabase'
import { generateSchedule } from './scheduleGenerator'

/**
 * Build the schedule for a participant an admin has just enrolled.
 *
 * Branches the way `auto-enroll` already does, because admin enrollment did
 * not and that is what stranded participants in Experiment Builder studies:
 *
 *   design_graph present → materialize_participant_schedule Edge Function,
 *     which calls the same `_shared/materializeSchedule.ts` auto-enroll uses.
 *     Every row is dated up front, so nothing depends on `advanceSchedule()`
 *     — which only ever runs from the admin session runner, never from a
 *     participant completing through their own link.
 *
 *   no design_graph → the existing client-side `generateSchedule`, unchanged.
 *     Every non-graph study with participants is single-session, where that
 *     helper is correct: one row, dated today. Deliberately left alone rather
 *     than rewritten, so the ~438 enrollments on that path keep the exact code
 *     they have today.
 *
 * The graph lookup happens here rather than in the page query because
 * `design_graph` is a large jsonb and enrolling is rare — no reason to carry it
 * in every admin page load.
 *
 * Known gap, deliberately not closed here: a NON-graph study with several
 * sessions would still get null-dated rows after the first. No such study has
 * participants today, and fixing it properly means teaching
 * `complete_session_by_token` to advance — shared code that every SONA and
 * Prolific participant also runs through. Tracked in
 * docs/markdowns/dana_study_followups.md instead.
 */
export async function buildEnrollmentSchedule(participantId, studyId) {
  const { data: study, error } = await supabase
    .from('studies')
    .select('design_graph')
    .eq('id', studyId)
    .single()
  if (error) throw error

  if (!study?.design_graph) {
    await generateSchedule(participantId, studyId, new Date())
    return { mode: 'legacy' }
  }

  const { data, error: fnErr } = await supabase.functions.invoke(
    'materialize_participant_schedule',
    { body: { participantId, studyId } },
  )
  if (fnErr) throw new Error(`Could not build the participant's schedule: ${fnErr.message}`)
  if (data?.error) throw new Error(`Could not build the participant's schedule: ${data.error}`)

  return { mode: 'graph', inserted: data?.inserted ?? 0 }
}
