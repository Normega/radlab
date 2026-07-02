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

/** Top-level nodes (not block children). */
export function topLevelNodes(graph) {
  const children = blockChildIds(graph)
  return graph.nodes.filter(n => !children.has(n.id))
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

export function validate(graph) {
  const errors = []
  if (!graph.nodes.length) return { valid: false, errors: ['Graph is empty.'] }

  const topLevel = topLevelNodes(graph)
  const nodeIds  = new Set(graph.nodes.map(n => n.id))
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
  }

  for (const e of graph.edges) {
    if (!nodeIds.has(e.from)) errors.push(`Edge references missing node "${e.from}".`)
    if (!nodeIds.has(e.to))   errors.push(`Edge references missing node "${e.to}".`)
  }

  const outDegree = {}
  for (const e of graph.edges) {
    outDegree[e.from] = (outDegree[e.from] ?? 0) + 1
    if (outDegree[e.from] > 1)
      errors.push(`Node "${e.from}" has more than one outgoing edge (Phase 1 is linear only).`)
  }

  return { valid: errors.length === 0, errors }
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

// ─── Compile to study_sessions (WP4) ─────────────────────────────────────────

/**
 * Walk the graph and return ordered slot objects, one per session node
 * (including block children). Fed into the study_sessions delete-and-reinsert.
 *
 * day_number = design-time nominal day (day_offset + 1 for direct sessions;
 * day_offset + i + 1 for block children, where i is 0-based child position).
 */
export function toSlots(graph) {
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const order   = chainOrder(graph)

  const slots       = []
  let orderIndex    = 0
  let currentOffset = 0
  let currentTime   = '09:00'

  for (const nodeId of order) {
    const node = nodeMap[nodeId]
    if (!node) continue

    if (node.type === 'timepoint') {
      currentOffset = node.day_offset ?? 0
      if (node.time_of_day) currentTime = node.time_of_day

    } else if (node.type === 'session') {
      slots.push({
        nodeKey:           node.id,
        sessionTemplateId: node.session_template_id,
        sendTime:          currentTime,
        linkExpiresHours:  node.link_expires_hours ?? 48,
        label:             node.label ?? '',
        orderIndex:        orderIndex++,
        dayNumber:         currentOffset + 1,
      })

    } else if (node.type === 'block') {
      const children = (node.children ?? []).map(cid => nodeMap[cid]).filter(Boolean)
      children.forEach((child, i) => {
        slots.push({
          nodeKey:           child.id,
          sessionTemplateId: child.session_template_id,
          sendTime:          currentTime,
          linkExpiresHours:  child.link_expires_hours ?? 48,
          label:             child.label ?? '',
          orderIndex:        orderIndex++,
          dayNumber:         currentOffset + i + 1,
        })
      })
    }
  }

  return slots
}
