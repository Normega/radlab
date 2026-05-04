import { useState, useRef, useCallback } from 'react';

// ── PlacementSlider ────────────────────────────────────────────────────────
// Mandatory-placement pattern:
//   UNSET: dashed ghost thumb at centre + horizontal dashed line
//   PLACED: real thumb at exact tap/click position; draggable after placement

function PlacementSlider({ label, leftLabel, rightLabel, value, onChange }) {
  const trackRef = useRef(null);
  const placed   = value !== null;

  function getValueFromPointer(e) {
    const rect = trackRef.current.getBoundingClientRect();
    const x    = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return Math.round(1 + (x / rect.width) * 6); // 1–7
  }

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(getValueFromPointer(e));
  }
  function handlePointerUp(e) {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function handlePointerMove(e) {
    if (e.buttons === 0) return; // only while pressed
    onChange(getValueFromPointer(e));
  }

  const pct = placed ? ((value - 1) / 6) * 100 : 50;

  return (
    <div style={S.sliderWrap}>
      <div style={S.sliderTop}>
        <span style={S.sliderLabel}>{label}</span>
        {placed && <span style={S.sliderVal}>{value}</span>}
      </div>

      <div
        ref={trackRef}
        style={S.track}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        {/* Fill from left to thumb (only when placed) */}
        {placed && <div style={{ ...S.fill, width: `${pct}%` }} />}

        {/* Unset indicator: horizontal dashed line */}
        {!placed && <div style={S.dashedLine} />}

        {/* Tick marks */}
        {[0,1,2,3,4,5,6].map(i => (
          <div key={i} style={{ ...S.tick, left: `${(i / 6) * 100}%` }} />
        ))}

        {/* Thumb */}
        <div style={{
          ...S.thumb,
          left: `${pct}%`,
          ...(placed ? S.thumbPlaced : S.thumbUnset),
        }} />
      </div>

      <div style={S.endLabels}>
        <span style={S.endLabel}>{leftLabel}</span>
        <span style={S.endLabel}>{rightLabel}</span>
      </div>
    </div>
  );
}

// ── ResponseScreen ─────────────────────────────────────────────────────────
//
// Props:
//   onSubmit({ afc, confidence, arousal, reactionTimeMs }) => void
//   trialStartTime — performance.now() at start of breath sequence (for RT)

export default function ResponseScreen({ onSubmit, trialStartTime }) {
  const [afc,        setAfc]        = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [arousal,    setArousal]    = useState(null);
  const submitReady = afc !== null && confidence !== null && arousal !== null;

  function handleSubmit() {
    if (!submitReady) return;
    onSubmit({
      afc,
      confidence,
      arousal,
      reactionTimeMs: trialStartTime ? Math.round(performance.now() - trialStartTime) : null,
    });
  }

  return (
    <div style={S.wrap}>
      <p style={S.eyebrow}>What did you sense?</p>

      {/* 3AFC */}
      <div style={S.afcRow}>
        {[
          { key: 'faster',    label: 'Faster' },
          { key: 'same',      label: 'No change' },
          { key: 'slower',    label: 'Slower' },
        ].map(opt => (
          <button
            key={opt.key}
            style={{
              ...S.afcBtn,
              ...(afc === opt.key ? S.afcActive : {}),
            }}
            onClick={() => setAfc(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={S.divider} />

      {/* Sliders */}
      <PlacementSlider
        label="How confident are you?"
        leftLabel="not at all"
        rightLabel="completely"
        value={confidence}
        onChange={setConfidence}
      />

      <PlacementSlider
        label="How activated do you feel right now?"
        leftLabel="calm / still"
        rightLabel="alert / activated"
        value={arousal}
        onChange={setArousal}
      />

      {/* Submit */}
      <button
        style={{ ...S.nextBtn, opacity: submitReady ? 1 : 0.4, cursor: submitReady ? 'pointer' : 'default' }}
        onClick={handleSubmit}
      >
        Next trial →
      </button>
    </div>
  );
}

const MONO = '"Space Mono", monospace';

const S = {
  wrap:       { maxWidth: 420, margin: '0 auto', padding: '40px 24px' },
  eyebrow:    { fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 20px' },

  afcRow:     { display: 'flex', gap: 10, marginBottom: 24 },
  afcBtn: {
    flex: 1, padding: '13px 4px',
    borderRadius: 12,
    border: '1.5px solid var(--bds)',
    background: 'var(--bgc)',
    fontSize: 14, fontWeight: 600, color: 'var(--tx)',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.12s',
  },
  afcActive: {
    background: 'var(--bgp)',
    borderColor: 'var(--pk)',
    color: 'var(--pkd)',
  },

  divider:    { height: 1, background: 'var(--bd)', margin: '4px 0 24px' },

  sliderWrap: { marginBottom: 28 },
  sliderTop:  { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  sliderLabel: { fontSize: 13, color: 'var(--tx2)' },
  sliderVal:   { fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--pk)' },

  track: {
    position: 'relative',
    height: 28,
    borderRadius: 14,
    background: 'var(--bgp)',
    border: '1px solid var(--pkb)',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    overflow: 'visible',
  },
  fill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    borderRadius: 14,
    background: 'var(--pk)',
    opacity: 0.25,
    pointerEvents: 'none',
  },
  dashedLine: {
    position: 'absolute',
    top: '50%', left: 4, right: 4,
    height: 1,
    borderTop: '1.5px dashed var(--pkb)',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  tick: {
    position: 'absolute',
    top: '50%',
    width: 1, height: 8,
    background: 'var(--pkb)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 22, height: 22,
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    transition: 'left 0.05s',
  },
  thumbUnset: {
    background: 'transparent',
    border: '2px dashed var(--pk)',
    opacity: 0.5,
  },
  thumbPlaced: {
    background: 'var(--pk)',
    border: '2px solid var(--pk)',
    boxShadow: '0 2px 8px rgba(240,104,164,0.35)',
  },
  endLabels:  { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
  endLabel:   { fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', color: 'var(--tx3)', textTransform: 'lowercase' },

  nextBtn: {
    width: '100%', padding: '14px 0',
    background: 'var(--pk)', color: '#fff',
    border: 'none', borderRadius: 14,
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    transition: 'opacity 0.15s',
    marginTop: 8,
  },
};
