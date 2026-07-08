// materializeSchedule — walks a compiled Experiment Builder graph (studies.design_graph)
// and bulk-creates the participant's participant_schedule rows at enrollment.
//
// Phase 1: linear chain + block nodes only, no randomize/counterbalance forks.
// P2 will re-walk from a saved fromNodeId when a participant reaches an unresolved fork.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { issueLink } from './issueLink.ts'

export interface GraphNode {
  id: string
  type: 'timepoint' | 'session' | 'block'
  day_offset?: number
  time_of_day?: string | null
  session_template_id?: string
  link_expires_hours?: number
  label?: string
  children?: string[]
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

/** Ordered top-level node ids, walking the chain from fromNodeId (or the entry). */
function chainOrder(graph: Graph, fromNodeId: string | null): string[] {
  const order: string[] = []
  const visited = new Set<string>()
  let cur = fromNodeId ?? entryNode(graph)?.id ?? null
  while (cur && !visited.has(cur)) {
    visited.add(cur)
    order.push(cur)
    cur = graph.edges.find((e) => e.from === cur)?.to ?? null
  }
  return order
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

/**
 * Walk the graph and produce one planned row per session node (including
 * block children). time_of_day on a timepoint is explicit-or-baseline —
 * a null time_of_day inherits baselineSendTime directly, not the nearest
 * preceding timepoint's resolved time.
 */
function planRows(graph: Graph, fromNodeId: string | null, t0Date: string, baselineSendTime: string): PlannedRow[] {
  const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
  const order = chainOrder(graph, fromNodeId)

  const rows: PlannedRow[] = []
  let currentOffset = 0
  let currentTime = baselineSendTime

  for (const nodeId of order) {
    const node = nodeMap[nodeId]
    if (!node) continue

    if (node.type === 'timepoint') {
      currentOffset = node.day_offset ?? 0
      currentTime = node.time_of_day || baselineSendTime
    } else if (node.type === 'session') {
      rows.push({
        nodeKey: node.id,
        scheduledDate: addDays(t0Date, currentOffset),
        sendTime: currentTime,
        studyDay: currentOffset + 1,
      })
    } else if (node.type === 'block') {
      const children = (node.children ?? []).map((cid) => nodeMap[cid]).filter(Boolean) as GraphNode[]
      children.forEach((child, i) => {
        rows.push({
          nodeKey: child.id,
          scheduledDate: addDays(t0Date, currentOffset + i),
          sendTime: currentTime,
          studyDay: currentOffset + i + 1,
        })
      })
    }
  }

  return rows
}

export interface MaterializeArgs {
  participantId: string
  studyId: string
  graph: Graph
  seed?: string | null // unused in P1, reserved for P2 balanced draws
  t0Date: string // enrollment date, YYYY-MM-DD
  baselineSendTime: string // time from the baseline timepoint
  fromNodeId?: string | null // null = start at entry
}

export interface MaterializeResult {
  inserted: number
  stoppedAt: string | null
}

/**
 * Bulk-create participant_schedule rows for a participant from a design_graph.
 * No-ops if rows already exist for (participantId, studyId) — safe to call
 * on retries or double submissions.
 */
export async function materializeSchedule(
  db: SupabaseClient,
  args: MaterializeArgs,
): Promise<MaterializeResult> {
  const { participantId, studyId, graph, t0Date, baselineSendTime } = args
  const fromNodeId = args.fromNodeId ?? null

  const { count, error: countErr } = await db
    .from('participant_schedule')
    .select('id', { count: 'exact', head: true })
    .eq('participant_id', participantId)
    .eq('study_id', studyId)

  if (countErr) throw countErr
  if (count && count > 0) return { inserted: 0, stoppedAt: null }

  const rows = planRows(graph, fromNodeId, t0Date, baselineSendTime)
  if (rows.length === 0) return { inserted: 0, stoppedAt: null }

  const { data: sessionRows, error: sessErr } = await db
    .from('study_sessions')
    .select('id, node_key, link_expires_hours')
    .eq('study_id', studyId)

  if (sessErr) throw sessErr
  const sessionByNodeKey = new Map((sessionRows ?? []).map((r) => [r.node_key, r]))

  const inserts = rows.map((row, i) => {
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
    .insert(inserts.map(({ _linkExpiresHours, ...rest }) => rest))

  if (insErr) throw insErr

  // Insert order isn't guaranteed by Postgres, so look the unlocked row back
  // up by status rather than trusting array position — only index 0 was
  // inserted as 'unlocked', so there is exactly one match.
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
    linkExpiresHours: inserts[0]._linkExpiresHours,
  })

  // P1 has no randomize nodes — the walk always runs to completion.
  return { inserted: inserts.length, stoppedAt: null }
}
