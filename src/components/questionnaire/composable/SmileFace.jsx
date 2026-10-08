// ── SmileFace ────────────────────────────────────────────────────────────────
// The face drawn by the graphic_slider question type: five states, 1 a very sad
// face through 5 a very happy one.
//
// WHY THIS EXISTS. UTMAP's 2024 and 2025 waves asked both single-item life
// satisfaction questions with Qualtrics' "Smile" graphic slider: one large
// yellow face that changes expression as the slider moves. Qualtrics documents
// the coding as "'1' is a very sad face and '5' is a very happy face", which is
// what the stored values carry. A plain 1-5 scale is a different item, so the
// 2026 wave reproduces the face to keep the series comparable.
//
// Drawn as SVG rather than emoji so it looks the same on every phone: emoji are
// rendered by the operating system's font, and an Android face and an iPhone
// face are not the same stimulus.
//
// The colours here are illustration, not interface, which is why this one file
// is listed in the design audit's HEX_EXEMPT: the classic smiley is yellow, and
// none of the design-system tokens is. Nothing else in the question type uses a
// literal colour.

const MOUTH_CURVE = {
  1: -16,  // very sad: deep frown
  2: -8,   // sad
  3: 0,    // neutral: straight line, the face 2025 showed before any input
  4: 8,    // happy
  5: 16,   // very happy: broad smile
}

const DESCRIPTION = {
  1: 'very sad face',
  2: 'sad face',
  3: 'neutral face',
  4: 'happy face',
  5: 'very happy face',
}

export function faceDescription(value) {
  return DESCRIPTION[value] ?? DESCRIPTION[3]
}

export default function SmileFace({ value, size = 128 }) {
  const level = MOUTH_CURVE[value] !== undefined ? value : 3
  const curve = MOUTH_CURVE[level]
  // Mouth: a quadratic curve whose control point drops below the line to smile
  // and rises above it to frown. The ends lift slightly with a smile, as the
  // Qualtrics graphic does, so 4 and 5 read as distinct.
  const y = 70 - curve * 0.15
  // Wide, as in the Qualtrics graphic, whose neutral mouth spans most of the face.
  const mouth = `M 27 ${y} Q 50 ${y + curve * 1.9} 73 ${y}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={faceDescription(level)}
    >
      <defs>
        <radialGradient id="smile-face-fill" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#FFF6A8" />
          <stop offset="55%" stopColor="#FFE033" />
          <stop offset="100%" stopColor="#E3B400" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#smile-face-fill)" stroke="#C49A00" strokeWidth="2" />
      <ellipse cx="36" cy="40" rx="5" ry="8" fill="#2B2B2B" />
      <ellipse cx="64" cy="40" rx="5" ry="8" fill="#2B2B2B" />
      <path d={mouth} fill="none" stroke="#1F1F1F" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
