import RippleAvatar from '../../ripple/RippleAvatar'

// The standardized account-menu trigger — brand token "Menu avatar" (/brand).
//
// One look everywhere: the user's ripple avatar filling a 46px circle, no
// plate behind it. Deliberately NOT the old pink ring the main Nav wore, and
// not the Field Guide's smaller 36px — Norm standardized both on 2026-09-04
// (main-site size, Field Guide finish) and dropped the white disc on
// 2026-09-05. Wherever a signed-in user sees this, pressing it opens their
// account menu.
//
// WHY THE INNER RENDER IS BIGGER THAN THE BOX (57 inside 46):
// RippleAvatar draws into a 200×185 viewBox and is rendered square, so
// `preserveAspectRatio="xMidYMid meet"` letterboxes it: the head ellipse
// (rx 60–68, ry 65–70 of 200) only ever spans ~64% of the box. Passing
// size={46} would give a ~29px head floating in dead space — the very thing
// the white disc used to disguise. Rendering larger and cropping back to 46
// is what puts the head at something like the circle's own size.
//
// HOW 57 WAS CHOSEN. The render size is a straight trade against how much
// room the hair gets above the crown, and only one of the two can win:
//   68 → head 43–49px, crown flush with the top edge, tall hair cut off
//   57 → head 34–39px, ~6px (20 viewBox units) of crown clearance   ← here
//   51 → head ~33px, the whole drawing visible, nothing ever clipped
// 57 keeps most of the size won by dropping the disc while giving hair real
// room (Norm asked for the clearance, 2026-09-05). If a specific style still
// clips, lower RENDER — the offsets below recompute from it.
//
// The offsets place the HEAD, not the drawing. At size N the head centres at
// (0.5N, 0.5625N): x is the viewBox centre, y sits low because cy=105 of 185
// plus the letterbox gap. These values put the tallest head (ry 70) 6px below
// the top edge with its chin inside the box, checked across all five species.
//
// The box itself stays transparent — the nav's own ground shows through, which
// is the point of retiring the disc.
const BOX = 46
const RENDER = 57

export default function MenuAvatar({ avatarData, initial }) {
  if (!avatarData) {
    // A single letter has no silhouette of its own, so the fallback keeps a
    // ground — otherwise it floats on the nav's pink and stops reading as a
    // pressable target. Tint + accent-dark, the same pairing as the badges.
    return <span style={{ ...S.box, ...S.initialBox }}><span style={S.initial}>{initial}</span></span>
  }
  return (
    <span style={S.box}>
      <span style={S.inner}>
        <RippleAvatar
          skinColor={avatarData.skin_color} eyeColor={avatarData.eye_color}
          species={avatarData.species ?? 'human'} hairStyle={avatarData.hair_style ?? 'none'}
          hairColor={avatarData.hair_color ?? '#784421'} valence={0} arousal={0} size={RENDER}
        />
      </span>
    </span>
  )
}

const S = {
  box: {
    width: BOX, height: BOX, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  inner: { position: 'absolute', left: -5.5, top: -6.11, lineHeight: 0 },
  initialBox: { background: 'var(--bgp)' },
  initial: {
    fontFamily: '"Space Mono", "Courier New", monospace',
    fontSize: 17, fontWeight: 700, color: 'var(--pkd)', lineHeight: 1,
  },
}
