import { useId } from 'react'

/**
 * Game icons — the full set (2026-08-13).
 *
 * GRAMMAR (the part that matters more than any single drawing):
 *   - 48×48 viewBox, so one drawing serves 24 / 60 / 116 px.
 *   - FILLED shapes, never strokes as the primary form. A 1.5px stroke drawn for
 *     a 24px badge becomes a 7px slab at 116px; fills scale exactly.
 *   - A soft tinted plate (var(--bgp)) behind every subject, which is what makes
 *     the set read as a set, and echoes GameIntro's numbered circles.
 *   - Nothing below ~2px at the 48 grid, or it disappears in the 24px badge.
 *
 * COLOUR (Claude's call, flagged for Norm — the set works but the rule is a
 * judgement, not a spec): each icon takes its palette from ITS OWN GAME's art
 * rather than the brand pink. The duck is pink because Pond Watch's duck is
 * pink; a player meets the icon seconds before the thing itself. The tradeoff
 * is that the set is NOT one hue ramp, so it is checked for adjacent-hue
 * separation instead — no two neighbours in the catalog order share a hue.
 * The alternative (one hue per category) was rejected because Attention holds
 * five of the ten games and they would have been indistinguishable.
 *
 * THE ABSTRACT ONES (Delve, Tune, Alongside) have no object to draw. Rather
 * than diagram the mechanic — the first Delve draft did, and produced a
 * bullseye, the exact reading Delve is built against — each got a *thing from
 * its world*: the image under the haze, one lit voice among dimmed ones, a mote
 * above grass. Delve still dies at 24px; see its note.
 *
 * Sizes in use: 116 (Figma GameCard slot), 60 (GameIntro step icons), 24 (badges).
 */

const PLATE = 'var(--bgp)'

function Frame({ size, plate, label, children }) {
  // Everything is clipped to the plate circle, whether or not the plate is
  // drawn. The object icons (duck, owl, face) sit inside it anyway and are
  // untouched; the scene icons (Ebb & Flow's waves, Alongside's meadow, Farm
  // Joy's soil) run edge to edge by construction and spilled out of the disc
  // into rectangles without this — obvious at 116px, and it broke the set's
  // silhouette in the badge row.
  const uid = useId().replace(/:/g, '')
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={`gi-clip-${uid}`}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <g clipPath={`url(#gi-clip-${uid})`}>
        {plate && <circle cx="24" cy="24" r="24" fill={PLATE} />}
        {children}
      </g>
    </svg>
  )
}

/* ── Still Water — the feeling wheel and its two axes ─────────────────────────
   Harvested from the game's own intro diagram, including its colours: gold for
   Sad↔Excited, purple for Calm↔Tense. The bars are rotated rects, not strokes,
   so they thicken with the icon. */
export function StillWaterIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Still Water">
      <circle cx="24" cy="24" r="15.5" fill="#e8d0e0" />
      <circle cx="24" cy="24" r="12.5" fill="#fdf6fa" />
      <rect x="22.5" y="11" width="3" height="26" rx="1.5" transform="rotate(45 24 24)" fill="#c4a000" opacity="0.85" />
      <rect x="22.5" y="11" width="3" height="26" rx="1.5" transform="rotate(-45 24 24)" fill="#804080" opacity="0.85" />
      <circle cx="24" cy="24" r="3.4" fill="#fcf0f5" />
      <circle cx="30.5" cy="17.5" r="2.6" fill="#c04a82" />
    </Frame>
  )
}

/* ── Face Read — a face mid-expression ───────────────────────────────────────
   The one icon that must not be neutral: the game is naming a feeling, so the
   brows do the work. Warm skin tone from the avatar palette. */
export function FaceReadIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Face Read">
      <circle cx="24" cy="24" r="14.5" fill="#f2c9a4" />
      <rect x="13.6" y="16.4" width="8.2" height="2.6" rx="1.3" transform="rotate(-11 17.7 17.7)" fill="#8a5a3a" />
      <rect x="26.2" y="16.4" width="8.2" height="2.6" rx="1.3" transform="rotate(11 30.3 17.7)" fill="#8a5a3a" />
      <circle cx="18.6" cy="23.2" r="2.4" fill="#1c1c1e" />
      <circle cx="29.4" cy="23.2" r="2.4" fill="#1c1c1e" />
      <path d="M17.5 29.5 Q24 35.5 30.5 29.5 Q24 32 17.5 29.5 Z" fill="#a8452f" />
    </Frame>
  )
}

/* ── Contact — the Ripple, and the aura that answers a synced breath ─────────
   Teal rather than pink: Contact is the one game whose whole subject is the
   creature, and the aura is the feedback the player is actually reading. */
export function FirstContactIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Contact">
      <circle cx="24" cy="25" r="19" fill="#4fb3ba" opacity="0.16" />
      <circle cx="24" cy="25" r="14.5" fill="#4fb3ba" opacity="0.24" />
      <ellipse cx="24" cy="26" rx="10.5" ry="10" fill="#3f9ea8" />
      <ellipse cx="24" cy="18.5" rx="7.2" ry="6" fill="#4fb3ba" />
      <circle cx="21" cy="18" r="1.9" fill="#0f3b40" />
      <circle cx="27" cy="18" r="1.9" fill="#0f3b40" />
      <circle cx="21.6" cy="17.3" r="0.7" fill="#fff" />
      <circle cx="27.6" cy="17.3" r="0.7" fill="#fff" />
    </Frame>
  )
}

/* ── Ebb & Flow — two breaths, one fuller than the other ─────────────────────
   The game is detecting a *change* in rhythm, so the two waves are deliberately
   not identical: the lower one is shallower. Blue, to sit apart from Contact's
   teal even though they are the same family of game. */
export function EbbFlowIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Ebb & Flow">
      <path d="M5 22 Q13.5 12 24 20 Q34.5 28 43 19 L43 26 Q34.5 35 24 27 Q13.5 19 5 29 Z" fill="#4a92c8" />
      <path d="M5 33 Q13.5 28 24 32.5 Q34.5 37 43 32 L43 37 Q34.5 42 24 37.5 Q13.5 33 5 38 Z" fill="#8fc0dd" />
    </Frame>
  )
}

/* ── Drift — an interval, marked at both ends ────────────────────────────────
   The ring is an even-odd path, not a disc with a plate-coloured hole punched
   in it, so it stays transparent when the plate is off. The two dots are the
   two tones; the arc between them is the duration being felt. */
export function DriftIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Drift">
      <path
        fillRule="evenodd"
        d="M24 9 a15 15 0 1 1 -0.01 0 Z M24 14.2 a9.8 9.8 0 1 0 0.01 0 Z"
        fill="#b9a6e0"
      />
      <circle cx="24" cy="11.6" r="3.5" fill="#6e56a8" />
      <circle cx="35.5" cy="30.5" r="3.5" fill="#6e56a8" />
      <circle cx="24" cy="24" r="2.6" fill="#6e56a8" opacity="0.4" />
    </Frame>
  )
}

/* ── Pond Watch — the game's own duck ────────────────────────────────────────
   Harvested from PondWatch.jsx: same pink, same silhouette logic (body ellipse,
   round head, stub bill), reduced to what survives at 24px. The wing highlight
   and notched tail of the original both vanish at that size, so they are gone;
   the two ripples are new, and do the work the water used to. */
export function PondWatchIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Pond Watch">
      <path d="M10 27 Q6 23 8.5 19.5 Q11.5 24.5 10 27 Z" fill="#e04090" />
      <ellipse cx="21" cy="27" rx="13.5" ry="8.5" fill="#f068a4" />
      <ellipse cx="28.5" cy="23.5" rx="4.5" ry="5.5" fill="#f068a4" />
      <circle cx="32" cy="19.5" r="6.4" fill="#f068a4" />
      <ellipse cx="38.6" cy="20.6" rx="3.6" ry="2.1" fill="#c04a82" />
      <circle cx="34.2" cy="18" r="1.35" fill="#1c1c1e" />
      <path d="M9 38 Q16 35.4 23 38" stroke="#c04a82" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.45" />
      <path d="M18 43 Q26 40.2 34 43" stroke="#c04a82" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.3" />
    </Frame>
  )
}

/* ── Delve — an image under haze, one patch cleared ──────────────────────────
   Three drafts. The first drew concentric rings around a bright centre, which
   is a TARGET — the one reading the game is built against, since aiming at a
   spot is exactly what does not work in it. The second put opaque haze over a
   landscape, so only the cleared patch showed and the whole thing read as an
   egg. This one keeps the haze translucent so the image is faintly present
   everywhere, with the clear patch off the sun and onto the horizon.
   KNOWN LIMIT: works at 116, passable at 60, mush at 24. A scene cannot survive
   badge size. If Delve ever needs a 24px mark it needs a different drawing. */
export function DelveIcon({ size = 48, plate = true }) {
  // Unique per instance: the mask and clip ids collide if the icon renders twice.
  const uid = useId().replace(/:/g, '')
  return (
    <Frame size={size} plate={plate} label="Delve">
      <defs>
        <radialGradient id={`dlv-hole-${uid}`} cx="0.56" cy="0.52" r="0.30">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.55" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id={`dlv-mask-${uid}`}>
          <rect width="48" height="48" fill={`url(#dlv-hole-${uid})`} />
        </mask>
        <clipPath id={`dlv-clip-${uid}`}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <g clipPath={`url(#dlv-clip-${uid})`}>
        <rect width="48" height="48" fill="#f0e0c8" />
        <circle cx="33" cy="14" r="5" fill="#e8a848" />
        <path d="M0 30 Q10 19 19 27 Q28 35 37 26 Q43 21 48 25 L48 48 L0 48 Z" fill="#7a9a58" />
        <path d="M0 38 Q12 31 24 37 Q36 43 48 37 L48 48 L0 48 Z" fill="#4f6b3c" />
        <rect width="48" height="48" fill="#cfc4cd" opacity="0.88" mask={`url(#dlv-mask-${uid})`} />
      </g>
    </Frame>
  )
}

/* ── Tune — one voice clear, the rest softened back ──────────────────────────
   Not a speaker, a note, or a waveform: those say "audio", and Tune is not
   about audio, it is about one thing coming forward while the others recede.
   So — three voices, one lit and two dimmed. That IS the mechanic, drawn with
   objects rather than diagrammed. */
export function TuneIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Tune">
      <circle cx="30" cy="19.5" r="10.5" fill="#8f7fd8" opacity="0.22" />
      <circle cx="30" cy="19.5" r="6.6" fill="#8f7fd8" opacity="0.3" />
      <circle cx="30" cy="19.5" r="4.4" fill="#5f49bc" />
      <circle cx="14.5" cy="30" r="3.6" fill="#8f7fd8" opacity="0.42" />
      <circle cx="24" cy="36.5" r="2.8" fill="#8f7fd8" opacity="0.32" />
      <circle cx="15" cy="16" r="2.6" fill="#8f7fd8" opacity="0.28" />
    </Frame>
  )
}

/* ── Alongside — the mote, and the meadow it will not be caught in ───────────
   Night green so it reads as the same world as the game, with the light warm
   against it. The grass blades are tapered fills, not strokes, so they keep
   their point at 116px. */
export function AlongsideIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Alongside">
      <path d="M0 32 Q12 27 24 30 Q36 33 48 29 L48 48 L0 48 Z" fill="#2f4a34" />
      <path d="M12 44 Q11 34 15.5 27 Q14 35 14.5 44 Z" fill="#3d6042" />
      <path d="M22 45 Q22.5 35 27 29 Q24.5 37 24.5 45 Z" fill="#3d6042" />
      <path d="M33 44 Q33.5 36 37.5 31 Q35 37 35.5 44 Z" fill="#3d6042" />
      <circle cx="29" cy="17" r="9" fill="#f2e7b0" opacity="0.22" />
      <circle cx="29" cy="17" r="5.4" fill="#f2e7b0" opacity="0.4" />
      <circle cx="29" cy="17" r="3.1" fill="#fdf6d8" />
    </Frame>
  )
}

/* ── Sidelong — the moon, and the faint ones beside it ───────────────────────
   The mechanic cannot be drawn (an icon of *not looking at* has no way to draw
   the not), so like the other abstract ones this is a thing from its world:
   the moon as the resting place, and a small linked figure off beside it —
   the gift, not the rule. Night indigo, so it sits apart from Alongside's
   night green; the constellation lines are the one permitted stroke, secondary
   to the star dots that carry the shape at badge size. */
export function SidelongIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Sidelong">
      <rect width="48" height="48" fill="#141c36" />
      <ellipse cx="30" cy="30" rx="20" ry="7" transform="rotate(-32 30 30)" fill="#8fa2d8" opacity="0.14" />
      <circle cx="14.5" cy="13.5" r="6.2" fill="#ecf2ff" />
      <circle cx="12.6" cy="12.2" r="1.9" fill="#c6d2ee" opacity="0.8" />
      <circle cx="16.6" cy="15.6" r="1.3" fill="#c6d2ee" opacity="0.7" />
      <path d="M27 33.5 L32.5 28.5 L38 30.5 L41 24.5" stroke="#96b2ec" strokeWidth="1.1" opacity="0.5" fill="none" />
      <circle cx="27" cy="33.5" r="1.7" fill="#dfe8ff" />
      <circle cx="32.5" cy="28.5" r="2.1" fill="#f4f8ff" />
      <circle cx="38" cy="30.5" r="1.5" fill="#dfe8ff" />
      <circle cx="41" cy="24.5" r="1.8" fill="#eef4ff" />
      <circle cx="25" cy="12" r="1.2" fill="#b9c8f2" opacity="0.75" />
      <circle cx="34" cy="16.5" r="1.4" fill="#cdd9f8" opacity="0.8" />
      <circle cx="10" cy="30" r="1.2" fill="#b9c8f2" opacity="0.6" />
      <circle cx="17" cy="38" r="1.4" fill="#cdd9f8" opacity="0.7" />
      <circle cx="41" cy="10" r="1.1" fill="#b9c8f2" opacity="0.6" />
    </Frame>
  )
}

/* ── Farm Joy — a plant pulled, root and all ─────────────────────────────────
   The root is the whole point: in Farm Joy you pull the plant up to find out
   which value it was. A leaf above the soil would say "gardening"; a plant with
   its root showing says "you took it out to look at it". */
export function FarmJoyIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Farm Joy">
      <path d="M6 34 Q24 29.5 42 34 L42 41 Q24 36.5 6 41 Z" fill="#7a5a3a" />
      <path d="M22.6 12 h2.8 a1.4 1.4 0 0 1 1.4 1.4 v22 a1.4 1.4 0 0 1 -1.4 1.4 h-2.8 a1.4 1.4 0 0 1 -1.4 -1.4 v-22 a1.4 1.4 0 0 1 1.4 -1.4 Z" fill="#4f7a3a" />
      <path d="M23 20 Q13 18 11.5 9.5 Q21 10.5 23 20 Z" fill="#6aa04a" />
      <path d="M25 17 Q35 14.5 37 6.5 Q27 8 25 17 Z" fill="#7bb257" />
      <path d="M23.5 37 Q21 42 17 44.5 Q22 42.5 23.5 40 Z" fill="#c9a15e" />
      <path d="M24.5 37 Q27 42.5 31 45 Q26 43 24.5 40 Z" fill="#c9a15e" />
    </Frame>
  )
}

/* ── Owl Barn (in development) ───────────────────────────────────────────────
   A whole owl at 24px turns to mush, so this is only the face: two big discs
   and two tufts, the most recognisable 3 % of a bird. Night amber, because the
   barn is dark and the game is heard before it is seen. */
export function OwlBarnIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Owl Barn">
      <path d="M12.5 14 L14.5 6.5 L20 11 Z" fill="#9a7b45" />
      <path d="M35.5 14 L33.5 6.5 L28 11 Z" fill="#9a7b45" />
      <circle cx="24" cy="24" r="14.5" fill="#c9a15e" />
      <path d="M24 9.6 a14.5 14.5 0 0 0 -13.4 9 a14.5 14.5 0 0 1 26.8 0 a14.5 14.5 0 0 0 -13.4 -9 Z" fill="#d9b675" />
      <circle cx="18.2" cy="22" r="5.6" fill="#f4ead6" />
      <circle cx="29.8" cy="22" r="5.6" fill="#f4ead6" />
      <circle cx="18.2" cy="22" r="2.9" fill="#1c1c1e" />
      <circle cx="29.8" cy="22" r="2.9" fill="#1c1c1e" />
      <path d="M24 26.5 L26.6 30.4 L21.4 30.4 Z" fill="#9a7b45" />
    </Frame>
  )
}

/* ── Breath Guardian (in development) ────────────────────────────────────────
   Shield with the breath running through it, not across it: the game is holding
   to raise the shield and releasing to let the world in, so the wave has to
   pass the barrier rather than bounce off it. */
export function BreathGuardianIcon({ size = 48, plate = true }) {
  const uid = useId().replace(/:/g, '')
  return (
    <Frame size={size} plate={plate} label="Breath Guardian">
      <defs>
        <clipPath id={`bg-clip-${uid}`}>
          <path d="M24 7 L38.5 13 V25.5 Q38.5 36.5 24 42 Q9.5 36.5 9.5 25.5 V13 Z" />
        </clipPath>
      </defs>
      <path d="M24 7 L38.5 13 V25.5 Q38.5 36.5 24 42 Q9.5 36.5 9.5 25.5 V13 Z" fill="#5b7fa8" />
      <g clipPath={`url(#bg-clip-${uid})`}>
        <path d="M5 24 Q14 15 24 22 Q34 29 43 21 L43 29 Q34 37 24 30 Q14 23 5 32 Z" fill="#a8c8e0" opacity="0.85" />
      </g>
    </Frame>
  )
}

/* ── Free Breathing (prototype) ──────────────────────────────────────────────
   The game's own result drawn as a mark: the four-duration breath shape, split
   at its waist into the inhale half (amber, up) and the exhale half (blue,
   down) — the exact colors of the two hold buttons — and deliberately lopsided
   the way a real breath is (the exhale runs longer). Behind it, one pink ghost
   breath, tilted: the overlaid-outlines reading from the session chart. The
   wind is a white gust crossing exactly at the in/out boundary and ending in a
   curl — breath leaving — with a fainter echo below. Gusts are secondary
   strokes over a filled subject, the Pond Watch ripple precedent. */
export function FreeBreathIcon({ size = 48, plate = true }) {
  return (
    <Frame size={size} plate={plate} label="Free Breathing">
      <path d="M24 6.5 L38 25 L24 46 L9 25 Z" fill="#f068a4" opacity="0.16" transform="rotate(8 24 26)" />
      <path d="M12 25 L24 11 L34 25 Z" fill="#c8862b" />
      <path d="M12 25 L34 25 L24 43 Z" fill="#2a6cab" />
      <path
        d="M5.5 27.5 Q13 23.5 22 25.5 Q30 27.3 35.5 24 Q39.5 21.5 38 18.3 Q36.6 15.6 34 17.2"
        stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.92"
      />
      <path
        d="M12 33.5 Q19 31.8 27 33.6"
        stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.5"
      />
    </Frame>
  )
}

/**
 * Registry, in catalog order (src/data/games.js), so the adjacent-hue check
 * above is checked against the order players actually see.
 */
export const GAME_ICONS = {
  still_water:     StillWaterIcon,
  face_read:       FaceReadIcon,
  first_contact:   FirstContactIcon,
  ebb_flow:        EbbFlowIcon,
  drift:           DriftIcon,
  pond_watch:      PondWatchIcon,
  delve:           DelveIcon,
  tune:            TuneIcon,
  alongside:       AlongsideIcon,
  sidelong:        SidelongIcon,
  farm_joy:        FarmJoyIcon,
  // In development — not in GAMES, but /prototypes and /admin/games list them.
  owl_barn:        OwlBarnIcon,
  breath_guardian: BreathGuardianIcon,
  free_breath:     FreeBreathIcon,
}

/** Dispatcher: <GameIcon slug="delve" size={60} />. Renders nothing if unknown. */
export default function GameIcon({ slug, size = 48, plate = true }) {
  const Icon = GAME_ICONS[slug]
  return Icon ? <Icon size={size} plate={plate} /> : null
}
