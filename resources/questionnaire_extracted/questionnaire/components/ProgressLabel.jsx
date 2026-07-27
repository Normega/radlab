// ── ProgressLabel.jsx ─────────────────────────────────────────────────────
// Sticky header label showing study part and item position.
// Only shown on 'item' slides — hidden on instruction / scale_change screens.

export default function ProgressLabel({
  partNumber,
  totalParts,
  partName,
  itemIndex,   // 1-based display index
  totalItems,
}) {
  if (!itemIndex) return null;

  return (
    <div
      style={{
        position:   'sticky',
        top:        0,
        zIndex:     20,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--bd)',
        padding:    '10px 20px',
        display:    'flex',
        alignItems: 'center',
        gap:        8,
      }}
    >
      {/* Part indicator */}
      {totalParts > 1 && (
        <span
          style={{
            fontFamily:  'Space Mono',
            fontSize:    'var(--fs-mono-sm)',
            color:       'var(--pk)',
            whiteSpace:  'nowrap',
          }}
        >
          Part {partNumber} of {totalParts}:
        </span>
      )}

      {/* Questionnaire name */}
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize:   'var(--fs-mono-sm)',
          color:      'var(--tx2)',
          flexShrink: 1,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {partName}
      </span>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Item counter */}
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize:   'var(--fs-mono-sm)',
          color:      'var(--tx3)',
          whiteSpace: 'nowrap',
        }}
      >
        Item {itemIndex} of {totalItems}
      </span>
    </div>
  );
}
