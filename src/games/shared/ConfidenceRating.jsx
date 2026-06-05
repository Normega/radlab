import { useState } from 'react'
import AURenderer from './AURenderer'

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const ep = v => Math.max(0, v)
const en = v => Math.max(0, -v)

// Compute an AU position from valence/arousal using the exaggerated calcExpr diagonal.
// au43 threshold shifted to ar=0.3 (clamp((0.3−ar)/1.3)), ceiling 28 (au43*14 in geom).
// All AU outputs are multiplied by ex=1.5 and clamped to 1.
function calcPos(va, ar) {
  const EX = 1.5
  const sb2 = en(va) * ep(ar) * 0.55
  const raw = {
    au1:  clamp(en(va) * (1 - ep(ar) * 1.5) + sb2),
    au2:  clamp(ep(va) * (0.3 + ep(ar) * 0.7) + sb2 * 0.7),
    au4:  clamp(en(va) * 0.35 + en(va) * ep(ar) * 0.75),
    au5:  clamp(ep(ar) * 0.85),
    au12: clamp(ep(va)),
    au15: clamp(en(va) * en(ar) * 1.4),
    au20: clamp(en(va) * ep(ar) * 1.4),
    au27: clamp(en(va) * ep(ar) * 1.3),
    au43: clamp((0.3 - ar) / 1.3, 0, 1),
    sb2,
  }
  const exaggerated = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Math.min(1, v * EX)])
  )
  return { ...exaggerated, mouthType: 'line', pupilTier: 1, blush: clamp(0.28 + ep(va) * 0.22), it: 1 }
}

// v4 confidence scale — 6 faces, expanded extremes.
// Faces 1 and 6 are hand-tuned direct params; 2–5 are calcPos-derived.
const POSITIONS = [
  // 1 — extreme uncertain: max brow furrow, lip corner depress, worried open mouth,
  //     wide pupils. mouthCyAdd moves oval up; mouthRyMult narrows it on y-axis.
  { au1:1.0, au2:0.5, au4:1.0, au5:0, au12:0, au15:0.9, au20:0.65, au27:0.88,
    au43:0, sb2:0.55, mouthType:'alert', pupilTier:2, blush:0.03, it:0.18,
    mouthCyAdd:-12, mouthRyMult:0.48 },
  // 2
  calcPos(-0.85, 0.1),
  // 3
  calcPos(-0.58, 0),
  // 4 — neutral + slight upward curve
  calcPos(0.12, -0.12),
  // 5
  calcPos(0.58, -0.27),
  // 6 — extreme certain: max smile, max squint (au43), open excited mouth, deep blush.
  { au1:0, au2:0.82, au4:0, au5:0, au12:1.0, au15:0, au20:0, au27:0,
    au43:1.0, sb2:0, mouthType:'excited', pupilTier:1, blush:0.58, it:1 },
]

const WORDS = ['no idea', 'guessing', 'leaning', 'somewhat sure', 'fairly sure', 'certain']

export default function ConfidenceRating({ value: valueProp, onChange, skinColor, eyeColor }) {
  const [internal, setInternal] = useState(null)
  const sel = valueProp !== undefined ? valueProp : internal

  function handleClick(v) {
    if (valueProp === undefined) setInternal(v)
    onChange?.(v)
  }

  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: '50%', left: 36, right: 36, height: 2, background: '#E8D0E0', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        {POSITIONS.map((pos, i) => {
          const v = i + 1
          const isSelected = sel === v
          return (
            <button key={i} onClick={() => handleClick(v)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative', zIndex: 1 }}>
              <div style={{ borderRadius: '50%', outline: `3px solid ${isSelected ? '#f068a4' : 'transparent'}`, outlineOffset: 2, transition: 'outline-color 0.12s' }}>
                <AURenderer size={72} position={pos} skinColor={skinColor} eyeColor={eyeColor} />
              </div>
              <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, color: isSelected ? '#f068a4' : '#abadb0', transition: 'color 0.12s' }}>
                {v}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#abadb0' }}>no idea</span>
        <span style={{ fontSize: 12, color: '#abadb0' }}>completely certain</span>
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#f068a4', minHeight: 20 }}>
        {sel != null ? WORDS[sel - 1] : ''}
      </div>
    </div>
  )
}
