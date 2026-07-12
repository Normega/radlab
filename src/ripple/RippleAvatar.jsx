import { useId } from 'react'
import { calcExpr } from '../games/StillWater/expressionEngine'
import { darken, lighten, mix } from '../lib/colorUtils'
import { SPECIES } from '../lib/avatar-species'
import { drawHairBack, drawHairFront } from '../assets/hair/hairDraw'
import { HAIR_BACK_STYLES } from '../assets/hair/hairStyles'

// ── RippleAvatar ──────────────────────────────────────────────────────────────
// Unified Ripple renderer (WP2). Merges:
//   • ExpressiveAvatar's FACS expression engine (valence/arousal drive face)
//   • BaseAvatar's species system (ears, texture, head shape)
//   • BaseAvatar's hair layers (back + front)
//
// At neutral (valence=0, arousal=0) the face is visually identical to BaseAvatar.
// FaceRead and StillWater still import ExpressiveAvatar directly — this component
// does not replace them; it replaces BaseAvatar in static/ambient contexts
// (header, profile, wall, editor preview).
//
// Props:
//   skinColor, eyeColor, size     — appearance (same as BaseAvatar / ExpressiveAvatar)
//   species, hairStyle, hairColor — unlock cosmetics (same as BaseAvatar)
//   valence, arousal              — FACS expression (−1…1; default 0 = neutral)
//   intensityT, pupilTier         — FACS expression tuning
//   glowColor                     — optional inline ambient glow (null = none)

export default function RippleAvatar({
  skinColor  = '#FDBCB4',
  eyeColor   = '#4A90D9',
  size       = 200,
  species    = 'human',
  hairStyle  = 'none',
  hairColor  = '#784421',
  valence    = 0,
  arousal    = 0,
  intensityT = 1,
  pupilTier  = 1,
  glowColor  = null,
}) {
  const uid = useId().replace(/:/g, '')

  const speciesDef = SPECIES[species] ?? SPECIES.human
  const { headRx, headRy, texture, scaleMethod, textureOpacity } = speciesDef

  const sk  = skinColor
  const skD = darken(sk, 18)
  const skL = lighten(sk, 18)
  const bl  = mix(sk, '#FF8FAB', 0.45)
  const brC = darken(sk, 36)
  const mC  = darken(mix(sk, '#C06070', 0.5), 18)
  const ir  = eyeColor
  const irD = darken(ir, 30)
  const irL = lighten(ir, 35)

  const ex = calcExpr(valence, arousal, intensityT, pupilTier)
  const f  = v => Number(v).toFixed(1)

  // FACS brow paths
  const lBD  = `M ${f(ex.lO[0])} ${f(ex.lO[1])} Q ${f(ex.lC[0])} ${f(ex.lC[1])} ${f(ex.lI[0])} ${f(ex.lI[1])}`
  const rBD  = `M ${f(ex.rI[0])} ${f(ex.rI[1])} Q ${f(ex.rC[0])} ${f(ex.rC[1])} ${f(ex.rO[0])} ${f(ex.rO[1])}`
  // FACS eyelid paths
  const lLD  = `M 60 ${f(ex.lashY)} Q 76 ${f(ex.lidCtrlY)} 92 ${f(ex.lashY)} A ${f(ex.lidR)} ${f(ex.lidR)} 0 0 0 60 ${f(ex.lashY)} Z`
  const rLD  = `M 108 ${f(ex.lashY)} Q 124 ${f(ex.lidCtrlY)} 140 ${f(ex.lashY)} A ${f(ex.lidR)} ${f(ex.lidR)} 0 0 0 108 ${f(ex.lashY)} Z`
  const lLaD = `M 60 ${f(ex.lashY)} Q 76 ${f(ex.lidCtrlY)} 92 ${f(ex.lashY)}`
  const rLaD = `M 108 ${f(ex.lashY)} Q 124 ${f(ex.lidCtrlY)} 140 ${f(ex.lashY)}`
  // FACS mouth paths
  const mD   = `M ${f(ex.cornerLX)} ${f(ex.cornerY)} Q 100 ${f(ex.mouthCtrlY)} ${f(ex.cornerRX)} ${f(ex.cornerY)}`
  const oD   = `M ${f(ex.cornerLX + 4)} ${f(ex.cornerY)} Q 100 ${f(ex.mouthCtrlY + 9)} ${f(ex.cornerRX - 4)} ${f(ex.cornerY)}`

  const needsBack   = HAIR_BACK_STYLES.includes(hairStyle)
  const furFilterId = `${uid}fur`
  const behindExtras = speciesDef.behind({ skin: sk, skinLit: skL, skinDark: skD, furFilterId })
  const frontExtras  = speciesDef.front({ skin: sk, skinLit: skL, skinDark: skD, furFilterId })

  return (
    <svg viewBox="0 0 200 185" xmlns="http://www.w3.org/2000/svg" width={size} height={size} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`${uid}h`} cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor={skL} />
          <stop offset="60%"  stopColor={sk} />
          <stop offset="100%" stopColor={skD} />
        </radialGradient>
        <radialGradient id={`${uid}i`} cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor={irL} />
          <stop offset="55%"  stopColor={ir} />
          <stop offset="100%" stopColor={irD} />
        </radialGradient>
        <radialGradient id={`${uid}s`} cx="40%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#fff" />
          <stop offset="100%" stopColor="#F0EBE8" />
        </radialGradient>
        <filter id={`${uid}b`}><feGaussianBlur stdDeviation="1.2" /></filter>
        <filter id={`${uid}sh`}><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={skD} floodOpacity="0.25" /></filter>
        <clipPath id={`${uid}lc`}><circle cx="76"  cy="100" r="17" /></clipPath>
        <clipPath id={`${uid}rc`}><circle cx="124" cy="100" r="17" /></clipPath>

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
        {texture === 'scales' && scaleMethod === 'arcs' && (
          <pattern id={`${uid}scl`} x="0" y="0" width="14" height="10" patternUnits="userSpaceOnUse">
            <path d="M 0 10 Q 7 2 14 10" fill="none" stroke={skD} strokeWidth="1.4" opacity="0.7" />
            <path d="M -7 5 Q 0 -3 7 5"  fill="none" stroke={skD} strokeWidth="1.4" opacity="0.7" />
          </pattern>
        )}
        {texture === 'scales' && scaleMethod === 'tile' && (
          <>
            <filter id={`${uid}stlf`} x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.08 0.04" numOctaves="2" seed="7" result="tileNoise" />
              <feDisplacementMap in="SourceGraphic" in2="tileNoise" scale="6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <pattern id={`${uid}stl`} x="0" y="0" width="18" height="13" patternUnits="userSpaceOnUse">
              <path d="M 0 13 Q 4 7 9 13 Q 13 7 18 13" fill={skD} fillOpacity="0.18" stroke={skD} strokeWidth="0.9" opacity="0.8" />
              <path d="M -9 6 Q -4 0 1 6 Q 5 0 10 6 Q 14 0 19 6" fill={skD} fillOpacity="0.12" stroke={skD} strokeWidth="0.7" opacity="0.6" />
            </pattern>
          </>
        )}
        {texture === 'scales' && (
          <clipPath id={`${uid}hclip`}>
            <ellipse cx="100" cy="105" rx={headRx} ry={headRy} />
          </clipPath>
        )}
      </defs>

      {glowColor && (
        <ellipse cx="100" cy="105" rx={headRx + 5} ry={headRy + 5}
          fill="none" stroke={glowColor} strokeWidth="6" opacity="0.22" />
      )}

      {/* Hair back — behind everything */}
      {hairStyle !== 'none' && needsBack && (
        <g key={`hb-${hairStyle}-${hairColor}`}
           ref={el => {
             if (!el) return
             while (el.firstChild) el.removeChild(el.firstChild)
             drawHairBack(el, hairStyle, hairColor, hairColor)
           }} />
      )}

      {/* Species behind (ears, fins) */}
      <g>
        {behindExtras.map(({ tag: Tag, key, ...attrs }) => (
          <Tag key={key} {...attrs} />
        ))}
      </g>

      {/* Head */}
      <ellipse cx="100" cy="105" rx={headRx} ry={headRy} fill={`url(#${uid}h)`} />

      {/* Species front (texture overlay, horns) */}
      <g style={{ pointerEvents: 'none' }}>
        {texture === 'fur' && (
          <ellipse cx="100" cy="105" rx={headRx} ry={headRy}
            fill={sk} filter={`url(#${furFilterId})`}
            opacity={String(textureOpacity)}
          />
        )}
        {texture === 'scales' && scaleMethod === 'arcs' && (
          <ellipse cx="100" cy="105" rx={headRx} ry={headRy}
            fill={`url(#${uid}scl)`} clipPath={`url(#${uid}hclip)`}
          />
        )}
        {texture === 'scales' && scaleMethod === 'tile' && (
          <ellipse cx="100" cy="105" rx={headRx} ry={headRy}
            fill={`url(#${uid}stl)`} clipPath={`url(#${uid}hclip)`}
            filter={`url(#${uid}stlf)`}
          />
        )}
        {frontExtras.map(({ tag: Tag, key, ...attrs }) => (
          <Tag key={key} {...attrs} />
        ))}
      </g>

      {/* Left eye (FACS) */}
      <circle cx="76" cy="100" r="17" fill={`url(#${uid}s)`} filter={`url(#${uid}sh)`} />
      <circle cx="76" cy="101" r="12" fill={`url(#${uid}i)`} clipPath={`url(#${uid}lc)`} />
      <circle cx="76" cy="101" r={f(ex.pupilR)} fill="#0D0D0D" clipPath={`url(#${uid}lc)`} />
      <circle cx="70" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="79" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d={lLD}  fill={sk} />
      <path d={lLaD} stroke={skD} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Right eye (FACS) */}
      <circle cx="124" cy="100" r="17" fill={`url(#${uid}s)`} filter={`url(#${uid}sh)`} />
      <circle cx="124" cy="101" r="12" fill={`url(#${uid}i)`} clipPath={`url(#${uid}rc)`} />
      <circle cx="124" cy="101" r={f(ex.pupilR)} fill="#0D0D0D" clipPath={`url(#${uid}rc)`} />
      <circle cx="118" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="127" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d={rLD}  fill={sk} />
      <path d={rLaD} stroke={skD} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Mouth (FACS) */}
      {ex.au27 <= 0.28 && !ex.openMouth && (
        <path d={mD} stroke={mC} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
      {ex.au25 > 0.1 && ex.au27 <= 0.28 && (
        <ellipse cx="100" cy={f(ex.cornerY + 2)}
          rx={f(8 + ex.au25 * 6)} ry={f(ex.au25 * 2.5)}
          fill={darken(mC, 15)} opacity={Math.min(0.7, ex.au25 * 0.9)}
        />
      )}
      {ex.au27 > 0.28 && (() => {
        const cy2 = ex.cornerY + 2 + ex.au27 * 4
        const rx = 8 + ex.au27 * 11, ry = 3 + ex.au27 * 10
        return <>
          <ellipse cx="100" cy={cy2} rx={rx} ry={ry} fill={darken(mC, 20)} opacity={Math.min(1, ex.au27 * 1.5)} />
          <ellipse cx="100" cy={cy2} rx={rx} ry={ry} fill="none" stroke={mC} strokeWidth="1.5" opacity={Math.min(1, ex.au27 * 1.5)} />
        </>
      })()}
      {ex.openMouth && <path d={oD} fill={darken(mC, 8)} opacity="0.9" />}

      {/* Blush (FACS — variable opacity) */}
      <ellipse cx="62"  cy="120" rx="16" ry="8" fill={bl} opacity={f(ex.blushOpacity)} filter={`url(#${uid}b)`} />
      <ellipse cx="138" cy="120" rx="16" ry="8" fill={bl} opacity={f(ex.blushOpacity)} filter={`url(#${uid}b)`} />

      {/* Brows (FACS — variable position) */}
      <path d={lBD} stroke={brC} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.88" />
      <path d={rBD} stroke={brC} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.88" />

      {/* Hair front — over face */}
      {hairStyle !== 'none' && (
        <g key={`hf-${hairStyle}-${hairColor}`}
           ref={el => {
             if (!el) return
             while (el.firstChild) el.removeChild(el.firstChild)
             drawHairFront(el, hairStyle, hairColor, hairColor,
               `hf${el._uid || (el._uid = Math.random().toString(36).slice(2, 6))}`)
           }} />
      )}
    </svg>
  )
}
