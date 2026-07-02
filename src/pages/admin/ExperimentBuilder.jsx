import { useState, useEffect, useMemo, useCallback } from 'react'
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
  chainOrder, blockChildIds, topLevelNodes, toSlots,
} from '../../lib/experimentGraph'
import TimepointNode    from '../../components/study/builder/nodes/TimepointNode'
import SessionNode      from '../../components/study/builder/nodes/SessionNode'
import BlockNode        from '../../components/study/builder/nodes/BlockNode'

const NODE_TYPES = { timepoint: TimepointNode, session: SessionNode, block: BlockNode }

// ─── RF conversion helpers ───────────────────────────────────────────────────

const NODE_GAP     = 120
const BLOCK_CHILD_H = 38
const BLOCK_HEADER_H = 90

function autoLayout(graph) {
  const nodeMap  = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const order    = chainOrder(graph)
  const positions = {}
  let y = 0
  for (const id of order) {
    positions[id] = { x: 0, y }
    const node = nodeMap[id]
    if (node?.type === 'block') {
      y += BLOCK_HEADER_H + (node.children?.length ?? 0) * BLOCK_CHILD_H + NODE_GAP
    } else {
      y += NODE_GAP
    }
  }
  return positions
}

function graphToRfNodes(graph, positions, selectedId, sessionTemplates, isLocked, callbacks) {
  const nodeMap  = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const childIds = blockChildIds(graph)
  const topLevel = graph.nodes.filter(n => !childIds.has(n.id))
  const auto     = autoLayout(graph)

  return topLevel.map(node => ({
    id:       node.id,
    type:     node.type,
    position: positions[node.id] ?? auto[node.id] ?? { x: 0, y: 0 },
    selected: node.id === selectedId,
    data: {
      ...node,
      isLocked,
      sessionTemplates,
      // For blocks: resolve child node objects
      ...(node.type === 'block' ? {
        children: (node.children ?? []).map(cid => nodeMap[cid]).filter(Boolean),
        onAddSession:    () => callbacks.addSessionToBlock(node.id),
        onRemoveSession: (sessionId) => callbacks.removeSessionFromBlock(node.id, sessionId),
        onDuplicate:     () => callbacks.duplicateBlock(node.id),
      } : {}),
    },
  }))
}

function graphToRfEdges(graph) {
  return graph.edges.map(e => ({
    id:     `${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    type:   'smoothstep',
    style:  { stroke: '#f068a4', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#f068a4' },
  }))
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

function EditPanel({ nodeId, graph, sessionTemplates, isLocked, onChange, onRemove }) {
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
          {(node.children ?? []).length} session{(node.children ?? []).length !== 1 ? 's' : ''} — edit sessions via the canvas node.
        </div>
      )}

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

  // Mutate graph (all structural edits go through here)
  const mutate = useCallback((fn) => {
    if (hasEnrollments) return
    setGraph(g => {
      const next = fn(g)
      setValidation(validate(next))
      return next
    })
  }, [hasEnrollments])

  // Graph mutation callbacks
  const callbacks = useMemo(() => ({
    addSessionToBlock: (blockId) =>
      mutate(g => addSessionToBlock(g, blockId)),
    removeSessionFromBlock: (blockId, sessionId) =>
      mutate(g => removeSessionFromBlock(g, blockId, sessionId)),
    duplicateBlock: (blockId) =>
      mutate(g => duplicateBlock(g, blockId)),
  }), [mutate])

  // Derive RF nodes/edges
  const rfNodes = useMemo(
    () => graphToRfNodes(graph, positions, selectedId, sessionTemplates, hasEnrollments, callbacks),
    [graph, positions, selectedId, sessionTemplates, hasEnrollments, callbacks]
  )
  const rfEdges = useMemo(() => graphToRfEdges(graph), [graph])

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

  // Toolbar actions
  function nextDayOffset() {
    const tps = graph.nodes.filter(n => n.type === 'timepoint')
    return tps.length ? Math.max(...tps.map(t => t.day_offset)) + 7 : 0
  }

  function handleAddTimepoint() {
    const offset = nextDayOffset()
    mutate(g => addNode(g, { type: 'timepoint', day_offset: offset, time_of_day: null, label: `Day ${offset + 1}` }))
  }

  function handleAddSession() {
    mutate(g => addNode(g, { type: 'session', session_template_id: null, link_expires_hours: 48, label: 'New Session' }))
  }

  function handleAddBlock() {
    mutate(g => {
      const childId = newId()
      const withChild = { ...g, nodes: [...g.nodes, { id: childId, type: 'session', session_template_id: null, link_expires_hours: 48, label: 'Session 1' }] }
      return addNode(withChild, { type: 'block', label: 'New Block', children: [childId] })
    })
  }

  function handleNodeEdit(nodeId, updates) {
    mutate(g => updateNode(g, nodeId, updates))
  }

  function handleNodeRemove(nodeId) {
    mutate(g => removeNode(g, nodeId))
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
            <span style={S.toolbarLabel}>Add to end of chain:</span>
            <button style={S.toolBtn} onClick={handleAddTimepoint}>⬡ Timepoint</button>
            <button style={S.toolBtn} onClick={handleAddSession}>● Session</button>
            <button style={S.toolBtn} onClick={handleAddBlock}>▦ Block</button>
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
              fitView
              fitViewOptions={{ padding: 0.3 }}
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
              />
            </div>
          )}
        </div>
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
