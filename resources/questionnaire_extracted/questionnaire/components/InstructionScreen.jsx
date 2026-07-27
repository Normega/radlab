// ── InstructionScreen.jsx ─────────────────────────────────────────────────
//
// Mandatory instruction screen shown before every questionnaire.
// Requires an explicit "Begin" tap — intentional friction to break rhythm.

export default function InstructionScreen({ questionnaire, onBegin }) {
  const labels = questionnaire.scale_labels ?? [];
  const hasLabels = labels.length > 0;
  const anchorLow  = labels[0]?.label;
  const anchorHigh = labels[labels.length - 1]?.label;
  const scaleMin   = labels[0]?.value;
  const scaleMax   = labels[labels.length - 1]?.value;

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
      {/* Questionnaire name */}
      <h2
        style={{
          fontFamily: 'DM Serif Display',
          fontSize:   28,
          color:      'var(--tx)',
          margin:     0,
        }}
      >
        {questionnaire.name}
      </h2>

      {/* Instruction text */}
      <p
        style={{
          fontFamily: 'DM Sans',
          fontSize:   'var(--fs-body-lg)',
          color:      'var(--tx2)',
          lineHeight: 1.6,
          margin:     0,
        }}
      >
        {questionnaire.instructions}
      </p>

      {/* Scale description */}
      {hasLabels && (
        <div
          style={{
            background:   'var(--bgp)',
            border:       '1px solid var(--pkb)',
            borderRadius: 12,
            padding:      '16px 20px',
            width:        '100%',
          }}
        >
          <p
            style={{
              fontFamily: 'Space Mono',
              fontSize:   'var(--fs-mono-sm)',
              color:      'var(--tx3)',
              margin:     '0 0 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Scale
          </p>
          <p
            style={{
              fontFamily: 'DM Sans',
              fontSize:   'var(--fs-body)',
              color:      'var(--tx2)',
              margin:     0,
            }}
          >
            {scaleMin}–{scaleMax} points
            {anchorLow && anchorHigh && (
              <>
                {' '}· from{' '}
                <strong style={{ color: 'var(--tx)' }}>"{anchorLow}"</strong>
                {' '}to{' '}
                <strong style={{ color: 'var(--tx)' }}>"{anchorHigh}"</strong>
              </>
            )}
          </p>
        </div>
      )}

      {/* Begin button */}
      <button
        onClick={onBegin}
        style={{
          background:   'var(--pk)',
          color:        '#fff',
          border:       'none',
          borderRadius: 14,
          padding:      '16px 48px',
          fontFamily:   'DM Sans',
          fontSize:     'var(--fs-body-lg)',
          fontWeight:   600,
          cursor:       'pointer',
          marginTop:    8,
        }}
      >
        Begin
      </button>
    </div>
  );
}
