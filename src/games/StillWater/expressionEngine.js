export { hex2rgb, rgb2hex, lighten, darken, mix } from '../../lib/colorUtils'

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
export const pos   = v => Math.max(0, v)
export const neg   = v => Math.max(0, -v)

export function calcExpr(valence = 0, arousal = 0, intensityT = 1, pupilTier = 1) {
  const sb2  = neg(valence) * pos(arousal) * 0.55
  const au1  = clamp(neg(valence) * (1 - pos(arousal) * 1.5) + sb2) * intensityT
  const au2  = clamp(pos(valence) * (0.3 + pos(arousal) * 0.7) + sb2 * 0.7) * intensityT
  const au4  = clamp(neg(valence) * 0.35 + neg(valence) * pos(arousal) * 0.75) * intensityT
  const au5  = clamp(pos(arousal) * 0.85) * intensityT
  const au43 = clamp(neg(arousal) * 0.7) * intensityT
  const au12 = clamp(pos(valence)) * intensityT
  const au15 = clamp(neg(valence) * neg(arousal) * 1.4) * intensityT
  const au20 = clamp(neg(valence) * pos(arousal) * 1.4) * intensityT
  const au25 = clamp(neg(valence) * pos(arousal) * 1.1) * intensityT
  const au27 = clamp(neg(valence) * pos(arousal) * 1.3) * intensityT

  const EYE_TOP = 83, H = 16
  const lidCov   = clamp(8 - au5 * 6 + au43 * 10, 1.5, 20)
  const lashY    = EYE_TOP + lidCov
  const lidR     = (H * H + lidCov * lidCov) / (2 * lidCov)
  const lidCtrlY = lashY + 3
  const lashLift = Math.max(0, (EYE_TOP + 8) - lashY)

  const lO = [60,  82 - au2 * 8  + au4 * 6 - sb2 * 20 - lashLift * 0.8]
  const lC = [76,  77 - au1 * 5  - au2 * 4 + au4 * 6 - sb2 * 16 - lashLift * 0.8]
  const lI = [90,  81 - au1 * 10 + au4 * 6 - sb2 * 18 - lashLift * 0.8]
  const rI = [110, 81 - au1 * 10 + au4 * 6 - sb2 * 18 - lashLift * 0.8]
  const rC = [124, 77 - au1 * 5  - au2 * 4 + au4 * 6 - sb2 * 16 - lashLift * 0.8]
  const rO = [140, 82 - au2 * 8  + au4 * 6 - sb2 * 20 - lashLift * 0.8]

  const cornerLX   = 82  - au20 * 10
  const cornerRX   = 118 + au20 * 10
  const cornerY    = 145 - au12 * 12 + au15 * 6  + au20 * intensityT * 10
  const mouthCtrlY = 149 + au12 * 12 - au15 * 8  - au20 * intensityT * 7

  const PT = [[5.5, 5.5, 5.5], [5.5, 5.5, 7.5], [5.5, 7.5, 9.5]]
  const iz     = Math.min(2, Math.max(0, Math.round(intensityT * 3) - 1))
  const pupilR = PT[Math.min(2, Math.max(0, pupilTier))][iz]

  return {
    au27, au25,
    lO, lC, lI, rI, rC, rO,
    lashY, lidCtrlY, lidR,
    cornerLX, cornerRX, cornerY, mouthCtrlY,
    pupilR,
    blushOpacity: clamp(0.28 + pos(valence) * 0.22),
    openMouth: valence > 0.62 && arousal > 0.62,
  }
}
