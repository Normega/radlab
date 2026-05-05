export const CX = 185, CY = 185, INNER_R = 46, OUTER_R = 168, LABEL_R = 116
const GAP = 1.4

export const EMOTIONS = [
  { id: 0, name: 'Alert',   valence: -0.85, arousal:  0.82, pupilTier: 2, startAngle: 247.5 + GAP, endAngle: 292.5 - GAP, inner: '#F0D2D2', outer: '#B82222' },
  { id: 1, name: 'Excited', valence:  0.88, arousal:  0.88, pupilTier: 2, startAngle: 292.5 + GAP, endAngle: 337.5 - GAP, inner: '#FFF0B8', outer: '#D88000' },
  { id: 2, name: 'Good',    valence:  0.72, arousal:  0.45, pupilTier: 1, startAngle: 337.5 + GAP, endAngle:  22.5 - GAP, inner: '#FEFCD0', outer: '#C4A000' },
  { id: 3, name: 'Calm',    valence:  0.80, arousal:  0.08, pupilTier: 0, startAngle:  22.5 + GAP, endAngle:  67.5 - GAP, inner: '#FFE4C0', outer: '#DC6E2E' },
  { id: 4, name: 'Still',   valence:  0.00, arousal: -0.65, pupilTier: 0, startAngle:  67.5 + GAP, endAngle: 112.5 - GAP, inner: '#D4F4E8', outer: '#1EA878' },
  { id: 5, name: 'Sad',     valence: -0.28, arousal: -0.88, pupilTier: 0, startAngle: 112.5 + GAP, endAngle: 157.5 - GAP, inner: '#DCE8F4', outer: '#4878B8' },
  { id: 6, name: 'Bad',     valence: -0.72, arousal: -0.48, pupilTier: 1, startAngle: 157.5 + GAP, endAngle: 202.5 - GAP, inner: '#C8C8E0', outer: '#384070' },
  { id: 7, name: 'Tense',   valence: -0.58, arousal:  0.35, pupilTier: 2, startAngle: 202.5 + GAP, endAngle: 247.5 - GAP, inner: '#E0C8DC', outer: '#804080' },
]

export const INTENSITY_LABELS = ['', 'mild', 'moderate', 'strong']

export const d2r = d => d * Math.PI / 180

export function wedgePath(sa, ea, r1, r2) {
  const end = ea < sa ? ea + 360 : ea
  const a1 = d2r(sa), a2 = d2r(end), lg = end - sa > 180 ? 1 : 0
  const x1s = CX + r1 * Math.cos(a1), y1s = CY + r1 * Math.sin(a1)
  const x2s = CX + r2 * Math.cos(a1), y2s = CY + r2 * Math.sin(a1)
  const x2e = CX + r2 * Math.cos(a2), y2e = CY + r2 * Math.sin(a2)
  const x1e = CX + r1 * Math.cos(a2), y1e = CY + r1 * Math.sin(a2)
  return [`M ${x1s.toFixed(1)} ${y1s.toFixed(1)}`, `L ${x2s.toFixed(1)} ${y2s.toFixed(1)}`,
          `A ${r2} ${r2} 0 ${lg} 1 ${x2e.toFixed(1)} ${y2e.toFixed(1)}`,
          `L ${x1e.toFixed(1)} ${y1e.toFixed(1)}`,
          `A ${r1} ${r1} 0 ${lg} 0 ${x1s.toFixed(1)} ${y1s.toFixed(1)} Z`].join(' ')
}

export function centerAngle(e) {
  const end = e.endAngle < e.startAngle ? e.endAngle + 360 : e.endAngle
  return (e.startAngle + end) / 2
}

// Phase 1 (Sad↔Excited): x=t, y=t
// Phase 2 (Calm↔Tense):  x=-t, y=t
export function computeRating(phase, emotionId, zone) {
  const t = (zone + 1) / 3
  if (phase === 1) {
    const sign = emotionId === 5 ? -1 : 1
    const ts = sign * t
    return { rating: Math.round(ts * 3 + 4), x: ts, y: ts }
  } else {
    const sign = emotionId === 3 ? -1 : 1
    const ts = sign * t
    return { rating: Math.round(ts * 3 + 4), x: -ts, y: ts }
  }
}

export function getCompositeLabel(cx, cy) {
  if (Math.sqrt(cx * cx + cy * cy) < 0.15) return 'neutral'
  const ang = ((Math.atan2(cy, cx) * 180 / Math.PI) % 360 + 360) % 360
  return ['Good', 'Excited', 'Alert', 'Tense', 'Bad', 'Sad', 'Still', 'Calm'][Math.round(ang / 45) % 8]
}

export const LABEL_TO_ID = { Alert: 0, Excited: 1, Good: 2, Calm: 3, Still: 4, Sad: 5, Bad: 6, Tense: 7, neutral: -1 }
