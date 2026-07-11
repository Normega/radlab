import { useState } from 'react'
import WheelSVG from '../games/StillWater/WheelSVG'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Single tap on the compact circumplex wheel; neutral centre is a valid,
// equally-weighted tap (no opt-out control). valence/arousal are the
// selected emotion's fixed direction scaled by which zone (intensity ring)
// was tapped — same intensity scaling StillWater's computeRating uses.
export default function MoodTap({ onSubmit }) {
  const [selection, setSelection] = useState(null)
  const [hovered, setHovered] = useState(null)

  function commit(patch) {
    setSelection(patch)
    setTimeout(() => onSubmit(patch), 280) // brief highlight before advancing
  }

  function handleZoneClick({ emotion, zone }) {
    const intensity = (zone + 1) / 3
    commit({
      neutral: false,
      emotionId: emotion.id,
      zone,
      valence: +(emotion.valence * intensity).toFixed(3),
      arousal: +(emotion.arousal * intensity).toFixed(3),
      label: emotion.name,
    })
  }

  function handleNeutral() {
    commit({ neutral: true, emotionId: null, zone: null, valence: 0, arousal: 0, label: 'neutral' })
  }

  return (
    <div style={S.wrap}>
      <p style={S.eyebrow}>Mood</p>
      <h2 style={S.title}>How are you feeling right now?</h2>
      <div style={S.wheelWrap}>
        <WheelSVG
          activeIds={null}
          selection={selection}
          hovered={hovered}
          onHover={setHovered}
          onZoneClick={handleZoneClick}
          onNeutral={handleNeutral}
        />
      </div>
      <p style={S.hint}>Tap anywhere on the wheel — the centre is neutral.</p>
    </div>
  )
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 16px' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', marginBottom: 16, maxWidth: 300 },
  wheelWrap: { touchAction: 'manipulation' },
  hint: { fontSize: 12, color: 'var(--tx3)', marginTop: 12 },
}
