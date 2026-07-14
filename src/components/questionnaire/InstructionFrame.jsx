import { useState } from 'react';

// ── InstructionFrame.jsx ──────────────────────────────────────────────────
//
// Persistent instruction reminder shown above every item, so the instruction
// stem and scale anchors don't have to be recalled from the one-time
// InstructionScreen (or a since-passed ScaleChangeScreen). Collapsed to one
// line by default; tap to expand the full instruction text and scale table.
//
// Props:
//   instructions — questionnaire.instructions text; renders nothing if empty
//   labels       — effective scale labels for the current item (from effectiveLabels())

export default function InstructionFrame({ instructions, labels }) {
  const [expanded, setExpanded] = useState(false);

  if (!instructions) return null;

  const anchorLow  = labels?.[0];
  const anchorHigh = labels?.[labels.length - 1];

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        width:          '100%',
        textAlign:      'left',
        background:     'var(--bgp)',
        border:         'none',
        borderBottom:   '1px solid var(--bd)',
        padding:        '8px 20px',
        cursor:         'pointer',
        gap:            expanded ? 10 : 0,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily:    'Space Mono',
            fontSize:      'var(--fs-mono-sm)',
            color:         'var(--pkd)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink:    0,
          }}
        >
          Reminder
        </span>
        <span
          style={{
            fontFamily:   'DM Sans',
            fontSize:     'var(--fs-body-sm)',
            color:        'var(--tx2)',
            flex:         1,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   expanded ? 'normal' : 'nowrap',
            lineHeight:   1.5,
          }}
        >
          {instructions}
          {!expanded && anchorLow && anchorHigh && ` · ${anchorLow.label} → ${anchorHigh.label}`}
        </span>
        <span
          style={{
            fontSize:   10,
            color:      'var(--tx3)',
            flexShrink: 0,
            transform:  expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 200ms ease',
          }}
        >
          ▾
        </span>
      </span>

      {expanded && labels?.length > 0 && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {labels.map(opt => (
            <span key={opt.value} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: 'Space Mono',
                  fontSize:   'var(--fs-mono-sm)',
                  color:      'var(--pkd)',
                  minWidth:   18,
                  textAlign:  'right',
                }}
              >
                {opt.value}
              </span>
              <span style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx)' }}>
                {opt.label || '—'}
              </span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
