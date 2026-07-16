import { Handle, Position } from '@xyflow/react'

export default function RandomizeNode({ data, selected }) {
  const arms = data.arms ?? []

  return (
    <div style={{ ...S.node, ...(selected ? S.selected : {}) }}>
      {/* Horizontal chain connections */}
      <Handle id="l" type="target" position={Position.Left}   style={S.handle} />
      {/* Bottom/top for wrap-around; hidden visually */}
      <Handle id="b" type="source" position={Position.Bottom} style={{ ...S.handle, opacity: 0 }} />
      <Handle id="t" type="target" position={Position.Top}    style={{ ...S.handle, opacity: 0 }} />

      {/* One source handle per arm, stacked down the right edge */}
      {arms.map((arm, i) => (
        <Handle
          key={`arm-${i}`}
          id={`arm-${i}`}
          type="source"
          position={Position.Right}
          style={{ ...S.handle, top: `${((i + 1) / (arms.length + 1)) * 100}%` }}
        />
      ))}

      <div style={S.chip}>⑂ Randomize</div>
      <div style={S.label}>{data.label || 'Untitled'}</div>

      {arms.length === 0 && (
        <div style={{ ...S.armRow, color: '#e04', fontStyle: 'italic' }}>No arms — add at least 2</div>
      )}

      {arms.map((arm, i) => (
        <div key={i} style={S.armRow}>
          <div style={S.armHeader}>
            <span style={{ ...S.armGroup, color: arm.group ? 'var(--tx, #1c1c1e)' : '#e04' }}>
              {arm.group || '(unnamed group)'}
            </span>
            <span style={S.armWeight}>×{arm.weight ?? 1}</span>
            {!data.isLocked && (
              <button
                style={S.removeBtn}
                onClick={e => { e.stopPropagation(); data.onRemoveArm?.(i) }}
                title="Remove arm"
              >×</button>
            )}
          </div>

          {arm.entry ? (
            <div style={S.armEntry}>→ {data.nodeLabels?.[arm.entry] ?? arm.entry}</div>
          ) : data.isLocked ? (
            <div style={{ ...S.armEntry, color: '#e04' }}>No entry</div>
          ) : (
            <div style={S.armAddRow}>
              <button style={S.smallAddBtn} onClick={e => { e.stopPropagation(); data.onAddArmSession?.(i) }}>+ session</button>
              <button style={S.smallAddBtn} onClick={e => { e.stopPropagation(); data.onAddArmBlock?.(i) }}>+ block</button>
            </div>
          )}
        </div>
      ))}

      {!data.isLocked && (
        <button
          style={S.addBtn}
          onClick={e => { e.stopPropagation(); data.onAddArm?.() }}
        >
          + Add arm
        </button>
      )}

      {data.isLocked && <div style={S.lockBadge}>locked</div>}
    </div>
  )
}

const S = {
  node: {
    background: '#fff',
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
    marginBottom: 8,
  },
  armRow: {
    padding: '6px 0',
    borderTop: '1px solid rgba(240,104,164,0.12)',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 12,
    color: 'var(--tx2, #6b6c70)',
  },
  armHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  armGroup: {
    flex: 1,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  armWeight: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    color: 'var(--tx3, #abadb0)',
  },
  armEntry: {
    marginTop: 2,
    fontSize: 11,
    color: 'var(--tx3, #abadb0)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  armAddRow: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
  smallAddBtn: {
    background: 'none',
    border: '1px dashed var(--pkb, rgba(240,104,164,0.35))',
    borderRadius: 5,
    padding: '2px 8px',
    fontSize: 11,
    color: 'var(--pkd, #c04a82)',
    cursor: 'pointer',
    fontFamily: '"DM Sans", system-ui, sans-serif',
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
