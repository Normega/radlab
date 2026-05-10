/**
 * Greenhouse — Round 2 background for Farm Joy
 * RADlab · Regulatory & Affective Dynamics Lab · U of T
 *
 * Renders a wooden bench with a 2×3 grid of empty terracotta pots.
 * Pots are tappable; parent overlays veggie sprites when a value is placed.
 *
 * Props:
 *   onPotClick (fn)         — (row, col) => void; called when a pot is tapped
 *   className  (string)     — passed to outer wrapper for layout styling
 *
 * Note: pot fill state (which pots have a veggie) is managed by the parent —
 * this component just renders the bench + empty pots and emits click events.
 */

import { memo } from 'react'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const COLS = 3
const ROWS = 2

// Pot grid coordinates in SVG space (viewBox 680 × 1020)
const COL_X = [113, 340, 567]
const ROW_Y = [370, 690]

// ─── COMPONENT ───────────────────────────────────────────────────────────────

function Greenhouse({ onPotClick, className = '', preserveAspectRatio = 'xMidYMid meet' }) {
  return (
    <div className={className}>
      <svg
        width="100%"
        viewBox="0 0 680 1020"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio={preserveAspectRatio}
      >
        <title>Greenhouse with empty terracotta pots</title>
        <desc>Wooden bench surface with a 2 by 3 grid of empty terracotta pots ready for planting</desc>

        <defs>
          <g id="gh-pot">
            <ellipse cx="0" cy="62" rx="60" ry="9" fill="#5C4530" opacity="0.35" />
            <path d="M -52 -32 L 52 -32 L 44 58 L -44 58 Z" fill="#B5613D" />
            <path d="M -50 -30 L -36 -30 L -30 56 L -42 56 Z" fill="#CB7D5A" opacity="0.6" />
            <path d="M 36 -30 L 50 -30 L 42 56 L 30 56 Z" fill="#7F3A1C" opacity="0.45" />
            <path d="M -49 4 L 49 4" stroke="#7F3A1C" strokeWidth="1.2" opacity="0.35" />
            <ellipse cx="0" cy="-32" rx="52" ry="11" fill="#9B4828" />
            <ellipse cx="0" cy="-30" rx="48" ry="9" fill="#3C2418" />
            <ellipse cx="0" cy="-28" rx="46" ry="7" fill="#5C3D24" />
            <ellipse cx="-10" cy="-29" rx="22" ry="2.5" fill="#8B6F47" opacity="0.55" />
            <path d="M -42 -38 Q -20 -42 0 -42 Q 20 -42 42 -38" stroke="#E8AC83" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.65" />
          </g>
        </defs>

        {/* Wooden bench surface */}
        <rect width="680" height="1020" fill="#C2A47A" />

        {/* Wood grain (wavy horizontal lines) */}
        <g stroke="#8B6F47" opacity="0.28" fill="none" strokeWidth="1.2">
          <path d="M 0 70 Q 170 67 340 73 Q 510 70 680 71" />
          <path d="M 0 145 Q 170 148 340 142 Q 510 146 680 144" />
          <path d="M 0 290 Q 170 287 340 293 Q 510 290 680 291" />
          <path d="M 0 395 Q 170 398 340 392 Q 510 396 680 394" />
          <path d="M 0 540 Q 170 537 340 543 Q 510 540 680 541" />
          <path d="M 0 645 Q 170 648 340 642 Q 510 646 680 644" />
          <path d="M 0 780 Q 170 777 340 783 Q 510 780 680 781" />
          <path d="M 0 880 Q 170 883 340 877 Q 510 881 680 879" />
          <path d="M 0 970 Q 170 968 340 972 Q 510 970 680 971" />
        </g>

        {/* Wood knots */}
        <g fill="#7A5C3F" opacity="0.4">
          <ellipse cx="100" cy="180" rx="6" ry="3" />
          <ellipse cx="450" cy="465" rx="5" ry="3" />
          <ellipse cx="220" cy="895" rx="6" ry="3" />
          <ellipse cx="580" cy="855" rx="4" ry="2" />
          <ellipse cx="380" cy="240" rx="3" ry="2" />
        </g>

        {/* Plank divider lines */}
        <g fill="#7A5C3F" opacity="0.45">
          <rect x="0" y="220" width="680" height="2" />
          <rect x="0" y="515" width="680" height="2" />
          <rect x="0" y="810" width="680" height="2" />
        </g>

        {/* Pots (tappable) */}
        <g>
          {Array.from({ length: ROWS }).flatMap((_, row) =>
            Array.from({ length: COLS }).map((_, col) => (
              <g
                key={`${row}-${col}`}
                data-row={row}
                data-col={col}
                transform={`translate(${COL_X[col]},${ROW_Y[row]})`}
                onClick={() => onPotClick?.(row, col)}
                style={{ cursor: onPotClick ? 'pointer' : 'default' }}
              >
                <use href="#gh-pot" />
              </g>
            ))
          )}
        </g>
      </svg>
    </div>
  )
}

export default memo(Greenhouse)
