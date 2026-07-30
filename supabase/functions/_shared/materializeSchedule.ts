// materializeSchedule — walks a compiled Experiment Builder graph (studies.design_graph)
// and bulk-creates the participant's participant_schedule rows, including
// resolving randomize/counterbalance forks as they're reached.
//
// Always walks from the true graph entry on every call and relies on
// per-node idempotency (skip anything already materialized) rather than
// resuming from a saved position — simpler and more robust than
// reconstructing offset/time context at an arbitrary midpoint, and it's
// what makes repeat calls (the check_schedule advance pass) safe.
//
// A node's day_offset is nominal, not the participant's calendar: a segment
// behind a gating assessment starts the day after that assessment was
// actually completed, and everything after it moves by the same offset (see
// `dayShift`) — early completion pulls the rest of the study in, late
// completion pushes it out. Rows already materialized are never moved; the
// shift only decides where the next unmaterialized segment lands.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { issueLink } from './issueLink.ts'
import { labDateOf, todayInLabTz } from './labDate.ts'

export interface RandomizeArm {
  group: string
  weight?: number
  entry: string
}

export interface GraphNode {
  id: string
  type: 'timepoint' | 'session' | 'block' | 'randomize' | 'counterbalance' | 'adherence_check'
  day_offset?: number
  time_of_day?: string | null
  session_template_id?: string
  link_expires_hours?: number
  label?: string
  children?: string[] // block
  arms?: RandomizeArm[] // randomize
  block_ids?: string[] // counterbalance
  phase?: string // adherence_check — 'phase1' | 'phase2', matches intervention_modules.phase
  min_required?: number // adherence_check
  of_total?: number // adherence_check, informational only (shown in the withdrawal reason)
}

export interface AdherenceWithdrawal {
  // 'adherence': failed an adherence_check node's completed-session count.
  // 'missed_assessment': the session gating a randomize fork (e.g. Liliana's
  // midpoint) went 'missed' — the fork can never resolve, so rather than
  // stalling silently forever the participant is formally withdrawn.
  kind: 'adherence' | 'missed_assessment'
  nodeId: string
  phase?: string // adherence only
  completed?: number // adherence only
  minRequired?: number // adherence only
  ofTotal?: number // adherence only
  gateLabel?: string // missed_assessment only — the gating session's label
}

export interface GraphEdge {
  from: string
  to: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

function blockChildIds(graph: Graph): Set<string> {
  const ids = new Set<string>()
  for (const n of graph.nodes) {
    if (n.type === 'block') n.children?.forEach((c) => ids.add(c))
  }
  return ids
}

function topLevelNodes(graph: Graph): GraphNode[] {
  const children = blockChildIds(graph)
  return graph.nodes.filter((n) => !children.has(n.id))
}

/** Top-level node with no incoming edge — the graph's single entry point. */
export function entryNode(graph: Graph): GraphNode | null {
  const targets = new Set(graph.edges.map((e) => e.to))
  return topLevelNodes(graph).find((n) => !targets.has(n.id)) ?? null
}

/** The baseline (entry) timepoint's own time_of_day, falling back to 09:00. */
export function baselineTimeOfDay(graph: Graph): string {
  const entry = entryNode(graph)
  return entry?.time_of_day || '09:00'
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'); negative if `to` is earlier. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  )
}

interface PlannedRow {
  nodeKey: string
  scheduledDate: string
  sendTime: string
  studyDay: number
}

async function drawAssignment(
  db: SupabaseClient,
  studyId: string,
  nodeId: string,
  participantId: string,
): Promise<{ value: unknown; draw_index: number }> {
  const { data, error } = await db.rpc('draw_assignment', {
    p_study_id: studyId,
    p_slot_key: nodeId,
    p_participant_id: participantId,
  })
  if (error) throw error
  return data as { value: unknown; draw_index: number }
}

export interface MaterializeArgs {
  participantId: string
  studyId: string
  graph: Graph
  t0Date: string // enrollment date, YYYY-MM-DD
  baselineSendTime: string // time from the baseline timepoint
  // True only when the participant is present in the browser right now
  // (auto-enroll): the first inserted row is set 'unlocked' with a link
  // issued immediately so it can be served back in the same response.
  // False (default) for the check_schedule advance pass — nobody is there
  // to receive an instant link, and the due-row sender only emails
  // 'pending' rows, so an 'unlocked' row created here would never be
  // emailed at all (it would just expire into 'missed').
  unlockFirst?: boolean
}

export interface MaterializeResult {
  inserted: number
  stoppedAt: string | null
  withdrawal: AdherenceWithdrawal | null
  // True when the walk ran off the end of the graph with nothing upstream
  // actionable and the final session completed — i.e. the participant has
  // finished the whole study. The caller marks the enrollment 'completed'.
  completedStudy: boolean
}

/**
 * Count of this participant's completed daily training sessions in the given
 * phase — Liliana-specific (liliana_participants/liliana_day_data/
 * intervention_modules), not a generic graph-position count. See
 * get_liliana_credit_report (20260714_liliana_sona_credit_report.sql) for
 * the same pattern used by the SONA credit report.
 */
async function countCompletedPhaseDays(
  db: SupabaseClient,
  participantId: string,
  studyId: string,
  phase: string,
): Promise<number> {
  const { data: lp, error: lpErr } = await db
    .from('liliana_participants')
    .select('id')
    .eq('profile_id', participantId)
    .eq('study_id', studyId)
    .maybeSingle()
  if (lpErr) throw lpErr
  if (!lp) return 0

  const { data: dayRows, error: dayErr } = await db
    .from('liliana_day_data')
    .select('module_id')
    .eq('participant_id', lp.id)
    .not('completed_at', 'is', null)
  if (dayErr) throw dayErr

  const moduleIds = [...new Set((dayRows ?? []).map((r) => r.module_id).filter(Boolean))]
  if (moduleIds.length === 0) return 0

  const { data: modRows, error: modErr } = await db
    .from('intervention_modules')
    .select('module_id, phase')
    .in('module_id', moduleIds)
  if (modErr) throw modErr

  const phaseByModule = new Map((modRows ?? []).map((m) => [m.module_id, m.phase]))
  return (dayRows ?? []).filter((r) => phaseByModule.get(r.module_id) === phase).length
}

/**
 * Bulk-create participant_schedule rows for a participant from a design_graph,
 * resolving forks as they're reached. Safe to call repeatedly (enrollment,
 * then again from the check_schedule advance pass after each fork resolves) —
 * already-materialized nodes are skipped, not re-inserted or re-drawn.
 */
export async function materializeSchedule(
  db: SupabaseClient,
  args: MaterializeArgs,
): Promise<MaterializeResult> {
  const { participantId, studyId, graph, t0Date, baselineSendTime, unlockFirst = false } = args

  // study_sessions gives node_key -> study_session_id (needed for every
  // insert) and, joined against existing participant_schedule rows, which
  // nodes are already materialized and their status (needed for the
  // randomize "reached" check and to skip re-inserting).
  const { data: sessionRows, error: sessErr } = await db
    .from('study_sessions')
    .select('id, node_key, link_expires_hours')
    .eq('study_id', studyId)
  if (sessErr) throw sessErr

  const sessionByNodeKey = new Map((sessionRows ?? []).map((r) => [r.node_key, r]))
  const sessionById = new Map((sessionRows ?? []).map((r) => [r.id, r]))

  const { data: scheduleRows, error: schedErr } = await db
    .from('participant_schedule')
    .select('status, study_session_id, scheduled_date, completed_at')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
  if (schedErr) throw schedErr

  interface MaterializedRow {
    status: string
    scheduledDate: string | null
    completedAt: string | null
  }

  const materialized = new Map<string, MaterializedRow>() // nodeKey -> row
  for (const row of scheduleRows ?? []) {
    const session = sessionById.get(row.study_session_id)
    if (session) {
      materialized.set(session.node_key, {
        status: row.status,
        scheduledDate: row.scheduled_date ?? null,
        completedAt: row.completed_at ?? null,
      })
    }
  }

  const { data: assignmentRows, error: assignErr } = await db
    .from('participant_assignments')
    .select('node_id, value')
    .eq('study_id', studyId)
    .eq('participant_id', participantId)
  if (assignErr) throw assignErr

  const assignmentByNode = new Map((assignmentRows ?? []).map((r) => [r.node_id, r.value]))

  const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))

  const inserts: PlannedRow[] = []
  let currentOffset = 0
  let currentTime = baselineSendTime
  // Fork gating (see the randomize branch below): a fork resolves once
  // nothing upstream is still actionable AND the session immediately before
  // the fork (the assessment that gates it, e.g. Liliana's midpoint) is
  // completed. Rows in a terminal-but-incomplete state ('missed', 'blocked')
  // do NOT block — participants may miss daily sessions and still advance
  // (methods doc allows missed days; check_schedule marks dead rows 'missed').
  // A missed gate session, by contrast, never resolves the fork = withdrawal.
  const ACTIONABLE = new Set(['pending', 'unlocked', 'link_sent'])
  let anyUpstreamActionable = false
  let lastSessionStatus: string | undefined
  let lastSessionNodeKey: string | undefined
  let stoppedAt: string | null = null
  let withdrawal: AdherenceWithdrawal | null = null
  // Days by which this participant's calendar runs ahead of the graph's
  // nominal day_offsets (negative = behind) — see the timepoint and randomize
  // branches below. Zero for everyone who completes a gating assessment on the
  // last day of its window, which is the calendar the graph was authored
  // against.
  let dayShift = 0
  let pendingGateOffset: number | null = null
  const todayOffset = daysBetween(t0Date, todayInLabTz())

  function emit(nodeKey: string, offset: number, time: string) {
    // A session reached without an intervening timepoint continues the current
    // calendar — there is no timepoint left for a pending gate to reposition.
    pendingGateOffset = null
    const row = materialized.get(nodeKey)
    if (row === undefined) {
      inserts.push({ nodeKey, scheduledDate: addDays(t0Date, offset), sendTime: time, studyDay: offset + 1 })
      anyUpstreamActionable = true // just created this pass — actionable by definition
      lastSessionStatus = undefined
      lastSessionNodeKey = undefined
    } else {
      if (ACTIONABLE.has(row.status)) anyUpstreamActionable = true
      lastSessionStatus = row.status
      lastSessionNodeKey = nodeKey
    }
  }

  /**
   * The first session node a timepoint schedules, following the same
   * structural nodes the walk itself does. Its materialized row (when there is
   * one) is what anchors the timepoint to the participant's real calendar.
   * Null at a randomize fork — which arm was drawn is decided by the walk, not
   * by peeking ahead.
   */
  function firstSessionAfter(timepointId: string): string | null {
    const walked = new Set<string>()
    let at = graph.edges.find((e) => e.from === timepointId)?.to ?? null
    while (at && !walked.has(at)) {
      walked.add(at)
      const n: GraphNode | undefined = nodeMap[at]
      if (!n) return null
      if (n.type === 'session') return n.id
      if (n.type === 'block') return (n.children ?? [])[0] ?? null
      if (n.type === 'counterbalance') {
        const order = (assignmentByNode.get(n.id) as string[] | undefined) ?? n.block_ids ?? []
        for (const bid of order) {
          const first = (nodeMap[bid]?.children ?? [])[0]
          if (first) return first
        }
        return null
      }
      if (n.type === 'adherence_check') {
        at = graph.edges.find((e) => e.from === at)?.to ?? null
        continue
      }
      return null
    }
    return null
  }

  const seen = new Set<string>()
  let cur: string | null = entryNode(graph)?.id ?? null

  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const node = nodeMap[cur]
    if (!node) break

    if (node.type === 'timepoint') {
      const nominal = node.day_offset ?? 0
      const anchorKey = firstSessionAfter(node.id)
      const anchorDate = anchorKey ? materialized.get(anchorKey)?.scheduledDate : null

      if (anchorDate) {
        // Already materialized: adopt whatever shift these rows were created
        // with rather than recomputing one. Repeat passes then stay on the
        // calendar the participant was actually emailed, and a pull-forward
        // applied on an earlier pass carries into the timepoints that are
        // still to be materialized. (A day_offset edited after enrollment is
        // deliberately not retro-applied to a participant already running.)
        dayShift = nominal - daysBetween(t0Date, anchorDate)
        pendingGateOffset = null
      } else if (pendingGateOffset !== null) {
        // This segment is gated (see the randomize branch), so it starts the
        // day after the gate was completed rather than on its nominal day —
        // in BOTH directions, and every later timepoint moves with it:
        //   completed early -> pulled in, no dead air waiting out the window
        //   completed late  -> pushed out, rather than materializing rows
        //                      already in the past (which check_schedule sends
        //                      as a burst and then sweeps to 'missed')
        // Never before today: when the fork itself resolves late (cron lag, an
        // admin clearing a 'blocked' row days later) the day after completion
        // may already be gone, and rows must not be back-dated.
        const start = Math.max(pendingGateOffset + 1, todayOffset)
        dayShift = nominal - start
        pendingGateOffset = null
      }

      currentOffset = nominal - dayShift
      currentTime = node.time_of_day || baselineSendTime
      cur = graph.edges.find((e) => e.from === cur)?.to ?? null

    } else if (node.type === 'session') {
      emit(node.id, currentOffset, currentTime)
      cur = graph.edges.find((e) => e.from === cur)?.to ?? null

    } else if (node.type === 'block') {
      const children = (node.children ?? []).map((cid) => nodeMap[cid]).filter(Boolean) as GraphNode[]
      children.forEach((child, i) => emit(child.id, currentOffset + i, currentTime))
      currentOffset += children.length
      cur = graph.edges.find((e) => e.from === cur)?.to ?? null

    } else if (node.type === 'counterbalance') {
      let orderedBlockIds = assignmentByNode.get(node.id) as string[] | undefined
      if (!orderedBlockIds) {
        const draw = await drawAssignment(db, studyId, node.id, participantId)
        orderedBlockIds = draw.value as string[]
      }
      let i = 0
      for (const bid of orderedBlockIds) {
        const block = nodeMap[bid]
        if (!block) continue
        for (const cid of block.children ?? []) {
          if (!nodeMap[cid]) continue
          emit(cid, currentOffset + i, currentTime)
          i++
        }
      }
      currentOffset += i
      cur = graph.edges.find((e) => e.from === cur)?.to ?? null

    } else if (node.type === 'randomize') {
      if (anyUpstreamActionable) {
        stoppedAt = node.id
        break
      }
      if (lastSessionStatus !== 'completed') {
        // 'missed' is terminal — the gating assessment's window lapsed and
        // it can never complete, so the fork can never resolve. Formal
        // withdrawal + termination email (Norm, 2026-07-15) instead of the
        // old silent stall. Other non-completed states (e.g. 'blocked')
        // still stall so an admin can intervene.
        if (lastSessionStatus === 'missed') {
          const gateLabel = lastSessionNodeKey ? nodeMap[lastSessionNodeKey]?.label : undefined
          withdrawal = { kind: 'missed_assessment', nodeId: node.id, gateLabel }
        }
        stoppedAt = node.id
        break
      }
      // The arm's nominal calendar assumes the gating assessment was completed
      // on the LAST day of its window — Liliana's midpoint window is days
      // 14-16 and Phase 2 nominally starts day 17, so an early completion used
      // to buy nothing but two days of silence. Record the day it was actually
      // completed; the arm's first timepoint starts the day after, and every
      // timepoint after it (including the shared final window) moves with it.
      // The window stays three days long — it is a catch window, not a waiting
      // period (Norm, 2026-07-29).
      //
      // A gate completed after its arm's nominal start moves the same way, in
      // the other direction: without this the arm materialized into the past,
      // where check_schedule sends the first row immediately and sweeps the
      // rest to 'missed' a day later. Reachable wherever a gate's link can
      // outlive the next timepoint (Zerin's post-baseline fork, arm timepoints
      // at offset 1) — not on Liliana's midpoint, whose 72 h window closes
      // before Phase 2's nominal day 17 either way.
      const gateCompletedAt = lastSessionNodeKey
        ? materialized.get(lastSessionNodeKey)?.completedAt
        : null
      if (gateCompletedAt) {
        pendingGateOffset = Math.max(0, daysBetween(t0Date, labDateOf(gateCompletedAt)))
      }

      let group = assignmentByNode.get(node.id) as string | undefined
      if (!group) {
        const draw = await drawAssignment(db, studyId, node.id, participantId)
        group = draw.value as string
      }
      const arm = (node.arms ?? []).find((a) => a.group === group)
      if (!arm) throw new Error(`materializeSchedule: randomize "${node.id}" drew group "${group}" with no matching arm`)
      cur = arm.entry

    } else if (node.type === 'adherence_check') {
      // Same "everything upstream resolved" gate as a randomize fork — but
      // unlike a fork, there's no single gating session to require completed;
      // any mix of completed/missed daily sessions is fine, only the count matters.
      if (anyUpstreamActionable) {
        stoppedAt = node.id
        break
      }
      const minRequired = node.min_required ?? 10
      const ofTotal = node.of_total ?? 12
      const completed = await countCompletedPhaseDays(db, participantId, studyId, node.phase ?? 'phase1')
      if (completed < minRequired) {
        withdrawal = { kind: 'adherence', nodeId: node.id, phase: node.phase ?? 'phase1', completed, minRequired, ofTotal }
        stoppedAt = node.id
        break
      }
      cur = graph.edges.find((e) => e.from === cur)?.to ?? null

    } else {
      cur = null
    }
  }

  // Ran off the end of the graph (no gate break), nothing left actionable,
  // and the last session — the final assessment — is completed: the
  // participant has finished the study.
  const completedStudy =
    cur === null && stoppedAt === null && withdrawal === null &&
    !anyUpstreamActionable && lastSessionStatus === 'completed'

  if (inserts.length === 0) return { inserted: 0, stoppedAt, withdrawal, completedStudy }

  const insertRows = inserts.map((row, i) => {
    const session = sessionByNodeKey.get(row.nodeKey)
    if (!session) {
      throw new Error(`No study_sessions row for node_key "${row.nodeKey}" — recompile the graph.`)
    }
    return {
      participant_id: participantId,
      study_id: studyId,
      study_session_id: session.id,
      scheduled_date: row.scheduledDate,
      send_time: row.sendTime,
      study_day: row.studyDay,
      status: unlockFirst && i === 0 ? 'unlocked' : 'pending',
      _linkExpiresHours: session.link_expires_hours,
    }
  })

  const { error: insErr } = await db
    .from('participant_schedule')
    .insert(insertRows.map(({ _linkExpiresHours, ...rest }) => rest))
  if (insErr) throw insErr

  if (unlockFirst) {
    // Insert order isn't guaranteed by Postgres, so look the unlocked row back
    // up by status rather than trusting array position — only the first
    // inserted row this call was 'unlocked', so there is exactly one match.
    const { data: unlockedRow, error: unlockedErr } = await db
      .from('participant_schedule')
      .select('id')
      .eq('participant_id', participantId)
      .eq('study_id', studyId)
      .eq('status', 'unlocked')
      .single()
    if (unlockedErr) throw unlockedErr

    await issueLink(db, {
      scheduleId: unlockedRow.id,
      participantId,
      studyId,
      linkExpiresHours: insertRows[0]._linkExpiresHours,
    })
  }

  return { inserted: insertRows.length, stoppedAt, withdrawal, completedStudy }
}
