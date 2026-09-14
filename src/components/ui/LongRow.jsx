/**
 * LongRow — design-system row for boxed key/value lists (Figma "LongRow",
 * Sept 14 2026 handoff). Used by the Account Details box (/account) and the
 * Progress Tracker box (/ripple).
 *
 * Reading order is VALUE-FIRST: the left field carries the main value in
 * DM Sans / text-main, the right field carries the category as an uppercase
 * Space Mono label in text-secondary. (The pre-redesign Account rows were
 * label-left / value-right; the flip is the designer's standardization, not
 * an accident.)
 *
 * `left` is a node so callers can compose (emoji + label + tag, or an
 * <EditableName>); `category` is the plain-text right label.
 */
export default function LongRow({ left, category, style }) {
  return (
    <div style={{ ...S.row, ...style }}>
      <div style={S.left}>{left}</div>
      <span style={S.category}>{category}</span>
    </div>
  )
}

const S = {
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 24, padding: '12px 0',
  },
  left: {
    display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
    flexWrap: 'wrap', overflowWrap: 'anywhere',
    fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14,
    lineHeight: 1.5, color: 'var(--tx)',
  },
  category: {
    flexShrink: 0, fontFamily: '"Space Mono", "Courier New", monospace',
    fontSize: 14, lineHeight: 1.5, textTransform: 'uppercase',
    color: 'var(--tx2)', textAlign: 'right',
  },
}
