// Can this participant still meet the adherence rule for the phase this
// session belongs to? Decides one thing only: whether a missed-session email
// may say "get back on track" / "nothing to make up". Once an enforcing check
// can no longer be met, those lines are false -- the participant will be
// withdrawn when the phase ends whatever they do -- and they read exactly that
// way to Liliana's own test enrollment on 2026-10-13 (missed 11 of 12, told it
// was "a great time to get back on track" the day before withdrawal).
//
// Changes copy only. Nobody is withdrawn earlier or later because of this:
// enforcement stays in materializeSchedule's adherence_check branch, at the
// end of the phase. To keep the two from ever disagreeing, the count here IS
// the enforcement count (countCompletedPhaseDays), and the rule is the study's
// own adherence_check node for this phase -- never a constant.
// (docs/markdowns/adherence_copy_linkage_scope.md: copy must not assert a rule
// the code doesn't apply.)

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { countCompletedPhaseDays, DEFAULT_ADHERENCE_ON_FAIL } from './materializeSchedule.ts'
import type { Graph } from './materializeSchedule.ts'

// Rows that can still be completed. Everything else -- completed, missed,
// blocked, skipped -- can no longer add to the count.
const STILL_OPEN = new Set(['pending', 'unlocked', 'link_sent', 'awaiting_date'])

export interface PhaseOutOfReach {
  minRequired: number
  ofTotal: number
  // Last scheduled day of the phase, YYYY-MM-DD (lab calendar).
  endDate: string
}

/**
 * Pure decision. Null means "still reachable, or can't tell" -- the caller
 * then keeps the ordinary copy, so every uncertain case errs toward the
 * existing wording rather than toward telling someone they are out.
 */
export function phaseOutOfReach(args: {
  check: { min_required?: number; of_total?: number; on_fail?: string } | null
  completed: number
  phaseRows: Array<{ status: string; scheduled_date: string | null }>
}): PhaseOutOfReach | null {
  const { check, completed, phaseRows } = args
  if (!check) return null
  // A 'continue' check is a classification, not an ending: nothing is lost by
  // falling short, so the encouraging copy stays true.
  if ((check.on_fail ?? DEFAULT_ADHERENCE_ON_FAIL) !== 'withdraw') return null

  const minRequired = check.min_required ?? 10
  const ofTotal = check.of_total ?? 12
  // Until the whole phase is materialized the remaining count is unknown.
  if (phaseRows.length < ofTotal) return null

  const open = phaseRows.filter((r) => STILL_OPEN.has(r.status)).length
  if (completed + open >= minRequired) return null

  const dates = phaseRows.map((r) => r.scheduled_date).filter((d): d is string => !!d).sort()
  if (dates.length === 0) return null
  return { minRequired, ofTotal, endDate: dates[dates.length - 1] }
}

/** "Thursday, October 23" for a YYYY-MM-DD lab-calendar date. */
export function formatPhaseEnd(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Loads what phaseOutOfReach needs for one schedule row. A session's phase is
 * its module's phase (study_sessions -> session_template_nodes.module_id ->
 * intervention_modules.phase) -- the same linkage countCompletedPhaseDays
 * counts by. Any failed read returns null: the ordinary copy is the safe
 * default, and an email must never be held up by this.
 */
export async function loadPhaseOutOfReach(
  db: SupabaseClient,
  row: { participant_id: string; study_id: string; study_session_id: string | null },
  graph: Graph | null | undefined,
): Promise<PhaseOutOfReach | null> {
  try {
    const checks = (graph?.nodes ?? []).filter((n) => n.type === 'adherence_check')
    if (checks.length === 0 || !row.study_session_id) return null

    const { data: rows, error: rowsErr } = await db
      .from('participant_schedule')
      .select('status, scheduled_date, study_session_id')
      .eq('participant_id', row.participant_id)
      .eq('study_id', row.study_id)
    if (rowsErr) throw rowsErr

    const sessionIds = [...new Set((rows ?? []).map((r) => r.study_session_id).filter(Boolean))]
    const { data: sessions, error: sessErr } = await db
      .from('study_sessions')
      .select('id, session_template_id')
      .in('id', sessionIds)
    if (sessErr) throw sessErr

    const templateIds = [...new Set((sessions ?? []).map((s) => s.session_template_id).filter(Boolean))]
    const { data: nodes, error: nodeErr } = await db
      .from('session_template_nodes')
      .select('session_template_id, module_id')
      .in('session_template_id', templateIds)
      .not('module_id', 'is', null)
    if (nodeErr) throw nodeErr

    const moduleIds = [...new Set((nodes ?? []).map((n) => n.module_id))]
    const { data: modules, error: modErr } = moduleIds.length === 0
      ? { data: [], error: null }
      : await db.from('intervention_modules').select('module_id, phase').in('module_id', moduleIds)
    if (modErr) throw modErr

    const phaseByModule = new Map((modules ?? []).map((m) => [m.module_id, m.phase]))
    const phaseByTemplate = new Map<string, string>()
    for (const n of nodes ?? []) {
      const p = phaseByModule.get(n.module_id)
      if (p) phaseByTemplate.set(n.session_template_id, p)
    }
    const phaseBySession = new Map<string, string>()
    for (const s of sessions ?? []) {
      const p = phaseByTemplate.get(s.session_template_id)
      if (p) phaseBySession.set(s.id, p)
    }

    const phase = phaseBySession.get(row.study_session_id)
    if (!phase) return null
    const check = checks.find((c) => (c.phase ?? 'phase1') === phase) ?? null
    if (!check) return null

    const completed = await countCompletedPhaseDays(db, row.participant_id, row.study_id, phase)
    const phaseRows = (rows ?? []).filter((r) => phaseBySession.get(r.study_session_id) === phase)
    return phaseOutOfReach({ check, completed, phaseRows })
  } catch (e) {
    console.warn('phase reach lookup failed (ordinary copy used):', e instanceof Error ? e.message : e)
    return null
  }
}
