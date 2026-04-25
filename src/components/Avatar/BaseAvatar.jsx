import { useId } from 'react'

// ── Color utilities ───────────────────────────────────────────────────────
function hex2rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgb2hex(r, g, b) {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
}
function lighten(hex, amt) {
  const [r, g, b] = hex2rgb(hex)
  return rgb2hex(r + amt, g + amt, b + amt)
}
function darken(hex, amt) {
  return lighten(hex, -amt)
}
function mix(a, b, t) {
  const [r1, g1, b1] = hex2rgb(a)
  const [r2, g2, b2] = hex2rgb(b)
  return rgb2hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

// ── Palettes ──────────────────────────────────────────────────────────────
export const SKIN_COLORS = [
  { hex: '#FFEEE8', label: 'Porcelain' },
  { hex: '#FDBCB4', label: 'Peach' },
  { hex: '#F5CBA7', label: 'Sand' },
  { hex: '#E8B08A', label: 'Honey' },
  { hex: '#C68642', label: 'Caramel' },
  { hex: '#8D5524', label: 'Chestnut' },
  { hex: '#4A2912', label: 'Espresso' },
  { hex: '#D4B8E0', label: 'Lavender' },
  { hex: '#A8D8EA', label: 'Sky' },
  { hex: '#B5EAD7', label: 'Mint' },
  { hex: '#FFD6A5', label: 'Buttercup' },
  { hex: '#C9B1D0', label: 'Dusk' },
  { hex: '#8ECAE6', label: 'Ocean' },
  { hex: '#95D5B2', label: 'Jade' },
  { hex: '#E8C1C1', label: 'Rose' },
  { hex: '#BDE0FE', label: 'Periwinkle' },
]

export const EYE_COLORS = [
  { hex: '#6B4F3A', label: 'Warm Brown' },
  { hex: '#3D2B1F', label: 'Dark Brown' },
  { hex: '#8B7355', label: 'Hazel' },
  { hex: '#4A90D9', label: 'Sky Blue' },
  { hex: '#1C5FA0', label: 'Deep Blue' },
  { hex: '#4A8B5A', label: 'Forest' },
  { hex: '#2D6A4F', label: 'Dark Green' },
  { hex: '#7B4FCF', label: 'Purple' },
  { hex: '#FFBF00', label: 'Amber' },
  { hex: '#CC2200', label: 'Red' },
  { hex: '#00897B', label: 'Teal' },
  { hex: '#F06292', label: 'Pink' },
  { hex: '#546E7A', label: 'Steel' },
  { hex: '#8B008B', label: 'Violet' },
  { hex: '#FF8C00', label: 'Ember' },
  { hex: '#2E7D32', label: 'Moss' },
]

// ── BaseAvatar ────────────────────────────────────────────────────────────
// Pure SVG component. Safe at any size — 36px in header, 160px on profile.
// Gradient/filter/clip IDs are scoped per instance via useId to avoid
// collisions when multiple avatars appear on the same page.
export default function BaseAvatar({ skinColor = '#FDBCB4', eyeColor = '#4A90D9', size = 200 }) {
  const uid = useId().replace(/:/g, '')

  const skin     = skinColor
  const skinDark = darken(skin, 18)
  const skinLit  = lighten(skin, 18)
  const blush    = mix(skin, '#FF8FAB', 0.45)
  const iris     = eyeColor
  const irisDeep = darken(eyeColor, 30)
  const irisLit  = lighten(eyeColor, 35)

  return (
    <svg
      viewBox="0 0 200 185"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id={`${uid}hG`} cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor={skinLit} />
          <stop offset="60%"  stopColor={skin} />
          <stop offset="100%" stopColor={skinDark} />
        </radialGradient>
        <radialGradient id={`${uid}iG`} cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor={irisLit} />
          <stop offset="55%"  stopColor={iris} />
          <stop offset="100%" stopColor={irisDeep} />
        </radialGradient>
        <radialGradient id={`${uid}sG`} cx="40%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="100%" stopColor="#F0EBE8" />
        </radialGradient>
        <filter id={`${uid}blur`}>
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id={`${uid}shad`}>
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={skinDark} floodOpacity="0.25" />
        </filter>
        <clipPath id={`${uid}lc`}>
          <circle cx="76" cy="100" r="17" />
        </clipPath>
        <clipPath id={`${uid}rc`}>
          <circle cx="124" cy="100" r="17" />
        </clipPath>
      </defs>

      {/* Head */}
      <ellipse cx="100" cy="105" rx="64" ry="68" fill={`url(#${uid}hG)`} />

      {/* Eyebrows */}
      <path d="M 60 82 Q 76 77 90 81"  stroke={skinDark} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.65" />
      <path d="M 110 81 Q 124 77 140 82" stroke={skinDark} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.65" />

      {/* Eye left */}
      <circle cx="76" cy="100" r="17" fill={`url(#${uid}sG)`} filter={`url(#${uid}shad)`} />
      <circle cx="76" cy="101" r="12" fill={`url(#${uid}iG)`} clipPath={`url(#${uid}lc)`} />
      <circle cx="76" cy="101" r="7"  fill="#0D0D0D"           clipPath={`url(#${uid}lc)`} />
      <circle cx="70" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="79" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d="M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z" fill={skin} />
      <path d="M 60 91 Q 76 94 92 91" stroke={skinDark} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Eye right */}
      <circle cx="124" cy="100" r="17" fill={`url(#${uid}sG)`} filter={`url(#${uid}shad)`} />
      <circle cx="124" cy="101" r="12" fill={`url(#${uid}iG)`} clipPath={`url(#${uid}rc)`} />
      <circle cx="124" cy="101" r="7"  fill="#0D0D0D"            clipPath={`url(#${uid}rc)`} />
      <circle cx="118" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="127" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d="M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z" fill={skin} />
      <path d="M 108 91 Q 124 94 140 91" stroke={skinDark} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Mouth */}
      <path
        d="M 82 145 Q 100 149 118 145"
        stroke={darken(mix(skin, '#C06070', 0.5), 18)}
        strokeWidth="2.2" fill="none" strokeLinecap="round"
      />

      {/* Blush */}
      <ellipse cx="62"  cy="120" rx="16" ry="8" fill={blush} opacity="0.42" filter={`url(#${uid}blur)`} />
      <ellipse cx="138" cy="120" rx="16" ry="8" fill={blush} opacity="0.42" filter={`url(#${uid}blur)`} />
    </svg>
  )
}
