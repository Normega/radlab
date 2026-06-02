import { useState } from 'react'
import AURenderer from './AURenderer'
import { EXPRESSION_TABLE, NEUTRAL_POS } from './expressionTable'

// Pupil radii scale with arousal — smallest (constricted) at 1, largest (dilated) at 6.
const AROUSAL_PUPIL_R = [3.5, 4.2, 5.0, 7.0, 8.2, 9.5]

const POSITIONS = [
  { ...EXPRESSION_TABLE.Still.strong,   pupilR: AROUSAL_PUPIL_R[0] },
  { ...EXPRESSION_TABLE.Still.moderate, pupilR: AROUSAL_PUPIL_R[1] },
  { ...EXPRESSION_TABLE.Still.mild,     pupilR: AROUSAL_PUPIL_R[2] },
  { ...EXPRESSION_TABLE.Alert.mild,     pupilR: AROUSAL_PUPIL_R[3] },
  { ...EXPRESSION_TABLE.Alert.moderate, pupilR: AROUSAL_PUPIL_R[4] },
  { ...EXPRESSION_TABLE.Alert.strong,   pupilR: AROUSAL_PUPIL_R[5] },
]

const WORDS = ['very still', 'still', 'slightly still', 'slightly activated', 'activated', 'very activated']

export default function ArousalRating({ value: valueProp, onChange, skinColor, eyeColor }) {
  const [internal, setInternal] = useState(null)
  const sel = valueProp !== undefined ? valueProp : internal

  function handleClick(v) {
    if (valueProp === undefined) setInternal(v)
    onChange?.(v)
  }

  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Track line from center of first face to center of last face */}
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
        <span style={{ fontSize: 12, color: '#abadb0' }}>very still</span>
        <span style={{ fontSize: 12, color: '#abadb0' }}>very activated</span>
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#f068a4', minHeight: 20 }}>
        {sel != null ? WORDS[sel - 1] : ''}
      </div>
    </div>
  )
}
