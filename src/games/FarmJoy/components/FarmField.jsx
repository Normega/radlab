/**
 * FarmField — Round 1 soil field background for Farm Joy
 * RADlab · Regulatory & Affective Dynamics Lab · U of T
 *
 * Renders a 4×6 grid of planting mounds with randomized stalk variants.
 * Each mound is tappable; pulled mounds hide their stalks (mound base remains).
 *
 * Props:
 *   pulledMounds  (Set<string>)  — set of "row-col" keys for already-pulled mounds
 *                                  (e.g. new Set(['0-2', '1-1'])). Default: empty.
 *   onMoundClick  (fn)           — (row, col) => void; called when a mound is tapped
 *   seed          (number|null)  — optional seed for deterministic stalk distribution
 *                                  (useful for tests). If null, randomizes per mount.
 *   className     (string)       — passed to outer wrapper for layout styling
 */

import { useMemo } from 'react'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const COLS = 4
const ROWS = 6

// Grid coordinates in SVG space (viewBox 680 × 1020)
const COL_X = [85, 255, 425, 595]
const ROW_Y = [135, 305, 475, 645, 815, 985]

const STALK_VARIANTS = ['a', 'b', 'c', 'd', 'e']

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Mulberry32 PRNG for seeded randomization
function mulberry32(seed) {
  let t = seed
  return () => {
    t = (t + 0x6D2B79F5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function generateStalkAssignments(seed) {
  const rand = seed != null ? mulberry32(seed) : Math.random
  const assignments = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const variant = STALK_VARIANTS[Math.floor(rand() * STALK_VARIANTS.length)]
      assignments.push({ row: r, col: c, variant })
    }
  }
  return assignments
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function FarmField({
  pulledMounds = new Set(),
  onMoundClick,
  seed = null,
  className = '',
}) {
  const mounds = useMemo(() => generateStalkAssignments(seed), [seed])

  return (
    <div className={className}>
      <svg
        width="100%"
        viewBox="0 0 680 1020"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>Farm soil field</title>
        <desc>Tilled soil field with horizontal furrows and a 4 by 6 grid of planting mounds with green stalks</desc>

        <defs>
          <g id="ff-mound-base">
            <ellipse cx="0" cy="8" rx="58" ry="13" fill="#5C4530" opacity="0.5" />
            <ellipse cx="0" cy="0" rx="55" ry="15" fill="#9F8157" />
            <ellipse cx="-12" cy="-3" rx="32" ry="5" fill="#B89976" opacity="0.65" />
          </g>
          <g id="ff-stalk-a">
            <path d="M 0 -10 L 0 -42" stroke="#5C8042" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="-9" cy="-34" rx="10" ry="4" fill="#7FA56C" transform="rotate(-32 -9 -34)" />
            <ellipse cx="10" cy="-27" rx="10" ry="4" fill="#6B8E5A" transform="rotate(38 10 -27)" />
            <ellipse cx="-2" cy="-46" rx="7" ry="3.5" fill="#7FA56C" />
          </g>
          <g id="ff-stalk-b">
            <path d="M 0 -10 Q -3 -25 -6 -38" stroke="#5C8042" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="-13" cy="-30" rx="9" ry="4" fill="#6B8E5A" transform="rotate(-25 -13 -30)" />
            <ellipse cx="5" cy="-22" rx="8" ry="3.5" fill="#7FA56C" transform="rotate(45 5 -22)" />
            <ellipse cx="-8" cy="-42" rx="6" ry="3" fill="#7FA56C" />
          </g>
          <g id="ff-stalk-c">
            <path d="M 0 -10 Q 3 -25 6 -40" stroke="#5C8042" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="13" cy="-32" rx="10" ry="4" fill="#7FA56C" transform="rotate(35 13 -32)" />
            <ellipse cx="-5" cy="-25" rx="9" ry="3.5" fill="#6B8E5A" transform="rotate(-40 -5 -25)" />
            <ellipse cx="8" cy="-44" rx="6" ry="3" fill="#7FA56C" />
          </g>
          <g id="ff-stalk-d">
            <path d="M 0 -10 L 0 -36" stroke="#5C8042" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="-11" cy="-26" rx="9" ry="3.5" fill="#7FA56C" transform="rotate(-40 -11 -26)" />
            <ellipse cx="11" cy="-20" rx="9" ry="3.5" fill="#6B8E5A" transform="rotate(45 11 -20)" />
            <ellipse cx="-7" cy="-36" rx="7" ry="3" fill="#6B8E5A" transform="rotate(-15 -7 -36)" />
            <ellipse cx="7" cy="-40" rx="7" ry="3" fill="#7FA56C" transform="rotate(20 7 -40)" />
          </g>
          <g id="ff-stalk-e">
            <path d="M 0 -10 L 0 -32" stroke="#5C8042" strokeWidth="2" strokeLinecap="round" fill="none" />
            <ellipse cx="0" cy="-36" rx="8" ry="4" fill="#7FA56C" />
            <ellipse cx="-8" cy="-25" rx="7" ry="3" fill="#6B8E5A" transform="rotate(-30 -8 -25)" />
          </g>
        </defs>

        {/* Soil base */}
        <rect width="680" height="1020" fill="#8B6F47" />

        {/* Ridge highlight bands (depth illusion) */}
        <g fill="#B89976" opacity="0.5">
          <rect x="0" y="158" width="680" height="3" />
          <rect x="0" y="328" width="680" height="3" />
          <rect x="0" y="498" width="680" height="3" />
          <rect x="0" y="668" width="680" height="3" />
          <rect x="0" y="838" width="680" height="3" />
        </g>

        {/* Furrow shadow troughs */}
        <g fill="#4A3624" opacity="0.42">
          <rect x="0" y="164" width="680" height="12" />
          <rect x="0" y="334" width="680" height="12" />
          <rect x="0" y="504" width="680" height="12" />
          <rect x="0" y="674" width="680" height="12" />
          <rect x="0" y="844" width="680" height="12" />
        </g>

        {/* Dark dirt specks */}
        <g fill="#5C4530" opacity="0.5">
          <circle cx="20" cy="40" r="2" /><circle cx="60" cy="120" r="1.5" /><circle cx="180" cy="50" r="2" /><circle cx="320" cy="130" r="1.5" /><circle cx="430" cy="40" r="2" /><circle cx="540" cy="100" r="1.8" /><circle cx="630" cy="50" r="1.5" /><circle cx="40" cy="200" r="1.8" /><circle cx="220" cy="220" r="1.5" /><circle cx="380" cy="190" r="2" /><circle cx="500" cy="220" r="1.5" /><circle cx="640" cy="200" r="1.8" /><circle cx="100" cy="300" r="1.5" /><circle cx="280" cy="320" r="1.8" /><circle cx="450" cy="290" r="1.5" /><circle cx="600" cy="320" r="2" /><circle cx="30" cy="400" r="1.5" /><circle cx="170" cy="380" r="2" /><circle cx="320" cy="400" r="1.5" /><circle cx="490" cy="380" r="1.8" /><circle cx="630" cy="400" r="1.5" /><circle cx="80" cy="490" r="1.8" /><circle cx="240" cy="470" r="1.5" /><circle cx="380" cy="490" r="1.8" /><circle cx="530" cy="470" r="1.5" /><circle cx="640" cy="490" r="2" /><circle cx="20" cy="580" r="1.5" /><circle cx="160" cy="560" r="2" /><circle cx="320" cy="580" r="1.5" /><circle cx="470" cy="560" r="1.8" /><circle cx="610" cy="580" r="1.5" /><circle cx="60" cy="650" r="1.8" /><circle cx="220" cy="640" r="1.5" /><circle cx="380" cy="660" r="1.8" /><circle cx="510" cy="640" r="1.5" /><circle cx="640" cy="660" r="2" /><circle cx="100" cy="730" r="1.5" /><circle cx="260" cy="750" r="1.8" /><circle cx="420" cy="730" r="1.5" /><circle cx="560" cy="750" r="1.8" /><circle cx="40" cy="820" r="2" /><circle cx="180" cy="800" r="1.5" /><circle cx="340" cy="820" r="1.8" /><circle cx="490" cy="800" r="1.5" /><circle cx="620" cy="820" r="2" /><circle cx="80" cy="900" r="1.5" /><circle cx="240" cy="920" r="1.8" /><circle cx="400" cy="900" r="1.5" /><circle cx="540" cy="920" r="1.8" /><circle cx="30" cy="980" r="1.8" /><circle cx="200" cy="980" r="1.5" /><circle cx="380" cy="980" r="2" /><circle cx="560" cy="980" r="1.5" />
        </g>

        {/* Light dirt specks */}
        <g fill="#A88863" opacity="0.55">
          <circle cx="50" cy="80" r="1.5" /><circle cx="150" cy="30" r="1.2" /><circle cx="280" cy="90" r="1.5" /><circle cx="400" cy="80" r="1.2" /><circle cx="520" cy="50" r="1.5" /><circle cx="600" cy="80" r="1.2" /><circle cx="120" cy="180" r="1.5" /><circle cx="280" cy="200" r="1.2" /><circle cx="440" cy="180" r="1.5" /><circle cx="580" cy="220" r="1.2" /><circle cx="60" cy="280" r="1.5" /><circle cx="220" cy="270" r="1.2" /><circle cx="370" cy="280" r="1.5" /><circle cx="520" cy="270" r="1.2" /><circle cx="640" cy="280" r="1.5" /><circle cx="100" cy="370" r="1.2" /><circle cx="260" cy="380" r="1.5" /><circle cx="400" cy="370" r="1.2" /><circle cx="560" cy="380" r="1.5" /><circle cx="30" cy="450" r="1.2" /><circle cx="200" cy="440" r="1.5" /><circle cx="340" cy="450" r="1.2" /><circle cx="500" cy="440" r="1.5" /><circle cx="600" cy="450" r="1.2" /><circle cx="60" cy="540" r="1.5" /><circle cx="240" cy="540" r="1.2" /><circle cx="400" cy="540" r="1.5" /><circle cx="560" cy="540" r="1.2" /><circle cx="120" cy="620" r="1.5" /><circle cx="280" cy="620" r="1.2" /><circle cx="440" cy="620" r="1.5" /><circle cx="600" cy="620" r="1.2" /><circle cx="40" cy="700" r="1.5" /><circle cx="200" cy="710" r="1.2" /><circle cx="360" cy="700" r="1.5" /><circle cx="520" cy="710" r="1.2" /><circle cx="640" cy="700" r="1.5" /><circle cx="100" cy="790" r="1.2" /><circle cx="260" cy="790" r="1.5" /><circle cx="420" cy="790" r="1.2" /><circle cx="580" cy="790" r="1.5" /><circle cx="40" cy="870" r="1.5" /><circle cx="180" cy="880" r="1.2" /><circle cx="340" cy="870" r="1.5" /><circle cx="500" cy="880" r="1.2" /><circle cx="640" cy="870" r="1.5" />
        </g>

        {/* Mounds (tappable) */}
        <g>
          {mounds.map(({ row, col, variant }) => {
            const key = `${row}-${col}`
            const pulled = pulledMounds.has(key)
            const x = COL_X[col]
            const y = ROW_Y[row]
            return (
              <g
                key={key}
                data-row={row}
                data-col={col}
                transform={`translate(${x},${y})`}
                onClick={() => !pulled && onMoundClick?.(row, col)}
                style={{ cursor: pulled ? 'default' : 'pointer' }}
              >
                <use href="#ff-mound-base" />
                {!pulled && <use href={`#ff-stalk-${variant}`} />}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
