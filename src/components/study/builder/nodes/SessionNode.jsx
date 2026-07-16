import { Handle, Position } from '@xyflow/react'

export default function SessionNode({ data, selected }) {
  const templateName = data.sessionTemplates?.find(t => t.id === data.session_template_id)?.label
    ?? (data.session_template_id ? '(unknown template)' : 'No template')

  return (
    <div style={{ ...S.node, ...(selected ? S.selected : {}) }}>
      {/* Horizontal connections */}
      <Handle id="l" type="target" position={Position.Left}   style={S.handle} />
      <Handle id="r" type="source" position={Position.Right}  style={S.handle} />
      {/* Bottom used for wrap-around edge to next timepoint; hidden visually */}
      <Handle id="b" type="source" position={Position.Bottom} style={{ ...S.handle, opacity: 0 }} />
      <Handle id="t" type="target" position={Position.Top}    style={{ ...S.handle, opacity: 0 }} />

      <div style={S.chip}>● Session</div>
      <div style={S.label}>{data.label || 'Untitled'}</div>
      <div style={{ ...S.meta, color: data.session_template_id ? 'var(--tx2)' : '#e04' }}>
        {templateName}
      </div>
      <div style={S.meta}>Link expires: {data.link_expires_hours ?? 48}h</div>

      {data.isLocked && <div style={S.lockBadge}>locked</div>}
    </div>
  )
}

const S = {
  node: {
    background: '#fff',
    border: '2px solid var(--bd, rgba(180,100,140,0.13))',
    borderRadius: 10,
    padding: '12px 16px',
    minWidth: 230,
    maxWidth: 280,
    boxShadow: '0 1px 4px rgba(180,100,140,0.08)',
    position: 'relative',
  },
  selected: {
    borderColor: 'var(--pk, #f068a4)',
    boxShadow: '0 0 0 3px rgba(240,104,164,0.18)',
  },
  chip: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    color: 'var(--tx3, #abadb0)',
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
    background: 'var(--gy, #abadb0)',
    border: 'none',
    width: 10,
    height: 10,
  },
}
