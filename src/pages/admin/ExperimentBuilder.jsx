import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls,
  ReactFlowProvider,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { supabase } from '../../lib/supabase'
import {
  newId, validate, addNode, updateNode, removeNode,
  addSessionToBlock, removeSessionFromBlock, duplicateBlock,
  addArm, removeArm, addArmEntry, addBlockToCounterbalance, removeBlockFromCounterbalance,
  chainOrder, topLevelNodes, entryNode, toSlots, mergeInto,
  findOwningBlock, findOwningCounterbalance,
  insertAfter, lastNodeInTimepointGroup,
} from '../../lib/experimentGraph'
import TimepointNode    from '../../components/study/builder/nodes/TimepointNode'
import SessionNode      from '../../components/study/builder/nodes/SessionNode'
import BlockNode        from '../../components/study/builder/nodes/BlockNode'
import RandomizeNode    from '../../components/study/builder/nodes/RandomizeNode'
import CounterbalanceNode from '../../components/study/builder/nodes/CounterbalanceNode'
import ContactSettingsModal from '../../components/study/builder/ContactSettingsModal'

const NODE_TYPES = {
  timepoint: TimepointNode, session: SessionNode, block: BlockNode,
  randomize: RandomizeNode, counterbalance: CounterbalanceNode,
}

// ─── RF conversion helpers ───────────────────────────────────────────────────

// Camera habits: the canvas should always grow downward as elements are
// added, not rightward, so a narrow (e.g. mobile) viewport stays usable —
// the leftmost column sits at x=0 and only nested content (block sessions,
// counterbalance blocks, randomize arms) indents slightly to the right.
const LAYOUT = {
  INDENT_X: 44,
  ROW_H:    130,
}
const VIEWPORT_MARGIN = 24

function autoLayout(graph) {
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const positions = {}
  const visited = new Set()
  let y = 0

  // The single structural "next" node for plain chain-walking (trunk, or a
  // rejoin's continuation past a merge). Randomize has no single next — its
  // arms fan out explicitly below — so this deliberately returns null there.
  function structuralNext(nodeId) {
    if (nodeMap[nodeId]?.type === 'randomize') return null
    return graph.edges.find(e => e.from === nodeId)?.to ?? null
  }

  // Depth-first placement: every node gets the next Y slot going, in visit
  // order, so nothing ever overlaps and nothing is left at the canvas
  // origin. Depth only controls indentation, never the Y cursor, so nested
  // content (a block's sessions, a counterbalance's blocks, a randomize
  // arm's chain) stacks below its parent instead of spreading beside it.
  function place(nodeId, depth) {
    if (!nodeId || visited.has(nodeId) || !nodeMap[nodeId]) return
    visited.add(nodeId)
    positions[nodeId] = { x: depth * LAYOUT.INDENT_X, y }
    y += LAYOUT.ROW_H

    const node = nodeMap[nodeId]
    if (node.type === 'block') {
      for (const cid of node.children ?? []) place(cid, depth + 1)
    } else if (node.type === 'counterbalance') {
      for (const bid of node.block_ids ?? []) place(bid, depth + 1)
    } else if (node.type === 'randomize') {
      for (const arm of node.arms ?? []) place(arm.entry, depth + 1)
    }

    place(structuralNext(nodeId), depth)
  }

  const entry = entryNode(graph)
  if (entry) place(entry.id, 0)

  // Anything still unreached (a merge target not yet wired, or a node
  // authored while disconnected) gets appended at the end, at the trunk's
  // indentation, rather than defaulting to the origin underneath everything
  // else already there.
  for (const node of topLevelNodes(graph)) place(node.id, 0)

  return positions
}

// Camera habit: pin a given graph point to the viewport's top-left corner
// (a small margin in), instead of React Flow's default fitView (which zooms
// to fit the *whole* graph and re-centers it — fighting a stable anchor and
// shrinking text on a narrow viewport). Zoom is left untouched so a manual
// zoom the user made isn't overridden.
function pinViewport(instance, x, y) {
  if (!instance) return
  const zoom = instance.getZoom()
  instance.setViewport({ x: VIEWPORT_MARGIN - x * zoom, y: VIEWPORT_MARGIN - y * zoom, zoom })
}

function pinViewportTopLeft(instance, nodes) {
  if (!instance || nodes.length === 0) return
  const minX = Math.min(...nodes.map(n => n.position.x))
  const minY = Math.min(...nodes.map(n => n.position.y))
  pinViewport(instance, minX, minY)
}

// Keep the camera on whatever's currently selected — a newly-added node
// auto-selects itself, so this is what makes new elements show up in frame
// instead of landing wherever the layout happened to put them. Falls back
// to the leftmost/topmost node when nothing's selected (e.g. on first load).
function pinViewportToSelection(instance, nodes, selectedId) {
  if (!instance) return
  const node = selectedId ? nodes.find(n => n.id === selectedId) : null
  if (node) pinViewport(instance, node.position.x, node.position.y)
  else pinViewportTopLeft(instance, nodes)
}

// Determine insertion point based on current selection:
//   - timepoint selected → last node in that timepoint's group
//   - session/block selected → that node itself
//   - nothing selected → null (append to tail)
function insertionPoint(graph, selectedId) {
  if (!selectedId) return null
  const node = graph.nodes.find(n => n.id === selectedId)
  if (!node) return null
  return node.type === 'timepoint' ? lastNodeInTimepointGroup(graph, selectedId) : selectedId
}

// Day offset of the nearest preceding timepoint in the chain.
// When afterId is null, returns max existing offset (for tail-append).
function prevTimepointOffset(graph, afterId) {
  if (!afterId) {
    const tps = graph.nodes.filter(n => n.type === 'timepoint')
    return tps.length ? Math.max(...tps.map(t => t.day_offset ?? 0)) : 0
  }
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const order   = chainOrder(graph)
  const idx     = order.indexOf(afterId)
  for (let i = idx; i >= 0; i--) {
    const n = nodeMap[order[i]]
    if (n?.type === 'timepoint') return n.day_offset ?? 0
  }
  return 0
}

// Nodes drawn on canvas: top-level nodes plus every block's own sessions and
// every counterbalance's own blocks, rendered as separate, connected nodes
// (via synthetic containment edges below) rather than listed inline inside
// their parent's card — so owned children are individually selectable and
// the fork structure is visible at a glance.
function renderableNodes(graph) {
  const ids = new Set(topLevelNodes(graph).map(n => n.id))
  for (const n of graph.nodes) {
    if (n.type === 'block') (n.children ?? []).forEach(cid => ids.add(cid))
    if (n.type === 'counterbalance') (n.block_ids ?? []).forEach(bid => ids.add(bid))
  }
  return graph.nodes.filter(n => ids.has(n.id))
}

function graphToRfNodes(graph, positions, selectedId, sessionTemplates, isLocked, callbacks) {
  const renderable  = renderableNodes(graph)
  const auto        = autoLayout(graph)
  const nodeLabels  = Object.fromEntries(graph.nodes.map(n => [n.id, n.label || n.id]))

  return renderable.map(node => ({
    id:       node.id,
    type:     node.type,
    position: positions[node.id] ?? auto[node.id] ?? { x: 0, y: 0 },
    selected: node.id === selectedId,
    data: {
      ...node,
      isLocked,
      sessionTemplates,
      nodeLabels,
      ...(node.type === 'block' ? {
        sessionCount: (node.children ?? []).length,
        onDuplicate:  () => callbacks.duplicateBlock(node.id),
      } : {}),
      ...(node.type === 'randomize' ? {
        onAddArm:        () => callbacks.addArm(node.id),
        onRemoveArm:     (armIndex) => callbacks.removeArm(node.id, armIndex),
        onAddArmSession: (armIndex) => callbacks.addArmEntrySession(node.id, armIndex),
        onAddArmBlock:   (armIndex) => callbacks.addArmEntryBlock(node.id, armIndex),
      } : {}),
      ...(node.type === 'counterbalance' ? {
        blockCount: (node.block_ids ?? []).length,
      } : {}),
    },
  }))
}

function graphToRfEdges(graph) {
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const structural = graph.edges.map(e => {
    const toTimepoint = nodeMap[e.to]?.type === 'timepoint'
    const fromNode = nodeMap[e.from]
    // Edges going TO a timepoint wrap around vertically (source bottom → target top).
    // Edges leaving a randomize node use a distinct handle per arm.
    // All other edges are horizontal (source right → target left).
    let sourceHandle = toTimepoint ? 'b' : 'r'
    if (fromNode?.type === 'randomize') {
      const armIndex = (fromNode.arms ?? []).findIndex(a => a.entry === e.to)
      if (armIndex !== -1) sourceHandle = `arm-${armIndex}`
    }
    return {
      id:           `${e.from}->${e.to}`,
      source:       e.from,
      target:       e.to,
      sourceHandle,
      targetHandle: toTimepoint ? 't' : 'l',
      type:         'smoothstep',
      style:        { stroke: toTimepoint ? 'var(--pkb, rgba(240,104,164,0.35))' : 'var(--bd, rgba(180,100,140,0.20))', strokeWidth: 2 },
      markerEnd:    { type: 'arrowclosed', color: toTimepoint ? 'var(--pk, #f068a4)' : 'var(--gy, #abadb0)' },
    }
  })

  // Synthetic containment edges — block -> its sessions, counterbalance ->
  // its blocks. Visual only: never added to graph.edges, so validate()'s
  // outDegree checks and the materializer's traversal never see them.
  const containment = []
  for (const node of graph.nodes) {
    if (node.type === 'block') {
      for (const cid of node.children ?? []) containment.push({ from: node.id, to: cid, sourceHandle: 'children' })
    }
    if (node.type === 'counterbalance') {
      for (const bid of node.block_ids ?? []) containment.push({ from: node.id, to: bid, sourceHandle: 'blocks' })
    }
  }
  const containmentEdges = containment.map(e => ({
    id:           `${e.from}=>${e.to}`,
    source:       e.from,
    target:       e.to,
    sourceHandle: e.sourceHandle,
    targetHandle: 'l',
    type:         'smoothstep',
    style:        { stroke: 'var(--pk, #f068a4)', strokeWidth: 1.5, strokeDasharray: '4 3' },
    markerEnd:    { type: 'arrowclosed', color: 'var(--pk, #f068a4)' },
  }))

  return [...structural, ...containmentEdges]
}

// ─── Compile study_sessions (WP4) ────────────────────────────────────────────

async function compileStudySessions(studyId, graph) {
  const slots = toSlots(graph)

  const { error: delErr } = await supabase
    .from('study_sessions')
    .delete()
    .eq('study_id', studyId)
  if (delErr) throw delErr

  if (!slots.length) return

  const rows = slots.map(s => ({
    study_id:            studyId,
    node_key:            s.nodeKey,
    session_template_id: s.sessionTemplateId,
    send_time:           s.sendTime,
    link_expires_hours:  s.linkExpiresHours,
    label:               s.label,
    order_index:         s.orderIndex,
    day_number:          s.dayNumber,
  }))

  const { error: insErr } = await supabase.from('study_sessions').insert(rows)
  if (insErr) throw insErr
}

// ─── Edit panel ──────────────────────────────────────────────────────────────

function EditPanel({ nodeId, graph, sessionTemplates, isLocked, onChange, onRemove, onMerge }) {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return null

  function field(label, children) {
    return (
      <div style={P.fieldGroup}>
        <label style={P.label}>{label}</label>
        {children}
      </div>
    )
  }

  const input = (value, key, type = 'text', extra = {}) => (
    <input
      type={type}
      style={P.input}
      value={value ?? ''}
      disabled={isLocked}
      onChange={e => onChange(nodeId, { [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
      {...extra}
    />
  )

  return (
    <div style={P.panel}>
      <div style={P.panelTitle}>{node.type.toUpperCase()}</div>

      {field('Label', input(node.label, 'label'))}

      {node.type === 'timepoint' && (
        <>
          {field('Day offset (0 = Day 1)',
            <input
              type="number" min="0" style={P.input}
              value={node.day_offset ?? 0}
              disabled={isLocked || node.day_offset === 0}
              onChange={e => onChange(nodeId, { day_offset: Number(e.target.value) })}
            />
          )}
          {field('Send time (HH:MM, blank = inherit baseline)',
            <input
              type="time" style={P.input}
              value={node.time_of_day ?? ''}
              disabled={isLocked}
              onChange={e => onChange(nodeId, { time_of_day: e.target.value || null })}
            />
          )}
        </>
      )}

      {node.type === 'session' && (
        <>
          {field('Session template',
            <select
              style={P.input}
              value={node.session_template_id ?? ''}
              disabled={isLocked}
              onChange={e => onChange(nodeId, { session_template_id: e.target.value || null })}
            >
              <option value="">— select —</option>
              {sessionTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          )}
          {field('Link expires (hours)', input(node.link_expires_hours, 'link_expires_hours', 'number', { min: 1 }))}
        </>
      )}

      {node.type === 'block' && (
        <div style={{ fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: 'var(--tx2)', marginTop: 4 }}>
          {(node.children ?? []).length} session{(node.children ?? []).length !== 1 ? 's' : ''} — shown as connected nodes on the canvas. Select this block, then use the toolbar to add another.
        </div>
      )}

      {node.type === 'randomize' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(node.arms ?? []).map((arm, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                {field(`Arm ${i + 1} group`,
                  <input
                    style={P.input}
                    value={arm.group ?? ''}
                    disabled={isLocked}
                    onChange={e => onChange(nodeId, {
                      arms: node.arms.map((a, j) => j === i ? { ...a, group: e.target.value } : a),
                    })}
                  />
                )}
              </div>
              <div style={{ width: 64 }}>
                {field('Weight',
                  <input
                    type="number" min="1" style={P.input}
                    value={arm.weight ?? 1}
                    disabled={isLocked}
                    onChange={e => onChange(nodeId, {
                      arms: node.arms.map((a, j) => j === i ? { ...a, weight: Number(e.target.value) } : a),
                    })}
                  />
                )}
              </div>
            </div>
          ))}
          <div style={{ fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 12, color: 'var(--tx2)' }}>
            Add/remove arms and wire their entry sessions on the canvas node.
          </div>
        </div>
      )}

      {node.type === 'counterbalance' && (
        <div style={{ fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: 'var(--tx2)', marginTop: 4 }}>
          {(node.block_ids ?? []).length} block{(node.block_ids ?? []).length !== 1 ? 's' : ''} — shown as connected nodes on the canvas. Select this counterbalance, then use the toolbar to add another.
        </div>
      )}

      {!isLocked && (() => {
        // A dead-end node (no outgoing structural edge) — e.g. a randomize
        // arm's tail, or a fork branch authored without a continuation — can
        // be explicitly merged into any other top-level node to reconverge.
        // Block/counterbalance-owned children aren't part of the trunk, so
        // merging doesn't apply to them.
        if (findOwningBlock(graph, nodeId) || findOwningCounterbalance(graph, nodeId)) return null
        if (graph.edges.some(e => e.from === nodeId)) return null
        const targets = topLevelNodes(graph).filter(n => n.id !== nodeId)
        if (!targets.length) return null
        return field('Merge into',
          <select
            style={P.input}
            value=""
            onChange={e => { if (e.target.value) onMerge(nodeId, e.target.value) }}
          >
            <option value="">— pick a node to reconverge into —</option>
            {targets.map(t => (
              <option key={t.id} value={t.id}>{t.label || t.id}</option>
            ))}
          </select>
        )
      })()}

      {!isLocked && node.day_offset !== 0 && (
        <button
          style={P.removeBtn}
          onClick={() => onRemove(nodeId)}
        >
          Remove node
        </button>
      )}
    </div>
  )
}

const P = {
  panel:      { padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' },
  panelTitle: { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--pkd)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:      { fontSize: 13, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 7, padding: '6px 10px', color: 'var(--tx)', background: '#fff', width: '100%', boxSizing: 'border-box' },
  removeBtn:  { marginTop: 8, background: 'none', border: '1px solid #fcc', borderRadius: 7, padding: '6px 12px', fontSize: 13, color: '#e04', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExperimentBuilder() {
  const { id } = useParams()
  const navigate  = useNavigate()
  const qc        = useQueryClient()

  const [study,          setStudy]         = useState(null)
  const [loading,        setLoading]       = useState(true)
  const [graph,          setGraph]         = useState({ nodes: [], edges: [] })
  const [positions,      setPositions]     = useState({})
  const [selectedId,     setSelectedId]    = useState(null)
  const [hasEnrollments, setHasEnrollments]= useState(false)
  const [saving,         setSaving]        = useState(false)
  const [saveError,      setSaveError]     = useState(null)
  const [validation,     setValidation]    = useState(null)
  const [studyName,      setStudyName]     = useState('')
  const [showContact,    setShowContact]   = useState(false)
  const rfInstanceRef = useRef(null)

  const { data: sessionTemplates = [] } = useQuery({
    queryKey: ['session-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_templates')
        .select('id, label')
        .order('label')
      if (error) throw error
      return data
    },
  })

  // Load study and graph
  useEffect(() => {
    if (!id) return
    async function load() {
      const [studyRes, enrollRes] = await Promise.all([
        supabase.from('studies')
          .select('id, name, active, design_graph, design_version')
          .eq('id', id)
          .single(),
        supabase.from('study_enrollments')
          .select('id')
          .eq('study_id', id)
          .limit(1),
      ])
      if (studyRes.error) { setLoading(false); return }

      const s = studyRes.data
      setStudy(s)
      setStudyName(s.name ?? '')
      setHasEnrollments((enrollRes.data?.length ?? 0) > 0)

      if (s.design_graph) {
        const { _positions, ...graphData } = s.design_graph
        setGraph(graphData)
        if (_positions) setPositions(_positions)
      } else {
        // Bootstrap with a baseline timepoint
        const baseId = `t${newId()}`
        setGraph({
          nodes: [{ id: baseId, type: 'timepoint', day_offset: 0, time_of_day: null, label: 'Baseline' }],
          edges: [],
        })
      }
      setLoading(false)
    }
    load()
  }, [id])

  // Mutate graph (all structural edits go through here).
  // Pass { resetLayout: true } for add/insert/remove — clears manual positions
  // so the auto-layout always looks correct after structural changes.
  const mutate = useCallback((fn, { resetLayout = false } = {}) => {
    if (hasEnrollments) return
    setGraph(g => {
      const next = fn(g)
      setValidation(validate(next))
      return next
    })
    if (resetLayout) setPositions({})
  }, [hasEnrollments])

  // Graph mutation callbacks
  const callbacks = useMemo(() => ({
    addSessionToBlock: (blockId) => {
      const nid = newId()
      mutate(g => addSessionToBlock(g, blockId, { id: nid }), { resetLayout: true })
      setSelectedId(nid)
    },
    duplicateBlock: (blockId) =>
      mutate(g => duplicateBlock(g, blockId), { resetLayout: true }),
    addArm: (randomizeId) =>
      mutate(g => addArm(g, randomizeId), { resetLayout: true }),
    removeArm: (randomizeId, armIndex) =>
      mutate(g => removeArm(g, randomizeId, armIndex), { resetLayout: true }),
    addArmEntrySession: (randomizeId, armIndex) =>
      mutate(g => addArmEntry(g, randomizeId, armIndex, {
        type: 'session', session_template_id: null, link_expires_hours: 48, label: 'New Session',
      }), { resetLayout: true }),
    addArmEntryBlock: (randomizeId, armIndex) => {
      const childId = newId()
      mutate(g => {
        const withChild = {
          ...g,
          nodes: [...g.nodes, { id: childId, type: 'session', session_template_id: null, link_expires_hours: 48, label: 'Session 1' }],
        }
        return addArmEntry(withChild, randomizeId, armIndex, { type: 'block', label: 'New Block', children: [childId] })
      }, { resetLayout: true })
    },
    addBlockToCounterbalance: (counterbalanceId) => {
      const nid = newId()
      mutate(g => addBlockToCounterbalance(g, counterbalanceId, nid), { resetLayout: true })
      setSelectedId(nid)
    },
  }), [mutate])

  // Derive RF nodes/edges
  const rfNodes = useMemo(
    () => graphToRfNodes(graph, positions, selectedId, sessionTemplates, hasEnrollments, callbacks),
    [graph, positions, selectedId, sessionTemplates, hasEnrollments, callbacks]
  )
  const rfEdges = useMemo(() => graphToRfEdges(graph), [graph])

  // Camera habit: keep the selected node pinned at the top-left, so adding a
  // new element (which auto-selects itself) or clicking another node always
  // brings the focus into frame — re-pin whenever the selection or the set
  // of rendered nodes changes, not on every render (a drag or a label edit
  // shouldn't yank the camera out from under the user).
  const nodeIdsKey = useMemo(() => rfNodes.map(n => n.id).sort().join('|'), [rfNodes])
  useEffect(() => {
    pinViewportToSelection(rfInstanceRef.current, rfNodes, selectedId)
    // Deliberately keyed on selectedId/nodeIdsKey (not rfNodes/positions),
    // so dragging or editing a label doesn't move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nodeIdsKey])

  function handleRfInit(instance) {
    rfInstanceRef.current = instance
    pinViewportToSelection(instance, rfNodes, selectedId)
  }

  // Only sync position changes from RF
  function handleNodesChange(changes) {
    const updates = {}
    for (const c of changes) {
      if (c.type === 'position' && c.position) updates[c.id] = c.position
    }
    if (Object.keys(updates).length) setPositions(p => ({ ...p, ...updates }))
  }

  function handleNodeClick(_, rfNode) { setSelectedId(rfNode.id) }
  function handlePaneClick()          { setSelectedId(null) }

  // Toolbar actions — insertion point is context-sensitive based on selectedId:
  //   session/block selected → insert right after it
  //   timepoint selected     → session goes at end of that timepoint's group;
  //                            timepoint goes after the whole group
  //   nothing selected       → append to end of chain

  function handleAddTimepoint() {
    const nid = newId()
    mutate(g => {
      const after  = insertionPoint(g, selectedId)
      const offset = prevTimepointOffset(g, after) + 7
      const data   = { id: nid, type: 'timepoint', day_offset: offset, time_of_day: null, label: `Day ${offset + 1}` }
      return after ? insertAfter(g, after, data) : addNode(g, data)
    }, { resetLayout: true })
    setSelectedId(nid)
  }

  function handleAddSession() {
    const nid = newId()
    mutate(g => {
      const after = insertionPoint(g, selectedId)
      const data  = { id: nid, type: 'session', session_template_id: null, link_expires_hours: 48, label: 'New Session' }
      return after ? insertAfter(g, after, data) : addNode(g, data)
    }, { resetLayout: true })
    setSelectedId(nid)
  }

  function handleAddBlock() {
    const nid = newId()
    mutate(g => {
      const after   = insertionPoint(g, selectedId)
      const childId = newId()
      const withChild = { ...g, nodes: [...g.nodes, { id: childId, type: 'session', session_template_id: null, link_expires_hours: 48, label: 'Session 1' }] }
      const data    = { id: nid, type: 'block', label: 'New Block', children: [childId] }
      return after ? insertAfter(withChild, after, data) : addNode(withChild, data)
    }, { resetLayout: true })
    setSelectedId(nid)
  }

  function handleAddRandomize() {
    const nid = newId()
    mutate(g => {
      const after = insertionPoint(g, selectedId)
      const data = {
        id: nid, type: 'randomize', label: 'New Randomize',
        arms: [{ group: '', weight: 1, entry: null }, { group: '', weight: 1, entry: null }],
      }
      return after ? insertAfter(g, after, data) : addNode(g, data)
    }, { resetLayout: true })
    setSelectedId(nid)
  }

  function handleAddCounterbalance() {
    const nid = newId()
    mutate(g => {
      const after = insertionPoint(g, selectedId)
      const data = { id: nid, type: 'counterbalance', label: 'New Counterbalance', block_ids: [] }
      return after ? insertAfter(g, after, data) : addNode(g, data)
    }, { resetLayout: true })
    setSelectedId(nid)
  }

  // A Block/Counterbalance owns its children via an array (block.children /
  // counterbalance.block_ids), not a structural edge — so adding a session or
  // block "into" the currently-selected control element is a distinct action
  // from the trunk-insertion helpers above.
  function handleAddSessionToBlock() {
    if (selectedId) callbacks.addSessionToBlock(selectedId)
  }

  function handleAddBlockToCounterbalance() {
    if (selectedId) callbacks.addBlockToCounterbalance(selectedId)
  }

  function handleMergeInto(fromId, toId) {
    mutate(g => mergeInto(g, fromId, toId), { resetLayout: true })
  }

  function handleNodeEdit(nodeId, updates) {
    mutate(g => updateNode(g, nodeId, updates))
  }

  function handleNodeRemove(nodeId) {
    // A block-owned session or counterbalance-owned block is removed from
    // its owner's array, not spliced out of the structural chain.
    const owningBlock = findOwningBlock(graph, nodeId)
    const owningCounterbalance = findOwningCounterbalance(graph, nodeId)
    if (owningBlock) {
      mutate(g => removeSessionFromBlock(g, owningBlock.id, nodeId), { resetLayout: true })
    } else if (owningCounterbalance) {
      mutate(g => removeBlockFromCounterbalance(g, owningCounterbalance.id, nodeId), { resetLayout: true })
    } else {
      mutate(g => removeNode(g, nodeId), { resetLayout: true })
    }
    setSelectedId(null)
  }

  // Save
  async function handleSave() {
    const v = validate(graph)
    setValidation(v)
    if (!v.valid) return

    setSaving(true)
    setSaveError(null)
    try {
      // Persist study name if changed
      const payload = {
        name:           studyName.trim() || study.name,
        design_graph:   { ...graph, _positions: positions },
        design_version: (study.design_version ?? 0) + 1,
      }

      const { error: updateErr } = await supabase
        .from('studies')
        .update(payload)
        .eq('id', id)
      if (updateErr) throw updateErr

      // Compile graph → study_sessions (WP4)
      if (!hasEnrollments) await compileStudySessions(id, graph)

      setStudy(s => ({ ...s, ...payload }))
      qc.invalidateQueries({ queryKey: ['study-detail', id] })
      qc.invalidateQueries({ queryKey: ['studies-list'] })
      setValidation({ valid: true, errors: [], saved: true })
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={S.muted}>Loading…</p>
  if (!study)  return <p style={S.muted}>Study not found.</p>

  const canSave = !saving && !hasEnrollments
  const v = validation

  return (
    <ReactFlowProvider>
      <div style={S.page}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <Link to={`/admin/studies/${id}`} style={S.backLink}>← Study detail</Link>
            <input
              style={S.nameInput}
              value={studyName}
              onChange={e => setStudyName(e.target.value)}
              placeholder="Study name"
            />
          </div>
          <div style={S.headerRight}>
            <Link to={`/admin/studies/${id}/balance`} style={S.balanceLink}>
              Balance audit
            </Link>
            <button style={S.contactBtn} onClick={() => setShowContact(true)}>
              Contact settings
            </button>
            {hasEnrollments && (
              <span style={S.lockedBadge}>Locked — participants enrolled</span>
            )}
            {v && !v.valid && (
              <span style={S.errBadge}>{v.errors.length} error{v.errors.length !== 1 ? 's' : ''}</span>
            )}
            {v?.saved && <span style={S.savedBadge}>Saved</span>}
            <button
              style={{ ...S.btnPrimary, opacity: canSave ? 1 : 0.5 }}
              onClick={handleSave}
              disabled={!canSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {saveError && <div style={S.saveError}>{saveError}</div>}

        {v && !v.valid && (
          <div style={S.errorList}>
            {v.errors.map((e, i) => <div key={i} style={S.errorItem}>• {e}</div>)}
          </div>
        )}

        {/* Toolbar */}
        {!hasEnrollments && (
          <div style={S.toolbar}>
            {(() => {
              const selNode = selectedId ? graph.nodes.find(n => n.id === selectedId) : null

              // Toolbar is context-sensitive to whichever node is selected,
              // not always anchored to a Timepoint: a Block/Counterbalance
              // controls its own children, so selecting one exposes only the
              // action(s) that add into it.
              if (selNode?.type === 'block') {
                return (
                  <>
                    <span style={S.toolbarLabel}>Into "{selNode.label || 'block'}":</span>
                    <button style={S.toolBtn} onClick={handleAddSessionToBlock}>● Session</button>
                  </>
                )
              }
              if (selNode?.type === 'counterbalance') {
                return (
                  <>
                    <span style={S.toolbarLabel}>Into "{selNode.label || 'counterbalance'}":</span>
                    <button style={S.toolBtn} onClick={handleAddBlockToCounterbalance}>▦ Block</button>
                  </>
                )
              }

              const isTimepoint = selNode?.type === 'timepoint'
              const hint = isTimepoint
                ? `Into "${selNode.label || 'timepoint'}":`
                : 'Inserting at end:'
              return (
                <>
                  <span style={S.toolbarLabel}>{hint}</span>
                  <button style={S.toolBtn} onClick={handleAddTimepoint}>⬡ Timepoint</button>
                  {isTimepoint && (
                    <>
                      <button style={S.toolBtn} onClick={handleAddSession}>● Session</button>
                      <button style={S.toolBtn} onClick={handleAddBlock}>▦ Block</button>
                      <button style={S.toolBtn} onClick={handleAddRandomize}>⑂ Randomize</button>
                      <button style={S.toolBtn} onClick={handleAddCounterbalance}>⇄ Counterbalance</button>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* Canvas + panel */}
        <div style={S.canvasRow}>
          <div style={S.canvas}>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={NODE_TYPES}
              onNodesChange={handleNodesChange}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              nodesConnectable={false}
              onInit={handleRfInit}
              defaultViewport={{ x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN, zoom: 1 }}
              deleteKeyCode={null}
            >
              <Background color="var(--bd)" gap={20} />
              <Controls />
            </ReactFlow>
          </div>

          {selectedId && (
            <div style={S.panel}>
              <EditPanel
                nodeId={selectedId}
                graph={graph}
                sessionTemplates={sessionTemplates}
                isLocked={hasEnrollments}
                onChange={handleNodeEdit}
                onRemove={handleNodeRemove}
                onMerge={handleMergeInto}
              />
            </div>
          )}
        </div>

        {showContact && (
          <ContactSettingsModal studyId={id} onClose={() => setShowContact(false)} />
        )}
      </div>
    </ReactFlowProvider>
  )
}

const S = {
  page:        { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', flexWrap: 'wrap', flexShrink: 0 },
  headerLeft:  { display: 'flex', flexDirection: 'column', gap: 4 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  backLink:    { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none' },
  nameInput:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 22, fontWeight: 400, color: 'var(--tx)', border: 'none', outline: 'none', background: 'transparent', padding: 0, minWidth: 240 },
  lockedBadge: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--gy)', background: '#f5f5f5', borderRadius: 6, padding: '3px 8px' },
  errBadge:    { fontFamily: '"Space Mono",monospace', fontSize: 11, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 6, padding: '3px 8px' },
  contactBtn:  { background: '#fff', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  balanceLink: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif' },
  savedBadge:  { fontFamily: '"Space Mono",monospace', fontSize: 11, color: '#2d9e5f', background: '#f0faf4', border: '1px solid #a8e6c3', borderRadius: 6, padding: '3px 8px' },
  btnPrimary:  { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  saveError:   { background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#e04', marginBottom: 8, flexShrink: 0 },
  errorList:   { background: '#fff8f0', border: '1px solid #fde', borderRadius: 8, padding: '8px 14px', marginBottom: 8, flexShrink: 0 },
  errorItem:   { fontSize: 13, color: '#c04a82', fontFamily: '"DM Sans",system-ui,sans-serif', lineHeight: 1.6 },
  toolbar:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)', flexShrink: 0 },
  toolbarLabel:{ fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 },
  toolBtn:     { background: '#fff', border: '1px solid var(--bd)', borderRadius: 7, padding: '5px 12px', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  canvasRow:   { display: 'flex', flex: 1, gap: 0, overflow: 'hidden', minHeight: 0 },
  canvas:      { flex: 1, minWidth: 0, position: 'relative' },
  panel:       { width: 280, borderLeft: '1px solid var(--bd)', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  muted:       { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx3)', padding: 24 },
}
