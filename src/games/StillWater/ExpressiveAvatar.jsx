import { useId } from 'react'
import { calcExpr } from './expressionEngine'
import { darken, lighten, mix } from '../../lib/colorUtils'

export default function ExpressiveAvatar({
  skinColor = '#FDBCB4',
  eyeColor  = '#4A90D9',
  size      = 160,
  valence   = 0,
  arousal   = 0,
  intensityT = 1,
  pupilTier = 1,
  glowColor = null,
}) {
  const uid = useId().replace(/:/g, '')
  const sk = skinColor
  const skD = darken(sk, 18), skL = lighten(sk, 18)
  const bl  = mix(sk, '#FF8FAB', 0.45)
  const brC = darken(sk, 36)
  const mC  = darken(mix(sk, '#C06070', 0.5), 18)
  const ir  = eyeColor
  const irD = darken(ir, 30), irL = lighten(ir, 35)

  const ex = calcExpr(valence, arousal, intensityT, pupilTier)
  const f  = v => Number(v).toFixed(1)

  const lBD  = `M ${f(ex.lO[0])} ${f(ex.lO[1])} Q ${f(ex.lC[0])} ${f(ex.lC[1])} ${f(ex.lI[0])} ${f(ex.lI[1])}`
  const rBD  = `M ${f(ex.rI[0])} ${f(ex.rI[1])} Q ${f(ex.rC[0])} ${f(ex.rC[1])} ${f(ex.rO[0])} ${f(ex.rO[1])}`
  const lLD  = `M 60 ${f(ex.lashY)} Q 76 ${f(ex.lidCtrlY)} 92 ${f(ex.lashY)} A ${f(ex.lidR)} ${f(ex.lidR)} 0 0 0 60 ${f(ex.lashY)} Z`
  const rLD  = `M 108 ${f(ex.lashY)} Q 124 ${f(ex.lidCtrlY)} 140 ${f(ex.lashY)} A ${f(ex.lidR)} ${f(ex.lidR)} 0 0 0 108 ${f(ex.lashY)} Z`
  const lLaD = `M 60 ${f(ex.lashY)} Q 76 ${f(ex.lidCtrlY)} 92 ${f(ex.lashY)}`
  const rLaD = `M 108 ${f(ex.lashY)} Q 124 ${f(ex.lidCtrlY)} 140 ${f(ex.lashY)}`
  const mD   = `M ${f(ex.cornerLX)} ${f(ex.cornerY)} Q 100 ${f(ex.mouthCtrlY)} ${f(ex.cornerRX)} ${f(ex.cornerY)}`
  const oD   = `M ${f(ex.cornerLX + 4)} ${f(ex.cornerY)} Q 100 ${f(ex.mouthCtrlY + 9)} ${f(ex.cornerRX - 4)} ${f(ex.cornerY)}`

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
      </defs>

      {glowColor && <ellipse cx="100" cy="105" rx="69" ry="73" fill="none" stroke={glowColor} strokeWidth="6" opacity="0.22" />}
      <ellipse cx="100" cy="105" rx="64" ry="68" fill={`url(#${uid}h)`} />

      {/* Left eye */}
      <circle cx="76" cy="100" r="17" fill={`url(#${uid}s)`} filter={`url(#${uid}sh)`} />
      <circle cx="76" cy="101" r="12" fill={`url(#${uid}i)`} clipPath={`url(#${uid}lc)`} />
      <circle cx="76" cy="101" r={f(ex.pupilR)} fill="#0D0D0D" clipPath={`url(#${uid}lc)`} />
      <circle cx="70" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="79" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d={lLD}  fill={sk} />
      <path d={lLaD} stroke={skD} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Right eye */}
      <circle cx="124" cy="100" r="17" fill={`url(#${uid}s)`} filter={`url(#${uid}sh)`} />
      <circle cx="124" cy="101" r="12" fill={`url(#${uid}i)`} clipPath={`url(#${uid}rc)`} />
      <circle cx="124" cy="101" r={f(ex.pupilR)} fill="#0D0D0D" clipPath={`url(#${uid}rc)`} />
      <circle cx="118" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="127" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d={rLD}  fill={sk} />
      <path d={rLaD} stroke={skD} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Mouth */}
      {ex.au27 <= 0.28 && !ex.openMouth && (
        <path d={mD} stroke={mC} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
      {ex.au25 > 0.1 && ex.au27 <= 0.28 && (
        <ellipse cx="100" cy={f(ex.cornerY + 2)} rx={f(8 + ex.au25 * 6)} ry={f(ex.au25 * 2.5)} fill={darken(mC, 15)} opacity={Math.min(0.7, ex.au25 * 0.9)} />
      )}
      {ex.au27 > 0.28 && (() => {
        const cy2 = ex.cornerY + 4 + ex.au27 * 6
        const rx = 8 + ex.au27 * 11, ry = 3 + ex.au27 * 12
        return <>
          <ellipse cx="100" cy={cy2} rx={rx} ry={ry} fill={darken(mC, 20)} opacity={Math.min(1, ex.au27 * 1.5)} />
          <ellipse cx="100" cy={cy2} rx={rx} ry={ry} fill="none" stroke={mC} strokeWidth="1.5" opacity={Math.min(1, ex.au27 * 1.5)} />
        </>
      })()}
      {ex.openMouth && <path d={oD} fill={darken(mC, 8)} opacity="0.9" />}

      {/* Blush */}
      <ellipse cx="62"  cy="120" rx="16" ry="8" fill={bl} opacity={f(ex.blushOpacity)} filter={`url(#${uid}b)`} />
      <ellipse cx="138" cy="120" rx="16" ry="8" fill={bl} opacity={f(ex.blushOpacity)} filter={`url(#${uid}b)`} />

      {/* Brows */}
      <path d={lBD} stroke={brC} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.88" />
      <path d={rBD} stroke={brC} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.88" />
    </svg>
  )
}
