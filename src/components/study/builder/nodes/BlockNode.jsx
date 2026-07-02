import { Handle, Position } from '@xyflow/react'

export default function BlockNode({ data, selected }) {
  const children = data.children ?? []

  return (
    <div style={{ ...S.node, ...(selected ? S.selected : {}) }}>
      {/* Horizontal connections */}
      <Handle id="l" type="target" position={Position.Left}   style={S.handle} />
      <Handle id="r" type="source" position={Position.Right}  style={S.handle} />
      {/* Bottom for wrap-around; hidden visually */}
      <Handle id="b" type="source" position={Position.Bottom} style={{ ...S.handle, opacity: 0 }} />
      <Handle id="t" type="target" position={Position.Top}    style={{ ...S.handle, opacity: 0 }} />

      <div style={S.chip}>▦ Block</div>
      <div style={S.label}>{data.label || 'Untitled Block'}</div>

      {children.length === 0 && (
        <div style={{ ...S.childRow, color: '#e04', fontStyle: 'italic' }}>No sessions — add one below</div>
      )}

      {children.map((child, i) => {
        const tplName = data.sessionTemplates?.find(t => t.id === child.session_template_id)?.label
          ?? (child.session_template_id ? '…' : 'No template')
        return (
          <div key={child.id} style={S.childRow}>
            <span style={S.childIndex}>Day +{i}</span>
            <span style={S.childName}>{child.label || tplName}</span>
            {!data.isLocked && (
              <button
                style={S.removeBtn}
                onClick={e => { e.stopPropagation(); data.onRemoveSession?.(child.id) }}
                title="Remove session"
              >×</button>
            )}
          </div>
        )
      })}

      {!data.isLocked && (
        <button
          style={S.addBtn}
          onClick={e => { e.stopPropagation(); data.onAddSession?.() }}
        >
          + Add session
        </button>
      )}

      {!data.isLocked && (
        <button
          style={S.dupBtn}
          onClick={e => { e.stopPropagation(); data.onDuplicate?.() }}
          title="Duplicate this block"
        >
          Duplicate block
        </button>
      )}

      {data.isLocked && <div style={S.lockBadge}>locked</div>}
    </div>
  )
}

const S = {
  node: {
    background: '#fdf2f8',
    border: '2px solid var(--pkb, rgba(240,104,164,0.35))',
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
  childRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    borderTop: '1px solid rgba(240,104,164,0.12)',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 12,
    color: 'var(--tx2, #6b6c70)',
  },
  childIndex: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    color: 'var(--tx3, #a8a9ad)',
    minWidth: 36,
  },
  childName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  dupBtn: {
    marginTop: 6,
    background: 'none',
    border: 'none',
    padding: '2px 0',
    fontSize: 11,
    color: 'var(--tx3, #a8a9ad)',
    cursor: 'pointer',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    textAlign: 'left',
    textDecoration: 'underline',
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
