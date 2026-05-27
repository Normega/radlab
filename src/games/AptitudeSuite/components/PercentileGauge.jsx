import { useMemo } from 'react';

const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
// Semicircle: starts at left (180°), sweeps 180° to right (0°)
const ARC_LENGTH = Math.PI * R;

function describeArc(pct) {
  // pct 0–1: fraction of semicircle to fill
  const filled = pct * ARC_LENGTH;
  return { dasharray: `${ARC_LENGTH} ${ARC_LENGTH}`, dashoffset: ARC_LENGTH - filled };
}

function lerpColor(t) {
  // gray (#abadb0) at t=0 → pink (#f068a4) at t=1
  const r = Math.round(171 + (240 - 171) * t);
  const g = Math.round(173 + (104 - 173) * t);
  const b = Math.round(176 + (164 - 176) * t);
  return `rgb(${r},${g},${b})`;
}

export default function PercentileGauge({ value = 0, label = '', size = SIZE }) {
  const pct = value / 99;
  const { dasharray, dashoffset } = useMemo(() => describeArc(pct), [pct]);
  const arcColor = lerpColor(pct);
  const scale = size / SIZE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg
        width={size}
        height={size / 2 + STROKE}
        viewBox={`0 ${CY - STROKE / 2} ${SIZE} ${SIZE / 2 + STROKE}`}
        style={{ overflow: 'visible' }}
      >
        {/* background arc */}
        <path
          d={`M ${STROKE / 2},${CY} A ${R},${R} 0 0,1 ${SIZE - STROKE / 2},${CY}`}
          fill="none"
          stroke="var(--bd)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* filled arc */}
        <path
          d={`M ${STROKE / 2},${CY} A ${R},${R} 0 0,1 ${SIZE - STROKE / 2},${CY}`}
          fill="none"
          stroke={arcColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={dasharray}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
        />
        {/* value readout */}
        <text
          x={CX} y={CY - 4}
          textAnchor="middle"
          fontFamily="'Space Mono', monospace"
          fontWeight="700"
          fontSize="22"
          fill="var(--tx)"
        >
          {value}
        </text>
        <text
          x={CX} y={CY + 10}
          textAnchor="middle"
          fontFamily="'DM Sans', sans-serif"
          fontSize="10"
          fill="var(--tx3)"
        >
          percentile
        </text>
      </svg>
      {label && (
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          color: 'var(--tx2)',
          marginTop: '2px',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
