/**
 * FarmRow — Round 3 (planting) and Harvest (payoff) background for Farm Joy
 * RADlab · Regulatory & Affective Dynamics Lab · U of T
 *
 * Props:
 *   cropsPerRow  (number[3]) — slots per row. [1,1,1] = single mound/hole per row.
 *                              [6,6,6] = harvest fill.
 *   mode         (string)    — 'harvest' (default) renders raised mounds at ROW_Y_HARVEST;
 *                              'planting' renders soil depressions at ROW_Y_PLANTING.
 *   onMoundClick (fn)        — (row, col) => void
 *   className    (string)    — passed to outer wrapper
 *   preserveAspectRatio      — SVG attribute; default 'xMidYMid meet'
 */

import { memo } from 'react'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const ROWS = 3

// Harvest: mounds centered mid-band
const ROW_Y_HARVEST  = [175, 510, 845]
// Planting: holes near bottom of each band, just above furrow trough
const ROW_Y_PLANTING = [275, 610, 945]

const SIDE_MARGIN = 50

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function moundXPositions(count) {
  if (count <= 0) return []
  if (count === 1) return [340]
  const usable = 680 - 2 * SIDE_MARGIN
  const step = usable / (count - 1)
  return Array.from({ length: count }, (_, i) => SIDE_MARGIN + i * step)
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

function FarmRow({
  cropsPerRow = [1, 1, 1],
  mode = 'harvest',
  onMoundClick,
  className = '',
  preserveAspectRatio = 'xMidYMid meet',
}) {
  const rowY   = mode === 'planting' ? ROW_Y_PLANTING : ROW_Y_HARVEST
  const symbol = mode === 'planting' ? '#fr-hole'     : '#fr-mound'

  return (
    <div className={className}>
      <svg
        width="100%"
        viewBox="0 0 680 1020"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio={preserveAspectRatio}
      >
        <title>Farm row planting and harvest</title>
        <desc>Three horizontal soil bands separated by furrow paths</desc>

        <defs>
          {/* Raised mound — used in harvest mode */}
          <g id="fr-mound">
            <ellipse cx="0" cy="7" rx="52" ry="10" fill="#5C4530" opacity="0.5" />
            <ellipse cx="0" cy="0" rx="50" ry="13" fill="#9F8157" />
            <ellipse cx="-10" cy="-3" rx="28" ry="4" fill="#B89976" opacity="0.65" />
          </g>
          {/* Soil depression (planting hole) — used in planting mode */}
          <g id="fr-hole">
            <ellipse cx="0" cy="0" rx="48" ry="11" fill="#4A3624" />
            <ellipse cx="0" cy="1" rx="42" ry="9"  fill="#2F1F12" />
            <ellipse cx="0" cy="2" rx="32" ry="6"  fill="#1A0F08" />
          </g>
        </defs>

        {/* Soil base */}
        <rect width="680" height="1020" fill="#8B6F47" />

        {/* Furrow path troughs (between bands) */}
        <g fill="#3F2A1A" opacity="0.5">
          <rect x="0" y="320" width="680" height="45" />
          <rect x="0" y="655" width="680" height="45" />
        </g>

        {/* Top edge highlights of each band */}
        <g fill="#B89976" opacity="0.55">
          <rect x="0" y="30"  width="680" height="5" />
          <rect x="0" y="365" width="680" height="5" />
          <rect x="0" y="700" width="680" height="5" />
        </g>

        {/* Bottom edge shadows of each band */}
        <g fill="#4A3624" opacity="0.4">
          <rect x="0" y="313" width="680" height="5" />
          <rect x="0" y="648" width="680" height="5" />
          <rect x="0" y="983" width="680" height="5" />
        </g>

        {/* Dark dirt specks */}
        <g fill="#5C4530" opacity="0.5">
          <circle cx="40" cy="60" r="1.8" /><circle cx="180" cy="80" r="1.5" /><circle cx="310" cy="55" r="1.8" /><circle cx="450" cy="75" r="1.5" /><circle cx="590" cy="60" r="1.8" /><circle cx="80" cy="240" r="1.5" /><circle cx="240" cy="260" r="1.8" /><circle cx="400" cy="240" r="1.5" /><circle cx="560" cy="260" r="1.8" /><circle cx="640" cy="290" r="1.5" /><circle cx="60" cy="280" r="1.5" /><circle cx="200" cy="290" r="1.8" />
          <circle cx="40" cy="395" r="1.8" /><circle cx="180" cy="415" r="1.5" /><circle cx="310" cy="390" r="1.8" /><circle cx="450" cy="410" r="1.5" /><circle cx="590" cy="395" r="1.8" /><circle cx="80" cy="575" r="1.5" /><circle cx="240" cy="595" r="1.8" /><circle cx="400" cy="575" r="1.5" /><circle cx="560" cy="595" r="1.8" /><circle cx="640" cy="625" r="1.5" /><circle cx="60" cy="615" r="1.5" /><circle cx="200" cy="625" r="1.8" />
          <circle cx="40" cy="730" r="1.8" /><circle cx="180" cy="750" r="1.5" /><circle cx="310" cy="725" r="1.8" /><circle cx="450" cy="745" r="1.5" /><circle cx="590" cy="730" r="1.8" /><circle cx="80" cy="910" r="1.5" /><circle cx="240" cy="930" r="1.8" /><circle cx="400" cy="910" r="1.5" /><circle cx="560" cy="930" r="1.8" /><circle cx="640" cy="960" r="1.5" /><circle cx="60" cy="950" r="1.5" /><circle cx="200" cy="960" r="1.8" />
        </g>

        {/* Light dirt specks */}
        <g fill="#A88863" opacity="0.55">
          <circle cx="100" cy="100" r="1.3" /><circle cx="260" cy="80" r="1.5" /><circle cx="380" cy="100" r="1.3" /><circle cx="520" cy="80" r="1.5" /><circle cx="640" cy="100" r="1.3" /><circle cx="120" cy="260" r="1.5" /><circle cx="320" cy="280" r="1.3" /><circle cx="480" cy="260" r="1.5" /><circle cx="620" cy="280" r="1.3" /><circle cx="40" cy="290" r="1.5" /><circle cx="160" cy="295" r="1.3" /><circle cx="430" cy="290" r="1.5" />
          <circle cx="100" cy="435" r="1.3" /><circle cx="260" cy="415" r="1.5" /><circle cx="380" cy="435" r="1.3" /><circle cx="520" cy="415" r="1.5" /><circle cx="640" cy="435" r="1.3" /><circle cx="120" cy="595" r="1.5" /><circle cx="320" cy="615" r="1.3" /><circle cx="480" cy="595" r="1.5" /><circle cx="620" cy="615" r="1.3" /><circle cx="40" cy="625" r="1.5" />
          <circle cx="100" cy="770" r="1.3" /><circle cx="260" cy="750" r="1.5" /><circle cx="380" cy="770" r="1.3" /><circle cx="520" cy="750" r="1.5" /><circle cx="640" cy="770" r="1.3" /><circle cx="120" cy="930" r="1.5" /><circle cx="320" cy="950" r="1.3" /><circle cx="480" cy="930" r="1.5" /><circle cx="620" cy="950" r="1.3" /><circle cx="40" cy="960" r="1.5" />
        </g>

        {/* Mounds or holes (count per row driven by props) */}
        <g>
          {cropsPerRow.slice(0, ROWS).flatMap((count, row) => {
            const xs = moundXPositions(count)
            return xs.map((x, col) => (
              <g
                key={`${row}-${col}`}
                data-row={row}
                data-col={col}
                transform={`translate(${x},${rowY[row]})`}
                onClick={() => onMoundClick?.(row, col)}
                style={{ cursor: onMoundClick ? 'pointer' : 'default' }}
              >
                <use href={symbol} />
              </g>
            ))
          })}
        </g>
      </svg>
    </div>
  )
}

export default memo(FarmRow)
