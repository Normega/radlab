/**
 * Pure graph helpers for the Experiment Builder. Frontend-only, no I/O.
 * resolveSchedule.ts (in _shared/) is the separate engine used at enrollment time.
 */

export const newId = () => Math.random().toString(36).slice(2, 11)

// ─── Topology ───────────────────────────────────────────────────────────────

/** Set of node ids that are children inside a block. */
export function blockChildIds(graph) {
  const ids = new Set()
  for (const n of graph.nodes) {
    if (n.type === 'block') n.children?.forEach(c => ids.add(c))
  }
  return ids
}

/** Set of block node ids owned by a counterbalance node's block_ids. */
export function counterbalanceMemberBlockIds(graph) {
  const ids = new Set()
  for (const n of graph.nodes) {
    if (n.type === 'counterbalance') n.block_ids?.forEach(c => ids.add(c))
  }
  return ids
}

/** Top-level nodes (not block children, not counterbalance member blocks). */
export function topLevelNodes(graph) {
  const excluded = new Set([...blockChildIds(graph), ...counterbalanceMemberBlockIds(graph)])
  return graph.nodes.filter(n => !excluded.has(n.id))
}

/** Entry node: top-level with no incoming edge. */
export function entryNode(graph) {
  const targets = new Set(graph.edges.map(e => e.to))
  return topLevelNodes(graph).find(n => !targets.has(n.id)) ?? null
}

/** Ordered top-level node ids walking the linear chain. */
export function chainOrder(graph) {
  const entry = entryNode(graph)
  if (!entry) return []
  const order = []
  const visited = new Set()
  let cur = entry.id
  while (cur && !visited.has(cur)) {
    visited.add(cur)
    order.push(cur)
    cur = graph.edges.find(e => e.from === cur)?.to ?? null
  }
  return order
}

/** Last top-level node in the chain (no outgoing edge). */
function tailNode(graph) {
  const sources = new Set(graph.edges.map(e => e.from))
  return topLevelNodes(graph).find(n => !sources.has(n.id)) ?? null
}

// ─── Validate ────────────────────────────────────────────────────────────────

function factorial(n) {
  let f = 1
  for (let i = 2; i <= n; i++) f *= i
  return f
}

export function validate(graph) {
  const errors = []
  const warnings = []
  if (!graph.nodes.length) return { valid: false, errors: ['Graph is empty.'], warnings: [] }

  const topLevel = topLevelNodes(graph)
  const nodeIds  = new Set(graph.nodes.map(n => n.id))
  const nodeMap  = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const targets  = new Set(graph.edges.map(e => e.to))
  const entries  = topLevel.filter(n => !targets.has(n.id))

  if (entries.length === 0) errors.push('Cycle detected — no entry node found.')
  if (entries.length > 1)  errors.push('Multiple disconnected chains. Each node must be reachable from a single entry.')

  const baseline = entries[0]
  if (baseline && baseline.type !== 'timepoint')
    errors.push('Graph must begin with a Timepoint node.')
  if (baseline?.type === 'timepoint' && baseline.day_offset !== 0)
    errors.push('Baseline timepoint must be Day 1 (day offset 0).')

  const sessionCount = graph.nodes.filter(n => n.type === 'session').length
  if (sessionCount === 0) errors.push('Graph must contain at least one Session.')

  const incomingCount = {}
  for (const e of graph.edges) incomingCount[e.to] = (incomingCount[e.to] ?? 0) + 1

  for (const n of graph.nodes) {
    if (n.type === 'session' && !n.session_template_id)
      errors.push(`Session "${n.label || n.id}" has no template assigned.`)

    if (n.type === 'block') {
      for (const cid of n.children ?? []) {
        if (!nodeIds.has(cid))
          errors.push(`Block "${n.label}" references missing child node "${cid}".`)
      }
      if ((n.children ?? []).length === 0)
        errors.push(`Block "${n.label}" is empty — add at least one session.`)
    }

    if (n.type === 'randomize') {
      const arms = n.arms ?? []
      if (arms.length < 2)
        errors.push(`Randomize "${n.label || n.id}" needs at least 2 arms.`)

      const seenEntries = new Set()
      for (const arm of arms) {
        if (!arm.group) errors.push(`Randomize "${n.label || n.id}" has an arm with no group name.`)
        if (arm.weight != null && (!Number.isInteger(arm.weight) || arm.weight < 1))
          errors.push(`Randomize "${n.label || n.id}" arm "${arm.group}" needs a positive integer weight.`)

        if (!arm.entry) {
          errors.push(`Randomize "${n.label || n.id}" arm "${arm.group}" has no entry node.`)
        } else if (!nodeIds.has(arm.entry)) {
          errors.push(`Randomize "${n.label || n.id}" arm "${arm.group}" references missing entry node "${arm.entry}".`)
        } else {
          if (seenEntries.has(arm.entry))
            errors.push(`Randomize "${n.label || n.id}" has two arms pointing at the same entry node "${arm.entry}".`)
          seenEntries.add(arm.entry)

          if (!graph.edges.some(e => e.from === n.id && e.to === arm.entry))
            errors.push(`Randomize "${n.label || n.id}" arm "${arm.group}" has no edge to its entry node "${arm.entry}".`)
          if ((incomingCount[arm.entry] ?? 0) > 1)
            errors.push(`Node "${arm.entry}" is an arm entry but has more than one incoming edge — arm entries must be reachable only through their randomize node.`)
        }
      }

      const armEntrySet = new Set(arms.map(a => a.entry).filter(Boolean))
      for (const e of graph.edges) {
        if (e.from === n.id && !armEntrySet.has(e.to))
          errors.push(`Randomize "${n.label || n.id}" has an edge to "${e.to}" that doesn't match any declared arm.`)
      }
    }

    if (n.type === 'counterbalance') {
      const blockIds = n.block_ids ?? []
      if (blockIds.length < 2)
        errors.push(`Counterbalance "${n.label || n.id}" needs at least 2 blocks.`)

      const seen = new Set()
      for (const bid of blockIds) {
        if (!nodeIds.has(bid)) {
          errors.push(`Counterbalance "${n.label || n.id}" references missing block "${bid}".`)
        } else if (nodeMap[bid]?.type !== 'block') {
          errors.push(`Counterbalance "${n.label || n.id}" references "${bid}", which is not a Block node.`)
        }
        if (seen.has(bid))
          errors.push(`Counterbalance "${n.label || n.id}" lists block "${bid}" more than once.`)
        seen.add(bid)
      }

      if (blockIds.length > 6) {
        errors.push(`Counterbalance "${n.label || n.id}" has ${blockIds.length} blocks (${factorial(blockIds.length)} permutations) — reduce to 6 or fewer.`)
      } else if (blockIds.length > 4) {
        warnings.push(`Counterbalance "${n.label || n.id}" has ${blockIds.length} blocks (${factorial(blockIds.length)} permutations) — balancing across that many orderings needs a large sample.`)
      }
    }
  }

  for (const e of graph.edges) {
    if (!nodeIds.has(e.from)) errors.push(`Edge references missing node "${e.from}".`)
    if (!nodeIds.has(e.to))   errors.push(`Edge references missing node "${e.to}".`)
  }

  const outDegree = {}
  for (const e of graph.edges) {
    outDegree[e.from] = (outDegree[e.from] ?? 0) + 1
    if (outDegree[e.from] > 1 && nodeMap[e.from]?.type !== 'randomize')
      errors.push(`Node "${e.from}" has more than one outgoing edge (only Randomize nodes may branch).`)
  }

  // Rejoin nodes (multiple incoming edges) must resolve to the same day
  // offset from every upstream path, else "Day N" labeling is ambiguous at
  // authoring time. Runtime correctness is unaffected — each real
  // participant's materializer walk is single-path regardless.
  const { conflicts } = fullTraversal(graph)
  for (const c of conflicts) {
    errors.push(`Node "${c.nodeId}" is reached at different day offsets from different branches (offset ${c.offsets[0]} vs ${c.offsets[1]}) — align the timepoints on each path before this node.`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─── Mutators ────────────────────────────────────────────────────────────────

/** Append a new top-level node to the end of the chain. */
export function addNode(graph, nodeData) {
  const tail    = tailNode(graph)
  const newNode = { id: newId(), ...nodeData }
  const newEdges = tail
    ? [...graph.edges, { from: tail.id, to: newNode.id }]
    : [...graph.edges]
  return { nodes: [...graph.nodes, newNode], edges: newEdges }
}

/** Update fields on a node by id. */
export function updateNode(graph, nodeId, updates) {
  return { ...graph, nodes: graph.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n) }
}

/** Remove a top-level node, splicing its predecessor → successor edge. */
export function removeNode(graph, nodeId) {
  const inEdge  = graph.edges.find(e => e.to   === nodeId)
  const outEdge = graph.edges.find(e => e.from  === nodeId)
  let newEdges = graph.edges.filter(e => e.from !== nodeId && e.to !== nodeId)
  if (inEdge && outEdge) newEdges = [...newEdges, { from: inEdge.from, to: outEdge.to }]

  const node = graph.nodes.find(n => n.id === nodeId)
  const toRemove = new Set([nodeId])
  if (node?.type === 'block') node.children?.forEach(c => toRemove.add(c))

  return { nodes: graph.nodes.filter(n => !toRemove.has(n.id)), edges: newEdges }
}

/** Add a session child to a block. */
export function addSessionToBlock(graph, blockId, sessionData = {}) {
  const child = { id: newId(), type: 'session', link_expires_hours: 48, label: 'New Session', ...sessionData }
  return {
    nodes: [
      ...graph.nodes.map(n =>
        n.id === blockId ? { ...n, children: [...(n.children ?? []), child.id] } : n
      ),
      child,
    ],
    edges: graph.edges,
  }
}

/** Remove a session child from a block. */
export function removeSessionFromBlock(graph, blockId, sessionId) {
  return {
    nodes: graph.nodes
      .filter(n => n.id !== sessionId)
      .map(n => n.id === blockId ? { ...n, children: n.children.filter(c => c !== sessionId) } : n),
    edges: graph.edges,
  }
}

/** Duplicate a block, inserting the copy immediately after the original. */
export function duplicateBlock(graph, blockId) {
  const block = graph.nodes.find(n => n.id === blockId)
  if (!block || block.type !== 'block') return graph

  const newChildNodes = (block.children ?? []).map(cid => {
    const child = graph.nodes.find(n => n.id === cid)
    return { ...child, id: newId() }
  })
  const newBlockId = newId()
  const newBlock = { ...block, id: newBlockId, label: `${block.label} (copy)`, children: newChildNodes.map(c => c.id) }

  const outEdge  = graph.edges.find(e => e.from === blockId)
  const newEdges = [
    ...graph.edges.filter(e => e.from !== blockId),
    { from: blockId,   to: newBlockId },
    ...(outEdge ? [{ from: newBlockId, to: outEdge.to }] : []),
  ]

  return { nodes: [...graph.nodes, ...newChildNodes, newBlock], edges: newEdges }
}

// ─── Insertion helpers ───────────────────────────────────────────────────────

/**
 * Last top-level node in a timepoint's consecutive group.
 * Returns timepointId itself if no sessions/blocks follow before the next timepoint.
 */
export function lastNodeInTimepointGroup(graph, timepointId) {
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const order   = chainOrder(graph)
  const idx     = order.indexOf(timepointId)
  if (idx === -1) return timepointId
  let last = timepointId
  for (let i = idx + 1; i < order.length; i++) {
    if (nodeMap[order[i]]?.type === 'timepoint') break
    last = order[i]
  }
  return last
}

/**
 * Splice a new node immediately after afterId in the chain.
 * If nodeData includes an `id` field it is used; otherwise a fresh id is generated.
 */
export function insertAfter(graph, afterId, nodeData) {
  const newNode  = { id: newId(), ...nodeData }
  const outEdge  = graph.edges.find(e => e.from === afterId)
  let   newEdges = graph.edges.filter(e => e.from !== afterId)
  newEdges = [...newEdges, { from: afterId, to: newNode.id }]
  if (outEdge) newEdges = [...newEdges, { from: newNode.id, to: outEdge.to }]
  return { nodes: [...graph.nodes, newNode], edges: newEdges }
}

// ─── Full-graph traversal (Phase 2) ──────────────────────────────────────────

/**
 * Visit every node reachable via every randomize arm, and via a
 * counterbalance's block_ids in authored array order. Unlike chainOrder()
 * (single-path, used by the authoring-UI helpers below), this is the one
 * place that needs to see every branch: study_sessions must contain a row
 * for every possible node, since different participants land on different
 * nodes at runtime and the materializer looks sessions up by node_key.
 *
 * A counterbalance's authored block_ids order is a NOMINAL reference
 * ordering for day_number/order_index labeling only — it does not represent
 * any real participant's actual order, which the runtime materializer
 * resolves independently per participant via draw_assignment.
 *
 * Returns { slots, conflicts }. `slots` is one { nodeId, offset, time }
 * record per session node (each visited exactly once). `conflicts` flags
 * nodes reached with disagreeing day offsets from different branches (an
 * unaligned rejoin) — surfaced by validate() as an error.
 */
export function fullTraversal(graph) {
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const entry   = entryNode(graph)

  const slots    = []
  const visited  = new Map() // nodeId -> { offset, time } at first visit
  const conflicts = []

  function markVisit(nodeId, offset, time) {
    const seen = visited.get(nodeId)
    if (seen) {
      if (seen.offset !== offset) conflicts.push({ nodeId, offsets: [seen.offset, offset] })
      return false
    }
    visited.set(nodeId, { offset, time })
    return true
  }

  function emitSession(nodeId, offset, time) {
    if (!markVisit(nodeId, offset, time)) return false
    slots.push({ nodeId, offset, time })
    return true
  }

  function walk(nodeId, offset, time) {
    const node = nodeMap[nodeId]
    if (!node) return

    if (node.type === 'session') {
      if (!emitSession(nodeId, offset, time)) return
      const succ = graph.edges.find(e => e.from === nodeId)?.to
      if (succ) walk(succ, offset, time)
      return
    }

    if (!markVisit(nodeId, offset, time)) return

    if (node.type === 'timepoint') {
      const nextOffset = node.day_offset ?? 0
      const nextTime    = node.time_of_day || time
      const succ = graph.edges.find(e => e.from === nodeId)?.to
      if (succ) walk(succ, nextOffset, nextTime)

    } else if (node.type === 'block') {
      let curOffset = offset
      for (const cid of node.children ?? []) {
        if (nodeMap[cid]) { emitSession(cid, curOffset, time); curOffset += 1 }
      }
      const succ = graph.edges.find(e => e.from === nodeId)?.to
      if (succ) walk(succ, curOffset, time)

    } else if (node.type === 'counterbalance') {
      let curOffset = offset
      for (const bid of node.block_ids ?? []) {
        const block = nodeMap[bid]
        if (!block) continue
        for (const cid of block.children ?? []) {
          if (nodeMap[cid]) { emitSession(cid, curOffset, time); curOffset += 1 }
        }
      }
      const succ = graph.edges.find(e => e.from === nodeId)?.to
      if (succ) walk(succ, curOffset, time)

    } else if (node.type === 'randomize') {
      for (const arm of node.arms ?? []) {
        if (arm.entry && nodeMap[arm.entry]) walk(arm.entry, offset, time)
      }
    }
  }

  if (entry) walk(entry.id, 0, '09:00')

  return { slots, conflicts }
}

// ─── Compile to study_sessions (WP4) ─────────────────────────────────────────

/**
 * Return ordered slot objects, one per session node (including block and
 * counterbalance children). Fed into the study_sessions delete-and-reinsert.
 *
 * day_number = design-time nominal day (offset + 1). For a plain linear
 * graph this reproduces the exact ordering/timing Phase 1 already compiled;
 * forks are additionally visited via fullTraversal() (see its doc comment
 * for the counterbalance-ordering caveat).
 */
export function toSlots(graph) {
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const { slots: raw } = fullTraversal(graph)

  return raw.map((s, i) => {
    const node = nodeMap[s.nodeId]
    return {
      nodeKey:           s.nodeId,
      sessionTemplateId: node?.session_template_id,
      sendTime:          s.time,
      linkExpiresHours:  node?.link_expires_hours ?? 48,
      label:             node?.label ?? '',
      orderIndex:        i,
      dayNumber:         s.offset + 1,
    }
  })
}
