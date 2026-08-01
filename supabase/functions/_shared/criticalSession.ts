// criticalSession — which sessions in a design_graph earn a deadline-anchored
// "last chance" reminder, and what the honest consequence of missing one is.
//
// A long assessment window (Liliana's midpoint is 72 h) makes cadence-anchored
// reminders land nowhere near the deadline: at 12 h cadence and reminder_max 2,
// the last reminder fires 48 h before the link closes. Calling that a last
// chance would be false, so the final notice is anchored to expires_at instead
// (see check_schedule's reminder pass).
//
// Three kinds, because what actually happens on a miss differs and the email
// must not threaten a consequence the code won't apply — the same rule that
// forced renderTerminationEmail to stop hardcoding "at least 10 of 12":
//   'gate'     — the session gates a randomize fork. Missing it means the fork
//                can never resolve, and materializeSchedule formally withdraws
//                the participant ('missed_assessment' + termination email).
//                Liliana's s_mid.
//   'terminal' — the session ends the graph. Nobody is withdrawn; the study
//                simply finishes without those answers. Liliana's s_final,
//                Zerin's s_post.
//   'window'   — neither, but a study author forced it on. Carries urgency
//                about the closing window and makes NO claim about what
//                follows, because we can't derive one.
//
// Baselines are excluded even when they gate a fork (Zerin's s_baseline does):
// nothing is underway to lose, since the study doesn't begin until the baseline
// is completed (Norm, 2026-08-01).

import type { Graph, GraphNode } from './materializeSchedule.ts'
import { entryNode } from './materializeSchedule.ts'

export type CriticalKind = 'gate' | 'terminal' | 'window'

/** Hours before expires_at that the final notice fires. */
export const FINAL_NOTICE_LEAD_HOURS = 12

/**
 * A cadence reminder falling this close to the final notice is redundant with
 * it — the final notice replaces it rather than arriving beside it. Applied on
 * both sides: a cadence reminder 12 h before the notice still sends (it is a
 * genuine separate nudge), one due the same evening does not.
 */
export const FINAL_NOTICE_MERGE_HOURS = 6

/**
 * Shortest link window for which a 12 h final notice is meaningful. Excludes
 * Zerin's 4 h EMA check-ins structurally rather than by name — for those the
 * lead time would land before the link was even issued.
 */
export const MIN_CRITICAL_WINDOW_HOURS = 24

/** The first session the graph schedules — the baseline, by construction. */
function entrySessionId(graph: Graph): string | null {
  const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
  const walked = new Set<string>()
  let at: string | null = entryNode(graph)?.id ?? null

  while (at && !walked.has(at)) {
    walked.add(at)
    const n: GraphNode | undefined = nodeMap[at]
    if (!n) return null
    if (n.type === 'session') return n.id
    if (n.type === 'block') return (n.children ?? [])[0] ?? null
    if (n.type === 'counterbalance') {
      // Which order was drawn is per-participant; any arm's first session is
      // equally "the entry session" for this purpose, so take the authored one.
      for (const bid of n.block_ids ?? []) {
        const first = (nodeMap[bid]?.children ?? [])[0]
        if (first) return first
      }
      return null
    }
    if (n.type === 'randomize') return null // arm-dependent — no single entry session
    at = graph.edges.find((e) => e.from === at)?.to ?? null
  }
  return null
}

/**
 * True when this session is the assessment gating a randomize fork. Mirrors the
 * hop-walk in complete_session_by_token (v_gates_fork) and the fork branch of
 * materializeSchedule: adherence_check nodes are transparent, anything else
 * ends the walk.
 */
function gatesFork(graph: Graph, sessionId: string): boolean {
  const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
  const walked = new Set<string>()
  let at: string | null = graph.edges.find((e) => e.from === sessionId)?.to ?? null

  while (at && !walked.has(at)) {
    walked.add(at)
    const type = nodeMap[at]?.type
    if (type === 'randomize') return true
    if (type !== 'adherence_check') return false
    at = graph.edges.find((e) => e.from === at)?.to ?? null
  }
  return false
}

/**
 * True when nothing follows this session — completing it ends the study.
 *
 * A missing outgoing edge is NOT sufficient: sessions inside a block or a
 * counterbalance block never carry edges of their own (the walk emits them in
 * order and continues from the container), so every daily training session in
 * Liliana's Phase 1 looks edgeless. Only a top-level session with no successor
 * actually ends the graph.
 */
function isTerminal(graph: Graph, sessionId: string): boolean {
  const isBlockChild = graph.nodes.some(
    (n) => n.type === 'block' && (n.children ?? []).includes(sessionId),
  )
  if (isBlockChild) return false
  return !graph.edges.some((e) => e.from === sessionId)
}

/**
 * The final-notice kind for a session node, or null when it gets no final
 * notice. `linkExpiresHours` is the compiled slot's window
 * (study_sessions.link_expires_hours), not the link's remaining lifetime.
 *
 * `final_notice` on the node is a tri-state override: undefined derives,
 * false suppresses, true forces one on (falling back to the claim-free
 * 'window' kind when the graph gives us no consequence to name).
 */
export function criticalSessionKind(
  graph: Graph,
  nodeKey: string,
  linkExpiresHours: number,
): CriticalKind | null {
  const node = graph.nodes.find((n) => n.id === nodeKey)
  if (!node || node.type !== 'session') return null
  if (node.final_notice === false) return null

  const forced = node.final_notice === true

  // A forced node skips the derivation guards but not the window check: there
  // is no honest way to send a 12 h warning on a 4 h link.
  if (linkExpiresHours < MIN_CRITICAL_WINDOW_HOURS) return null
  if (!forced && entrySessionId(graph) === node.id) return null

  if (gatesFork(graph, node.id)) return 'gate'
  if (isTerminal(graph, node.id)) return 'terminal'
  return forced ? 'window' : null
}
