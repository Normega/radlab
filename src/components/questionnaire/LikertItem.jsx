import { useState, useRef } from 'react';

// ── LikertItem.jsx ────────────────────────────────────────────────────────
//
// Renders one Likert item: stem text + vertical option list.
// On tap: highlights selected option for 250ms, then calls onSelect(value).
// In non-auto-advance mode, selection stays highlighted until Next is tapped.
//
// Props:
//   item          — item descriptor from questionnaire definition
//   labels        — effective scale labels for this item (from effectiveLabels())
//   selectedValue — currently selected value (controlled, from parent)
//   onSelect      — (value) => void — called after 250ms animation
//   autoAdvance   — bool — if true, parent will advance on onSelect; if false,
//                   a Next button appears beside the Back button

const ANIM_MS = 250;

export default function LikertItem({ item, labels, selectedValue, onSelect, autoAdvance, endpointOnly }) {
  const [pendingValue, setPendingValue] = useState(null);
  const tappingRef = useRef(false);

  function handleTap(value) {
    // Ignore re-taps during animation
    if (tappingRef.current) return;
    // In manual mode, allow re-selection freely
    if (!autoAdvance) {
      onSelect(value);
      return;
    }
    // Auto-advance: animate then fire
    tappingRef.current = true;
    setPendingValue(value);
    setTimeout(() => {
      tappingRef.current = false;
      setPendingValue(null);
      onSelect(value);
    }, ANIM_MS);
  }

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        width:         '100%',
        maxWidth:      520,
        margin:        '0 auto',
        padding:       '0 20px',
      }}
    >
      {/* Item stem */}
      <p
        style={{
          fontFamily: 'DM Sans',
          fontSize:   'var(--fs-body-lg)',
          color:      'var(--tx)',
          lineHeight: 1.5,
          margin:     '40px 0 16px',
          textAlign:  'center',
        }}
      >
        {item.text}
      </p>

      {/* Top anchor — endpoint-only scales only */}
      {endpointOnly && (
        <p style={{
          fontFamily: 'DM Sans',
          fontSize:   'var(--fs-body-sm)',
          color:      'var(--tx2)',
          textAlign:  'center',
          margin:     '0 0 4px',
        }}>
          {labels[0].label}
        </p>
      )}

      {/* Options */}
      {labels.map((opt) => {
        const isSelected = opt.value === selectedValue;
        const isPending  = opt.value === pendingValue;
        const active     = isSelected || isPending;

        return (
          <button
            key={opt.value}
            onClick={() => handleTap(opt.value)}
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  endpointOnly ? 'center' : 'flex-start',
              gap:             14,
              padding:         '14px 16px',
              borderRadius:    12,
              border:          `1.5px solid ${active ? 'var(--pk)' : 'var(--bd)'}`,
              background:      active ? 'var(--pkb)' : 'var(--bgc)',
              cursor:          'pointer',
              textAlign:       endpointOnly ? 'center' : 'left',
              width:           '100%',
              transition:      `border-color ${ANIM_MS}ms ease, background ${ANIM_MS}ms ease,
                                transform ${ANIM_MS * 0.4}ms ease`,
              transform:       isPending ? 'scale(0.985)' : 'scale(1)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Radio circle */}
            <span style={{
              width:          20,
              height:         20,
              borderRadius:   '50%',
              border:         `2px solid ${active ? 'var(--pk)' : 'var(--gy)'}`,
              background:     active ? 'var(--pk)' : 'transparent',
              flexShrink:     0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              transition:     `background ${ANIM_MS}ms ease, border-color ${ANIM_MS}ms ease`,
            }}>
              {active && (
                <span style={{
                  width:        8,
                  height:       8,
                  borderRadius: '50%',
                  background:   '#fff',
                }} />
              )}
            </span>

            {/* Label block */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: endpointOnly ? 0 : 1 }}>
              {opt.image ? (
                <ImageLabel src={opt.image} />
              ) : (
                <span style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    fontFamily: 'Space Mono',
                    fontSize:   'var(--fs-mono-sm)',
                    color:      active ? 'var(--pk)' : 'var(--tx2)',
                    transition: `color ${ANIM_MS}ms ease`,
                  }}>
                    {opt.value}
                  </span>
                  {/* In endpoint-only mode, suppress all label text (shown as anchors instead) */}
                  {!endpointOnly && opt.label && opt.label !== String(opt.value) && (
                    <span style={{
                      fontFamily: 'DM Sans',
                      fontSize:   'var(--fs-body-sm)',
                      color:      active ? 'var(--pkd)' : 'var(--tx)',
                      transition: `color ${ANIM_MS}ms ease`,
                    }}>
                      {opt.label}
                    </span>
                  )}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {/* Bottom anchor — endpoint-only scales only */}
      {endpointOnly && (
        <p style={{
          fontFamily: 'DM Sans',
          fontSize:   'var(--fs-body-sm)',
          color:      'var(--tx2)',
          textAlign:  'center',
          margin:     '4px 0 0',
        }}>
          {labels[labels.length - 1].label}
        </p>
      )}
    </div>
  );
}

// ── ImageLabel ─────────────────────────────────────────────────────────────
// Renders scale label image from /public/. Falls back to ? on load error.

function ImageLabel({ src }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        title={`Image not found: ${src}`}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          36,
          height:         36,
          borderRadius:   6,
          background:     'var(--bgp)',
          border:         '1px dashed var(--gy)',
          fontFamily:     'Space Mono',
          fontSize:       'var(--fs-mono-sm)',
          color:          'var(--tx3)',
        }}
      >
        ?
      </span>
    );
  }

  return (
    <img
      src={`/${src}`}
      alt=""
      onError={() => setFailed(true)}
      style={{
        width:        36,
        height:       36,
        objectFit:    'contain',
        borderRadius: 4,
        flexShrink:   0,
      }}
    />
  );
}
