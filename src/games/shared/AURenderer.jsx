import { useId } from 'react'
import { darken, lighten, mix } from '../../lib/colorUtils'
import { NEUTRAL_POS } from './expressionTable'
import { drawHairBack, drawHairFront } from '../../assets/hair/hairDraw'
import { HAIR_BACK_STYLES } from '../../assets/hair/hairStyles'

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const LID_TOP_Y = 83

export default function AURenderer({
  position  = NEUTRAL_POS,
  glowColor = null,
  size      = 148,
  skinColor = '#FDBCB4',
  eyeColor  = '#4A90D9',
  hairStyle = 'none',
  hairColor = '#784421',
}) {
  const uid = useId().replace(/:/g, '')

  const SK  = skinColor, IR = eyeColor
  const SKD = darken(SK, 18),  SKL = lighten(SK, 18)
  const BL  = mix(SK, '#FF8FAB', 0.45)
  const BRC = darken(SK, 36)
  const MC  = darken(mix(SK, '#C06070', 0.5), 18)
  const IRD = darken(IR, 30),  IRL = lighten(IR, 35)
  const { au1, au2, au4, au5, au12, au15, au20, au27, au43, sb2, mouthType, pupilTier, blush, it } = position
  const f = v => Number(v).toFixed(1)

  // Lid geometry — lid top anchored at LID_TOP_Y=83, ±19 wide
  const H   = 16
  const lc  = clamp(8 - au5 * 6 + au43 * 14, 1.5, 28)
  const ly  = LID_TOP_Y + lc
  const lcy = ly + 4
  const ll  = Math.max(0, (LID_TOP_Y + 8) - ly)

  // Brow point arrays [x, y]
  const lO = [60,  82 - au2 * 8  + au4 * 6 - sb2 * 20 - ll * 0.8]
  const lC = [76,  77 - au1 * 5  - au2 * 4 + au4 * 6 - sb2 * 16 - ll * 0.8]
  const lI = [90,  81 - au1 * 10 + au4 * 6 - sb2 * 18 - ll * 0.8]
  const rI = [110, 81 - au1 * 10 + au4 * 6 - sb2 * 18 - ll * 0.8]
  const rC = [124, 77 - au1 * 5  - au2 * 4 + au4 * 6 - sb2 * 16 - ll * 0.8]
  const rO = [140, 82 - au2 * 8  + au4 * 6 - sb2 * 20 - ll * 0.8]

  // Mouth geometry
  const cLX = 82  - au20 * 10
  const cRX = 118 + au20 * 10
  const cY  = 145 - au12 * 12 + au15 * 6 + au20 * it * 6
  const mCY = 149 + au12 * 12 - au15 * 8 - au20 * it * 4

  // Pupil radius from tier × intensity
  const PT = [[5.5, 5.5, 5.5], [5.5, 5.5, 7.5], [5.5, 7.5, 9.5]]
  const iz = Math.min(2, Math.max(0, Math.round(it * 3) - 1))
  const pR = PT[Math.min(2, Math.max(0, pupilTier))][iz]

  const bl = clamp(blush)

  // Eyelid path: top fixed at y=83, bottom at ly; ±19 wide around center cp
  const lidPath  = cp => `M${cp - 19} 83 Q${cp} 80 ${cp + 19} 83 L${cp + 19} ${f(ly)} Q${cp} ${f(lcy)} ${cp - 19} ${f(ly)} Z`
  const lashPath = cp => `M${cp + 19} ${f(ly)} Q${cp} ${f(lcy)} ${cp - 19} ${f(ly)}`

  const mD = `M${f(cLX)} ${f(cY)} Q100 ${f(mCY)} ${f(cRX)} ${f(cY)}`

  function mouth() {
    if (mouthType === 'alert' && au27 > 0) {
      const cy2 = cY + 2 + au27 * 4
      const rx = 8 + au27 * 11, ry = 3 + au27 * 10
      const op = f(Math.min(1, au27 * 1.5))
      return <>
        <ellipse cx="100" cy={f(cy2)} rx={f(rx)} ry={f(ry)} fill={darken(MC, 20)} opacity={op} />
        <ellipse cx="100" cy={f(cy2)} rx={f(rx)} ry={f(ry)} fill="none" stroke={MC} strokeWidth="1.5" opacity={op} />
      </>
    }
    if (mouthType === 'excited') {
      const eScale = au27 || au12
      return <path d={`M${f(cLX + 4)} ${f(cY)} Q100 ${f(mCY + 9 * eScale)} ${f(cRX - 4)} ${f(cY)}`}
               fill={darken(MC, 8)} opacity={f(Math.max(0.15, 0.75 * eScale))} />
    }
    if (mouthType === 'tense') {
      return <path d={`M${f(cLX + 4)} ${f(cY)} Q100 ${f(cY - 12 * au27)} ${f(cRX - 4)} ${f(cY)}`}
               fill={darken(MC, 8)} opacity={f(Math.max(0.15, 0.75 * au27))} />
    }
    return <path d={mD} stroke={MC} strokeWidth="2.2" fill="none" strokeLinecap="round" />
  }

  return (
    <svg viewBox="0 0 200 185" width={size} height={size} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`${uid}h`} cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor={SKL} />
          <stop offset="60%"  stopColor={SK} />
          <stop offset="100%" stopColor={SKD} />
        </radialGradient>
        <radialGradient id={`${uid}i`} cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor={IRL} />
          <stop offset="55%"  stopColor={IR} />
          <stop offset="100%" stopColor={IRD} />
        </radialGradient>
        <radialGradient id={`${uid}s`} cx="40%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#fff" />
          <stop offset="100%" stopColor="#F0EBE8" />
        </radialGradient>
        <filter id={`${uid}b`}><feGaussianBlur stdDeviation="1.2" /></filter>
      </defs>

      {glowColor && <ellipse cx="100" cy="105" rx="69" ry="73" fill="none" stroke={glowColor} strokeWidth="6" opacity="0.22" />}
      {hairStyle !== 'none' && HAIR_BACK_STYLES.includes(hairStyle) && (
        <g key={`hb-${hairStyle}-${hairColor}`}
           ref={el => {
             if (!el) return
             while (el.firstChild) el.removeChild(el.firstChild)
             drawHairBack(el, hairStyle, hairColor, hairColor)
           }} />
      )}
      <ellipse cx="100" cy="105" rx="64" ry="68" fill={`url(#${uid}h)`} />

      {/* Left eye — shadow circle offset by 1px for Safari-safe depth */}
      <circle cx="76" cy="101" r="18" fill={SKD} opacity="0.13" />
      <circle cx="76" cy="100" r="17" fill={`url(#${uid}s)`} />
      <circle cx="76" cy="101" r="12" fill={`url(#${uid}i)`} />
      <circle cx="76" cy="101" r={f(pR)} fill="#0D0D0D" />
      <circle cx="70" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="79" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d={lidPath(76)}  fill={SK} />
      <path d={lashPath(76)} stroke={SKD} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Right eye */}
      <circle cx="124" cy="101" r="18" fill={SKD} opacity="0.13" />
      <circle cx="124" cy="100" r="17" fill={`url(#${uid}s)`} />
      <circle cx="124" cy="101" r="12" fill={`url(#${uid}i)`} />
      <circle cx="124" cy="101" r={f(pR)} fill="#0D0D0D" />
      <circle cx="118" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="127" cy="108" r="1.8" fill="white" opacity="0.65" />
      <path d={lidPath(124)}  fill={SK} />
      <path d={lashPath(124)} stroke={SKD} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {mouth()}

      {/* Blush */}
      <ellipse cx="62"  cy="120" rx="16" ry="8" fill={BL} opacity={f(bl)} filter={`url(#${uid}b)`} />
      <ellipse cx="138" cy="120" rx="16" ry="8" fill={BL} opacity={f(bl)} filter={`url(#${uid}b)`} />

      {/* Brows */}
      <path d={`M${f(lO[0])} ${f(lO[1])} Q${f(lC[0])} ${f(lC[1])} ${f(lI[0])} ${f(lI[1])}`} stroke={BRC} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.88" />
      <path d={`M${f(rI[0])} ${f(rI[1])} Q${f(rC[0])} ${f(rC[1])} ${f(rO[0])} ${f(rO[1])}`} stroke={BRC} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.88" />
      {hairStyle !== 'none' && (
        <g key={`hf-${hairStyle}-${hairColor}`}
           ref={el => {
             if (!el) return
             while (el.firstChild) el.removeChild(el.firstChild)
             drawHairFront(el, hairStyle, hairColor, hairColor, `hf${el._uid || (el._uid = Math.random().toString(36).slice(2, 6))}`)
           }} />
      )}
    </svg>
  )
}
