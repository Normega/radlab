// materializeSchedule — walks a compiled Experiment Builder graph (studies.design_graph)
// and bulk-creates the participant's participant_schedule rows, including
// resolving randomize/counterbalance forks as they're reached.
//
// Always walks from the true graph entry on every call and relies on
// per-node idempotency (skip anything already materialized) rather than
// resuming from a saved position — simpler and more robust than
// reconstructing offset/time context at an arbitrary midpoint, and it's
// what makes repeat calls (the check_schedule advance pass) safe.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { issueLink } from './issueLink.ts'

export interface RandomizeArm {
  group: string
  weight?: number
  entry: string
}

export interface GraphNode {
  id: string
  type: 'timepoint' | 'session' | 'block' | 'randomize' | 'counterbalance'
  day_offset?: number
  time_of_day?: string | null
  session_template_id?: string
  link_expires_hours?: number
  label?: string
  children?: string[] // block
  arms?: RandomizeArm[] // randomize
  block_ids?: string[] // counterbalance
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
}

export interface MaterializeResult {
  inserted: number
  stoppedAt: string | null
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
  const { participantId, studyId, graph, t0Date, baselineSendTime } = args

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
    .select('status, study_session_id')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
  if (schedErr) throw schedErr

  const materialized = new Map<string, string>() // nodeKey -> status
  for (const row of scheduleRows ?? []) {
    const session = sessionById.get(row.study_session_id)
    if (session) materialized.set(session.node_key, row.status)
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
  let stoppedAt: string | null = null

  function emit(nodeKey: string, offset: number, time: string) {
    const status = materialized.get(nodeKey)
    if (status === undefined) {
      inserts.push({ nodeKey, scheduledDate: addDays(t0Date, offset), sendTime: time, studyDay: offset + 1 })
      anyUpstreamActionable = true // just created this pass — actionable by definition
      lastSessionStatus = undefined
    } else {
      if (ACTIONABLE.has(status)) anyUpstreamActionable = true
      lastSessionStatus = status
    }
  }

  const seen = new Set<string>()
  let cur: string | null = entryNode(graph)?.id ?? null

  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const node = nodeMap[cur]
    if (!node) break

    if (node.type === 'timepoint') {
      currentOffset = node.day_offset ?? 0
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
      if (anyUpstreamActionable || lastSessionStatus !== 'completed') {
        stoppedAt = node.id
        break
      }
      let group = assignmentByNode.get(node.id) as string | undefined
      if (!group) {
        const draw = await drawAssignment(db, studyId, node.id, participantId)
        group = draw.value as string
      }
      const arm = (node.arms ?? []).find((a) => a.group === group)
      if (!arm) throw new Error(`materializeSchedule: randomize "${node.id}" drew group "${group}" with no matching arm`)
      cur = arm.entry

    } else {
      cur = null
    }
  }

  if (inserts.length === 0) return { inserted: 0, stoppedAt }

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
      status: i === 0 ? 'unlocked' : 'pending',
      _linkExpiresHours: session.link_expires_hours,
    }
  })

  const { error: insErr } = await db
    .from('participant_schedule')
    .insert(insertRows.map(({ _linkExpiresHours, ...rest }) => rest))
  if (insErr) throw insErr

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

  return { inserted: insertRows.length, stoppedAt }
}
