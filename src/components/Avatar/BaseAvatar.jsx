import { useId } from 'react'
import { SPECIES } from '../../lib/avatar-species'

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
// Gradient/filter/clip IDs are scoped per instance via useId.
//
// `skinColor` and `eyeColor` are ALWAYS the color source — species never
// overrides them. Species controls head shape, extras, and texture only.
//
// DOM order:
//   defs → dc-species-behind (ears/fins) → head ellipse
//   → dc-species-front (texture overlay + horns) → eyebrows/eyes
//   → nose/mouth (species or generic) → blush
export default function BaseAvatar({ skinColor = '#FDBCB4', eyeColor = '#4A90D9', size = 200, species = 'human' }) {
  const uid = useId().replace(/:/g, '')

  const speciesDef = SPECIES[species] ?? SPECIES.human
  const { headRx, headRy, texture, scaleMethod, textureOpacity } = speciesDef

  // Colors always come from the user's picker selection
  const skin     = skinColor
  const skinDark = darken(skin, 18)
  const skinLit  = lighten(skin, 18)
  const blush    = mix(skin, '#FF8FAB', 0.45)
  const mouthC   = darken(mix(skin, '#C06070', 0.5), 18)
  const iris     = eyeColor
  const irisDeep = darken(iris, 30)
  const irisLit  = lighten(iris, 35)

  const furFilterId  = `${uid}fur`
  const behindExtras = speciesDef.behind({ skin, skinLit, skinDark, furFilterId })
  const frontExtras  = speciesDef.front({ skin, skinLit, skinDark, furFilterId })
  const noseMouthItems = speciesDef.noseMouth
    ? speciesDef.noseMouth({ skin, skinLit, skinDark, mouthC })
    : null

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

        {/* Fur: diffuse+specular lighting on pelt noise, merged, clipped, then edge-displaced */}
        {texture === 'fur' && (
          <filter id={furFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.11 0.11" numOctaves="4" result="peltNoise" />
            <feDiffuseLighting in="peltNoise" lightingColor="#A9A9A9" surfaceScale="3" result="diffLight">
              <feDistantLight azimuth="225" elevation="60" />
            </feDiffuseLighting>
            <feSpecularLighting in="peltNoise" lightingColor="#ffffff" specularConstant="0.3" specularExponent="8" result="specLight">
              <fePointLight x="100" y="60" z="120" />
            </feSpecularLighting>
            <feMerge result="mergedLight">
              <feMergeNode in="diffLight" />
              <feMergeNode in="specLight" />
            </feMerge>
            <feComposite in="mergedLight" in2="SourceGraphic" operator="in" result="peltedBase" />
            <feTurbulence type="fractalNoise" baseFrequency="0.21" numOctaves="2" seed="15" result="shagNoise" />
            <feDisplacementMap in="peltedBase" in2="shagNoise" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        )}

        {/* Dragon arc scales: two offset Q-curve arcs per tile, stroke = skinDark */}
        {texture === 'scales' && scaleMethod === 'arcs' && (
          <pattern id={`${uid}scl`} x="0" y="0" width="14" height="10" patternUnits="userSpaceOnUse">
            <path d="M 0 10 Q 7 2 14 10" fill="none" stroke={skinDark} strokeWidth="1.4" opacity="0.7" />
            <path d="M -7 5 Q 0 -3 7 5"  fill="none" stroke={skinDark} strokeWidth="1.4" opacity="0.7" />
          </pattern>
        )}

        {/* Fish tile scales: filled arc paths with noise displacement */}
        {texture === 'scales' && scaleMethod === 'tile' && (
          <>
            <filter id={`${uid}stlf`} x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.08 0.04" numOctaves="2" seed="7" result="tileNoise" />
              <feDisplacementMap in="SourceGraphic" in2="tileNoise" scale="6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <pattern id={`${uid}stl`} x="0" y="0" width="18" height="13" patternUnits="userSpaceOnUse">
              <path d="M 0 13 Q 4 7 9 13 Q 13 7 18 13"
                    fill={skinDark} fillOpacity="0.18" stroke={skinDark} strokeWidth="0.9" opacity="0.8" />
              <path d="M -9 6 Q -4 0 1 6 Q 5 0 10 6 Q 14 0 19 6"
                    fill={skinDark} fillOpacity="0.12" stroke={skinDark} strokeWidth="0.7" opacity="0.6" />
            </pattern>
          </>
        )}

        {/* Clip scales pattern to the head ellipse */}
        {texture === 'scales' && (
          <clipPath id={`${uid}hclip`}>
            <ellipse cx="100" cy="105" rx={headRx} ry={headRy} />
          </clipPath>
        )}
      </defs>

      {/* dc-species-behind — ears / fins rendered under the head ellipse */}
      <g>
        {behindExtras.map(({ tag: Tag, key, ...attrs }) => (
          <Tag key={key} {...attrs} />
        ))}
      </g>

      {/* Head */}
      <ellipse cx="100" cy="105" rx={headRx} ry={headRy} fill={`url(#${uid}hG)`} />

      {/* dc-species-front — texture overlay + horns / face marks over the head */}
      <g>
        {texture === 'fur' && (
          <ellipse
            cx="100" cy="105" rx={headRx} ry={headRy}
            fill={skin} filter={`url(#${furFilterId})`}
            opacity={String(textureOpacity)}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {texture === 'scales' && scaleMethod === 'arcs' && (
          <ellipse
            cx="100" cy="105" rx={headRx} ry={headRy}
            fill={`url(#${uid}scl)`} clipPath={`url(#${uid}hclip)`}
            opacity="1.0"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {texture === 'scales' && scaleMethod === 'tile' && (
          <ellipse
            cx="100" cy="105" rx={headRx} ry={headRy}
            fill={`url(#${uid}stl)`} clipPath={`url(#${uid}hclip)`}
            filter={`url(#${uid}stlf)`}
            opacity="1.0"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {frontExtras.map(({ tag: Tag, key, ...attrs }) => (
          <Tag key={key} {...attrs} />
        ))}
      </g>

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

      {/* Nose / mouth — species override (wolf/cat) or generic */}
      {noseMouthItems ? (
        noseMouthItems.map(({ tag: Tag, key, ...attrs }) => (
          <Tag key={key} {...attrs} />
        ))
      ) : (
        <path
          d="M 82 145 Q 100 149 118 145"
          stroke={mouthC} strokeWidth="2.2" fill="none" strokeLinecap="round"
        />
      )}

      {/* Blush */}
      <ellipse cx="62"  cy="120" rx="16" ry="8" fill={blush} opacity="0.42" filter={`url(#${uid}blur)`} />
      <ellipse cx="138" cy="120" rx="16" ry="8" fill={blush} opacity="0.42" filter={`url(#${uid}blur)`} />
    </svg>
  )
}
