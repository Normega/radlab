import { useEffect, useRef, useState } from 'react';

// Arc path: M 10 64 A 45 45 0 0 1 100 64  (upward semicircle, length ≈ 141.4)
const ARC    = 'M 10 64 A 45 45 0 0 1 100 64';
const ARC_LEN = 141.4;

function arcColor(syncLevel) {
  if (syncLevel >= 0.80) return '#1D9E75'; // green
  if (syncLevel >= 0.50) return '#7DAE18'; // yellow-green
  return '#BA7517';                         // amber
}

// ── SyncMeter ─────────────────────────────────────────────────────────────
// Arc-style sync quality indicator.
//
// Props:
//   syncLevel   — 0.0–1.0 rolling mean
//   justUpdated — true for one render cycle after a new score is added → pulse

export default function SyncMeter({ syncLevel = 0, justUpdated = false }) {
  const hasFlashedRef = useRef(false);
  const [flashGreen, setFlashGreen] = useState(false);

  // Flash green on first crossing of 80%
  useEffect(() => {
    if (syncLevel >= 0.80 && !hasFlashedRef.current) {
      hasFlashedRef.current = true;
      setFlashGreen(true);
      setTimeout(() => setFlashGreen(false), 700);
    }
  }, [syncLevel]);

  const color      = arcColor(syncLevel);
  const dashOffset = ARC_LEN * (1 - Math.max(0, Math.min(1, syncLevel)));

  return (
    <div style={S.wrap}>
      {/* Pulse wrapper — CSS scale transition, safe on a div */}
      <div style={{
        ...S.meterWrap,
        transform: justUpdated ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.25s ease',
        position: 'relative',
      }}>
        {/* Green flash overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          background: '#1D9E75',
          opacity: flashGreen ? 0.22 : 0,
          transition: 'opacity 0.5s ease',
          pointerEvents: 'none',
        }} />

        <svg viewBox="0 14 110 58" width="110" height="55">
          {/* Track */}
          <path d={ARC} fill="none" stroke="rgba(0,0,0,0.08)"
            strokeWidth="6" strokeLinecap="round" />
          {/* Fill — advances from left as syncLevel rises */}
          <path
            d={ARC}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={ARC_LEN.toFixed(1)}
            strokeDashoffset={dashOffset.toFixed(1)}
            style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
          />
          {/* Percentage */}
          <text
            x="55" y="58"
            textAnchor="middle"
            fontFamily='"Space Mono", monospace'
            fontSize="13"
            fill="#1c1c1e"
          >
            {Math.round(syncLevel * 100)}%
          </text>
        </svg>
      </div>

      <p style={S.label}>connection strength</p>
    </div>
  );
}

const S = {
  wrap:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  meterWrap: { padding: '8px 12px', borderRadius: 12 },
  label:     {
    fontFamily: '"Space Mono", monospace',
    fontSize: 12, letterSpacing: '0.10em',
    textTransform: 'uppercase', color: 'var(--tx3)', margin: 0,
  },
};
