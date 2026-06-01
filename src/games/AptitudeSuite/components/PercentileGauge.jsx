import { useMemo } from 'react';

const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const ARC_LENGTH = Math.PI * R;

// Semicircle: starts at left (180°), sweeps 180° to right (0°)
function describeArc(pct) {
  const filled = pct * ARC_LENGTH;
  return { dasharray: `${ARC_LENGTH} ${ARC_LENGTH}`, dashoffset: ARC_LENGTH - filled };
}

// 0–33: red (#e05555) → yellow (#F5C842), 34–66: yellow → green (#4caf7d), 67+: green
function gaugeColor(value) {
  if (value <= 33) {
    const t = value / 33;
    return `rgb(${Math.round(224 + (245 - 224) * t)},${Math.round(85 + (200 - 85) * t)},${Math.round(85 + (66 - 85) * t)})`;
  }
  if (value <= 66) {
    const t = (value - 33) / 33;
    return `rgb(${Math.round(245 + (76 - 245) * t)},${Math.round(200 + (175 - 200) * t)},${Math.round(66 + (125 - 66) * t)})`;
  }
  return '#4caf7d';
}

// viewBox starts 8px above arc top (arc top = CY - R = 5, so top = -3)
const VIEW_TOP = -3;
const VIEW_H = CY + 8; // down to y=68, leaving room below arc centre

export default function PercentileGauge({ value = 0, label = '', size = SIZE }) {
  const pct = value / 99;
  const { dasharray, dashoffset } = useMemo(() => describeArc(pct), [pct]);
  const arcColor = gaugeColor(value);
  const scale = size / SIZE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg
        width={size}
        height={scale * (VIEW_H - VIEW_TOP)}
        viewBox={`0 ${VIEW_TOP} ${SIZE} ${VIEW_H - VIEW_TOP}`}
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
          x={CX} y={CY - 8}
          textAnchor="middle"
          fontFamily="'Space Mono', monospace"
          fontWeight="700"
          fontSize="22"
          fill="var(--tx)"
        >
          {value}
        </text>
      </svg>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '11px',
        color: 'var(--tx3)',
        marginTop: '-2px',
        textAlign: 'center',
      }}>
        better than {value}% of players
      </div>
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
