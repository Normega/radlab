import { Handle, Position } from '@xyflow/react'

export default function TimepointNode({ data, selected }) {
  const dayLabel = data.day_offset === 0 ? 'Day 1 (baseline)' : `Day ${data.day_offset + 1}`
  const timeLabel = data.time_of_day ?? 'inherit baseline'

  return (
    <div style={{ ...S.node, ...(selected ? S.selected : {}) }}>
      {/* Vertical spine connections */}
      <Handle id="t" type="target" position={Position.Top}    style={S.handle} />
      <Handle id="b" type="source" position={Position.Bottom} style={S.handle} />
      {/* Horizontal session connections */}
      <Handle id="r" type="source" position={Position.Right}  style={S.handle} />
      {/* Left hidden — timepoints don't receive horizontal edges */}
      <Handle id="l" type="target" position={Position.Left}   style={{ ...S.handle, opacity: 0 }} />

      <div style={S.chip}>⬡ Timepoint</div>
      <div style={S.label}>{data.label || 'Untitled'}</div>
      <div style={S.meta}>{dayLabel} · {timeLabel}</div>

      {data.isLocked && <div style={S.lockBadge}>locked</div>}
    </div>
  )
}

const S = {
  node: {
    background: '#fff',
    border: '2px solid var(--pkb, rgba(240,104,164,0.35))',
    borderRadius: 10,
    padding: '12px 16px',
    minWidth: 230,
    maxWidth: 280,
    boxShadow: '0 1px 4px rgba(180,100,140,0.10)',
    position: 'relative',
  },
  selected: {
    borderColor: 'var(--pk, #f068a4)',
    boxShadow: '0 0 0 3px rgba(240,104,164,0.18)',
  },
  chip: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    color: 'var(--pkd, #c04a82)',
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
    background: 'var(--pk, #f068a4)',
    border: 'none',
    width: 10,
    height: 10,
  },
}
