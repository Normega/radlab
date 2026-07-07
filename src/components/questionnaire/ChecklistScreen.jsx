// ── ChecklistScreen.jsx ───────────────────────────────────────────────────
//
// Renders all items of a checklist-type questionnaire as one scrollable list
// of checkboxes. Items with allow_multiple show a frequency stepper once
// checked. The parent (QuestionnaireRenderer) owns the responses map and the
// Next button.
//
// Props:
//   items     — checklist item descriptors from the definition
//   responses — { [itemId]: { response_value, item_weight, occurrence_count } }
//   onChange  — (item, prevCount => nextCount) => void
//               Takes an updater rather than a precomputed count so rapid
//               taps (stepper spam, double-tap) each read the true previous
//               count instead of a stale render-time closure value.

const MAX_COUNT = 99;

export default function ChecklistScreen({ items, responses, onChange }) {
  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
        width:         '100%',
        maxWidth:      560,
        margin:        '0 auto',
        padding:       '24px 20px 0',
      }}
    >
      {items.map((item) => {
        const count   = responses[item.id]?.occurrence_count ?? 0;
        const checked = count > 0;

        return (
          <div
            key={item.id}
            style={{
              borderRadius: 12,
              border:       `1.5px solid ${checked ? 'var(--pk)' : 'var(--bd)'}`,
              background:   checked ? 'var(--pkb)' : 'var(--bgc)',
              transition:   'border-color 150ms ease, background 150ms ease',
            }}
          >
            <button
              onClick={() => onChange(item, (prevCount) => (prevCount > 0 ? 0 : 1))}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            14,
                width:          '100%',
                padding:        '14px 16px',
                background:     'transparent',
                border:         'none',
                cursor:         'pointer',
                textAlign:      'left',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Checkbox square */}
              <span
                style={{
                  width:          20,
                  height:         20,
                  borderRadius:   5,
                  border:         `2px solid ${checked ? 'var(--pk)' : 'var(--gy)'}`,
                  background:     checked ? 'var(--pk)' : 'transparent',
                  flexShrink:     0,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  transition:     'background 150ms ease, border-color 150ms ease',
                  color:          '#fff',
                  fontSize:       13,
                  lineHeight:     1,
                }}
              >
                {checked && '✓'}
              </span>

              <span
                style={{
                  fontFamily: 'DM Sans',
                  fontSize:   'var(--fs-body)',
                  color:      'var(--tx)',
                  lineHeight: 1.45,
                }}
              >
                {item.text}
              </span>
            </button>

            {/* Frequency stepper — only when checked and allow_multiple */}
            {checked && item.allow_multiple && (
              <div
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        12,
                  padding:    '0 16px 14px 50px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'DM Sans',
                    fontSize:   'var(--fs-body-sm)',
                    color:      'var(--tx2)',
                  }}
                >
                  How many times?
                </span>
                <StepperButton
                  label="−"
                  disabled={count <= 1}
                  onClick={() => onChange(item, (prevCount) => Math.max(prevCount - 1, 1))}
                />
                <span
                  style={{
                    fontFamily: 'Space Mono',
                    fontSize:   'var(--fs-mono-sm)',
                    color:      'var(--tx)',
                    minWidth:   24,
                    textAlign:  'center',
                  }}
                >
                  {count}
                </span>
                <StepperButton
                  label="+"
                  disabled={count >= MAX_COUNT}
                  onClick={() => onChange(item, (prevCount) => Math.min(prevCount + 1, MAX_COUNT))}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepperButton({ label, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width:          32,
        height:         32,
        borderRadius:   8,
        border:         '1px solid var(--bd)',
        background:     'var(--bgc)',
        color:          disabled ? 'var(--tx3)' : 'var(--tx)',
        fontFamily:     'Space Mono',
        fontSize:       16,
        lineHeight:     1,
        cursor:         disabled ? 'default' : 'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}
