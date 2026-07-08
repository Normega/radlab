import { Handle, Position } from '@xyflow/react'

export default function CounterbalanceNode({ data, selected }) {
  const blocks = data.blocks ?? []

  return (
    <div style={{ ...S.node, ...(selected ? S.selected : {}) }}>
      {/* Horizontal connections — single in/out, like a plain Block */}
      <Handle id="l" type="target" position={Position.Left}   style={S.handle} />
      <Handle id="r" type="source" position={Position.Right}  style={S.handle} />
      {/* Bottom for wrap-around; hidden visually */}
      <Handle id="b" type="source" position={Position.Bottom} style={{ ...S.handle, opacity: 0 }} />
      <Handle id="t" type="target" position={Position.Top}    style={{ ...S.handle, opacity: 0 }} />

      <div style={S.chip}>⇄ Counterbalance</div>
      <div style={S.label}>{data.label || 'Untitled'}</div>
      <div style={S.caption}>Order randomized · within-block order fixed</div>

      {blocks.length === 0 && (
        <div style={{ ...S.blockRow, color: '#e04', fontStyle: 'italic' }}>No blocks — add at least 2</div>
      )}

      {blocks.map(block => (
        <div key={block.id} style={S.blockRow}>
          <span style={S.blockName}>{block.label || 'Untitled Block'}</span>
          <span style={S.blockCount}>
            {(block.children ?? []).length} session{(block.children ?? []).length !== 1 ? 's' : ''}
          </span>
          {!data.isLocked && (
            <button
              style={S.removeBtn}
              onClick={e => { e.stopPropagation(); data.onRemoveBlock?.(block.id) }}
              title="Remove block"
            >×</button>
          )}
        </div>
      ))}

      {!data.isLocked && (
        <button
          style={S.addBtn}
          onClick={e => { e.stopPropagation(); data.onAddBlock?.() }}
        >
          + Add block
        </button>
      )}

      {data.isLocked && <div style={S.lockBadge}>locked</div>}
    </div>
  )
}

const S = {
  node: {
    background: '#fdf2f8',
    border: '2px dashed var(--pkb, rgba(240,104,164,0.35))',
    borderRadius: 10,
    padding: '12px 16px',
    minWidth: 250,
    maxWidth: 300,
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
  caption: {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 11,
    color: 'var(--tx3, #a8a9ad)',
    marginBottom: 8,
  },
  blockRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    borderTop: '1px solid rgba(240,104,164,0.12)',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 12,
    color: 'var(--tx2, #6b6c70)',
  },
  blockName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  blockCount: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    color: 'var(--tx3, #a8a9ad)',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--gy, #abadb0)',
    fontSize: 15,
    lineHeight: 1,
    padding: '0 2px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  addBtn: {
    marginTop: 8,
    background: 'none',
    border: '1px dashed var(--pkb, rgba(240,104,164,0.35))',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    color: 'var(--pkd, #c04a82)',
    cursor: 'pointer',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    width: '100%',
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
