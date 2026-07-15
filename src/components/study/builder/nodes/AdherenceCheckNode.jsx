import { Handle, Position } from '@xyflow/react'

export default function AdherenceCheckNode({ data, selected }) {
  const phaseLabel = data.phase === 'phase2' ? 'Phase 2' : data.phase === 'phase1' ? 'Phase 1' : '(no phase)'
  const minRequired = data.min_required ?? 10
  const ofTotal = data.of_total ?? 12

  return (
    <div style={{ ...S.node, ...(selected ? S.selected : {}) }}>
      {/* Horizontal connections — structurally a single-successor node, like Session */}
      <Handle id="l" type="target" position={Position.Left}   style={S.handle} />
      <Handle id="r" type="source" position={Position.Right}  style={S.handle} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ ...S.handle, opacity: 0 }} />
      <Handle id="t" type="target" position={Position.Top}    style={{ ...S.handle, opacity: 0 }} />

      <div style={S.chip}>⛔ Adherence Check</div>
      <div style={S.label}>{data.label || 'Untitled'}</div>
      <div style={{ ...S.meta, color: data.phase ? 'var(--tx2)' : '#e04' }}>{phaseLabel}</div>
      <div style={S.meta}>Requires ≥ {minRequired} of {ofTotal} sessions completed</div>
      <div style={S.warn}>Fails → participant withdrawn + termination email</div>

      {data.isLocked && <div style={S.lockBadge}>locked</div>}
    </div>
  )
}

const S = {
  node: {
    background: '#fffaf0',
    border: '2px solid #e0b060',
    borderRadius: 10,
    padding: '12px 16px',
    minWidth: 240,
    maxWidth: 290,
    boxShadow: '0 1px 4px rgba(180,100,140,0.08)',
    position: 'relative',
  },
  selected: {
    borderColor: '#c07a20',
    boxShadow: '0 0 0 3px rgba(224,176,96,0.25)',
  },
  chip: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    color: '#a15c00',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  label: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 16,
    fontWeight: 400,
    color: 'var(--tx, #1c1c1e)',
    marginBottom: 4,
  },
  meta: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    color: 'var(--tx2, #6b6c70)',
    marginTop: 2,
  },
  warn: {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 10.5,
    color: '#a15c00',
    marginTop: 6,
    lineHeight: 1.4,
  },
  lockBadge: {
    position: 'absolute',
    top: 8, right: 10,
    fontFamily: '"Space Mono", monospace',
    fontSize: 9,
    color: 'var(--gy, #abadb0)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  handle: {
    background: '#e0b060',
    border: 'none',
    width: 10,
    height: 10,
  },
}
