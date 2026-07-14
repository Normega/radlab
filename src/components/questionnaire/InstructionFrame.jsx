// ── InstructionFrame.jsx ──────────────────────────────────────────────────
//
// Persistent instruction reminder shown above every item, so the instruction
// stem doesn't have to be recalled from the one-time InstructionScreen.
// Scale labels are deliberately omitted — they're already visible in the
// response options directly below.
//
// Props:
//   instructions — questionnaire.instructions text; renders nothing if empty

export default function InstructionFrame({ instructions }) {
  if (!instructions) return null;

  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'baseline',
        gap:          8,
        width:        '100%',
        background:   'var(--bgp)',
        borderBottom: '1px solid var(--bd)',
        padding:      '10px 20px',
      }}
    >
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
          fontFamily: 'DM Sans',
          fontSize:   'var(--fs-body-sm)',
          color:      'var(--tx2)',
          lineHeight: 1.5,
        }}
      >
        {instructions}
      </span>
    </div>
  );
}
