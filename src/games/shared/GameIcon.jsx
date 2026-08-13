import { useId } from 'react'

/**
 * Game icons — trial set of three (2026-08-13).
 *
 * Drawn to test whether a house style holds up before committing to all ten, or
 * briefing a specialist. The three deliberately pose different problems:
 *   pond_watch — harvested from the game's own Duck (PondWatch.jsx)
 *   delve      — abstract; the mechanic has no object to draw
 *   owl_barn   — figurative, and must survive at 24px where a bird usually dies
 *
 * GRAMMAR (the part that matters more than any single drawing):
 *   - 48×48 viewBox, so one drawing serves 24 / 60 / 116 px.
 *   - FILLED shapes, never strokes as the primary form. A 1.5px stroke drawn for
 *     a 24px badge becomes a 7px slab at 116px; fills scale exactly.
 *   - A soft tinted plate (var(--bgp)) behind every subject, which is what makes
 *     the set read as a set, and echoes GameIntro's numbered circles.
 *   - Each subject keeps its OWN game's colours rather than the brand pink.
 *     The duck is pink because Pond Watch's duck is pink — a player meets the
 *     icon seconds before the thing itself, and they should match.
 *   - Nothing below ~2px at the 48 grid, or it disappears in the 24px badge.
 *
 * Sizes in use: 116 (Figma GameCard slot), 60 (GameIntro step icons), 24 (badges).
 */

const PLATE = 'var(--bgp)'

function Frame({ size, plate, label, children }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {plate && <circle cx="24" cy="24" r="24" fill={PLATE} />}
      {children}
    </svg>
  )
}

/* ── Pond Watch ──────────────────────────────────────────────────────────────
   Harvested from the in-game Duck: same pink, same silhouette logic (body
   ellipse, round head, stub bill), reduced to what survives at 24px. The wing
   highlight and the notched tail of the original both vanish at that size, so
   they are gone; the two ripples are new, and do the work the water used to. */
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

/* ── Delve ───────────────────────────────────────────────────────────────────
   No object to draw — the game is haze that clears where attention rests.
   First attempt drew concentric rings around a bright centre, which is a
   TARGET: the one reading the game is built against, since aiming at a spot is
   exactly what does not work in it. Redrawn so the haze lies over a real image
   and one soft, off-centre patch has cleared — the image is what's revealed,
   not a bullseye, and nothing marks the clear patch as somewhere you aimed. */
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
        {/* The image under the haze — a fragment, never fully shown */}
        <rect width="48" height="48" fill="#f0e0c8" />
        <circle cx="33" cy="14" r="5" fill="#e8a848" />
        <path d="M0 30 Q10 19 19 27 Q28 35 37 26 Q43 21 48 25 L48 48 L0 48 Z" fill="#7a9a58" />
        <path d="M0 38 Q12 31 24 37 Q36 43 48 37 L48 48 L0 48 Z" fill="#4f6b3c" />
        {/*
          Haze is translucent, not a lid: the image has to be faintly present
          everywhere, or the cleared patch reads as the only content and the
          whole thing turns into an egg. Second correction on this one drawing.
        */}
        <rect width="48" height="48" fill="#cfc4cd" opacity="0.88" mask={`url(#dlv-mask-${uid})`} />
      </g>
    </Frame>
  )
}

/* ── Owl Barn ────────────────────────────────────────────────────────────────
   The hard one. A whole owl at 24px turns to mush, so this is only the face:
   two big discs and two tufts, which is the most recognisable 3 % of a bird.
   Night amber rather than pink, because the barn is dark and the game is heard
   before it is seen. */
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

export const TRIAL_ICONS = [
  { slug: 'pond_watch', title: 'Pond Watch', note: 'harvested from the game’s own duck', Icon: PondWatchIcon },
  { slug: 'delve',      title: 'Delve',      note: 'abstract — the mechanic, not an object', Icon: DelveIcon },
  { slug: 'owl_barn',   title: 'Owl Barn',   note: 'figurative — the 24px stress test', Icon: OwlBarnIcon },
]
