// ── ScaleChangeScreen.jsx ─────────────────────────────────────────────────
//
// Auto-generated text-only slide when scale labels change between items.
// Notifies participant of the new scale range before they see the next item.
// Has a Continue button (not Begin — this is a mid-questionnaire transition).

export default function ScaleChangeScreen({ slide, onContinue }) {
  const { scaleMin, scaleMax, anchorLow, anchorHigh, labels } = slide;
  const pointWord = (scaleMax - scaleMin + 1) === 7 ? '7-point' :
                    (scaleMax - scaleMin + 1) === 5 ? '5-point' :
                    `${scaleMax - scaleMin + 1}-point`;

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '70vh',
        padding:        '32px 24px',
        maxWidth:       520,
        margin:         '0 auto',
        gap:            24,
        textAlign:      'center',
      }}
    >
      {/* Scale change notice chip */}
      <span
        style={{
          fontFamily:    'Space Mono',
          fontSize:      'var(--fs-mono-sm)',
          color:         'var(--pk)',
          background:    'var(--pkb)',
          border:        '1px solid var(--pkbs)',
          borderRadius:  20,
          padding:       '4px 14px',
        }}
      >
        Scale change
      </span>

      <p
        style={{
          fontFamily: 'DM Sans',
          fontSize:   'var(--fs-body-lg)',
          color:      'var(--tx)',
          lineHeight: 1.6,
          margin:     0,
        }}
      >
        For the next questions, the scale changes to a{' '}
        <strong>{pointWord} scale</strong>
        {anchorLow && anchorHigh && (
          <>
            {' '}ranging from{' '}
            <strong>"{anchorLow}"</strong>
            {' '}to{' '}
            <strong>"{anchorHigh}"</strong>
          </>
        )}
        .
      </p>

      {/* Show all new labels as a preview */}
      {labels && labels.length > 0 && (
        <div
          style={{
            background:   'var(--bgp)',
            border:       '1px solid var(--pkb)',
            borderRadius: 12,
            padding:      '16px 20px',
            width:        '100%',
            display:      'flex',
            flexDirection:'column',
            gap:          8,
          }}
        >
          {labels.map(opt => (
            <div
              key={opt.value}
              style={{
                display:    'flex',
                gap:        10,
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily:  'Space Mono',
                  fontSize:    'var(--fs-mono-sm)',
                  color:       'var(--pk)',
                  minWidth:    20,
                  textAlign:   'right',
                }}
              >
                {opt.value}
              </span>
              <span
                style={{
                  fontFamily: 'DM Sans',
                  fontSize:   'var(--fs-body-sm)',
                  color:      'var(--tx2)',
                }}
              >
                {opt.label || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onContinue}
        style={{
          background:   'var(--pk)',
          color:        '#fff',
          border:       'none',
          borderRadius: 14,
          padding:      '14px 40px',
          fontFamily:   'DM Sans',
          fontSize:     'var(--fs-body)',
          fontWeight:   600,
          cursor:       'pointer',
        }}
      >
        Continue
      </button>
    </div>
  );
}
