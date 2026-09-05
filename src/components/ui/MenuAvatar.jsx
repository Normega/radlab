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
// WHY THE INNER RENDER IS BIGGER THAN THE BOX (68 inside 46):
// RippleAvatar draws into a 200×185 viewBox and is rendered square, so
// `preserveAspectRatio="xMidYMid meet"` letterboxes it: the head ellipse
// (rx 60–68, ry 65–70 of 200) only ever spans ~64% of the box. Passing
// size={46} would give a ~29px head floating in dead space — the very thing
// the white disc used to disguise. Rendering at 68 and cropping back to 46
// puts the head itself at the circle's full width.
//
// The offsets are the head's centre, not the drawing's. At size N the head
// centres at (0.5N, 0.5625N) — x is the viewBox centre, y sits low because
// cy=105 of 185 plus the letterbox gap. Centring that point in a 46 box gives
// left −11, top −15.25. The crop lands within a fraction of a pixel of the
// crown, so tall hair styles lose a little at the top; the old 46px disc
// clipped there too, just with more slack.
const BOX = 46
const RENDER = 68

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
  inner: { position: 'absolute', left: -11, top: -15.25, lineHeight: 0 },
  initialBox: { background: 'var(--bgp)' },
  initial: {
    fontFamily: '"Space Mono", "Courier New", monospace',
    fontSize: 17, fontWeight: 700, color: 'var(--pkd)', lineHeight: 1,
  },
}
