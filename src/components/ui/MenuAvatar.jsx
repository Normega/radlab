import RippleAvatar from '../../ripple/RippleAvatar'

// The standardized account-menu trigger — brand token "Menu avatar" (/brand).
//
// One look everywhere: a 40px ripple avatar sitting in a 46px white circle
// with a hairline border. Deliberately NOT the old pink ring the main Nav
// wore, and not the Field Guide's smaller 36px — Norm standardized both on
// 2026-09-04: main-site size, Field Guide finish. The white circle IS the
// menu affordance; wherever a signed-in user sees it, pressing it opens
// their account menu.
export default function MenuAvatar({ avatarData, initial }) {
  return (
    <span style={S.circle}>
      {avatarData ? (
        <RippleAvatar
          skinColor={avatarData.skin_color} eyeColor={avatarData.eye_color}
          species={avatarData.species ?? 'human'} hairStyle={avatarData.hair_style ?? 'none'}
          hairColor={avatarData.hair_color ?? '#784421'} valence={0} arousal={0} size={40}
        />
      ) : (
        <span style={S.initial}>{initial}</span>
      )}
    </span>
  )
}

const S = {
  circle: {
    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
    background: '#fff', border: '1px solid var(--bd)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontFamily: '"Space Mono", "Courier New", monospace',
    fontSize: 17, fontWeight: 700, color: 'var(--pk)', lineHeight: 1,
  },
}
