import { useState } from 'react'
import { Link } from 'react-router-dom'
import GameIcon from '../games/shared/GameIcon'
import { metaRows } from '../data/games'

/**
 * GameCard — THE game card (Figma "GameCard", Sept 14 2026 design-system
 * handoff). One component for the games grid (/games) and the About-page
 * carousel; the old page-local cards (icon-grid card on GamesPage, the
 * illustrated info/art card on PlatformPage) are consolidated here, as is
 * the marketing art: every surface shows the catalog's own GameIcon in the
 * 80px tinted disc, so a game looks the same everywhere it appears.
 *
 * Height is LOCKED by construction (designer rule): the description is
 * clamped to two lines — catalog copy is trimmed to fit (see the cap note in
 * src/data/games.js), the clamp is the guard against a third line ever
 * pushing cards in a row out of alignment.
 *
 * States (all four from Figma): Default; Hover ("Play now →" veil — the
 * card itself is the link, the veil is a desktop affordance on top);
 * HoverGuest ("Sign up to play →", routes to /signup); Locked (gray veil,
 * "PLAY {GAME} TO UNLOCK", not a link).
 */
export default function GameCard({ game, isGuest = false, locked = false }) {
  const [hover, setHover] = useState(false)

  if (locked) return <LockedCard game={game} />

  const to    = isGuest ? '/signup' : game.to
  const label = isGuest ? 'Sign up to play →' : 'Play now →'

  return (
    <Link
      to={to}
      style={{ ...S.card, ...S.cardLink, ...(hover ? S.cardHover : {}) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <CardBody game={game} />
      <span style={{ ...S.hoverVeil, opacity: hover ? 1 : 0 }} aria-hidden="true">
        <span style={S.hoverPill}>{label}</span>
      </span>
    </Link>
  )
}

function LockedCard({ game }) {
  return (
    <div
      style={S.card}
      aria-label={`${game.title} — locked. Play ${game.unlock.label} to unlock.`}
    >
      <CardBody game={game} />
      <div style={S.lockVeil}>
        <LockIcon />
        <p style={S.lockText}>
          Play <strong style={S.lockGame}>{game.unlock.label}</strong> to unlock
        </p>
      </div>
    </div>
  )
}

function CardBody({ game }) {
  return (
    <>
      <span style={S.badge}>{game.badge}</span>
      <span style={S.heading}>
        <span style={S.info}>
          <h2 style={S.title}>{game.title}</h2>
          <p style={S.desc}>{game.desc}</p>
        </span>
        <GameIcon slug={game.slug} size={80} />
      </span>
      <span style={S.meta}>
        {metaRows(game).map(([label, value]) => (
          <span key={label} style={S.stat}>
            <span style={S.statLabel}>{label}</span>
            <span style={S.statValue}>{value}</span>
          </span>
        ))}
      </span>
    </>
  )
}

function LockIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="3" fill="var(--tx)" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--tx)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.6" fill="var(--bgc)" />
      <rect x="11.2" y="15" width="1.6" height="3" rx="0.8" fill="var(--bgc)" />
    </svg>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  card: {
    position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: '24px 16px',
    background: 'var(--bgc)', border: '1px solid var(--pk)', borderRadius: 12,
  },
  cardLink: {
    textDecoration: 'none', color: 'inherit',
    transition: 'box-shadow 0.15s ease, transform 0.15s ease',
  },
  cardHover: {
    boxShadow: '0 6px 20px rgba(240,104,164,0.14)',
    transform: 'translateY(-2px)',
  },

  badge: {
    alignSelf: 'flex-start', fontFamily: MONO, fontSize: 12, letterSpacing: 0.5,
    textTransform: 'uppercase', padding: '4px 8px', borderRadius: 12,
    background: 'var(--bgp)', border: '1px solid var(--pk)', color: 'var(--pkd)',
  },

  heading: { display: 'flex', alignItems: 'center', gap: 8 },
  info:    { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  title:   { fontFamily: SERIF, fontWeight: 400, fontSize: 28, lineHeight: 1.5, color: 'var(--tx)', margin: 0 },
  desc: {
    fontFamily: SANS, fontSize: 12, lineHeight: 1.5, color: 'var(--tx2)', margin: 0,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },

  meta: {
    display: 'flex', gap: 40, marginTop: 4, paddingTop: 12,
    borderTop: '1px solid var(--pk)',
  },
  stat:      { display: 'flex', flexDirection: 'column', gap: 3 },
  statLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)' },
  statValue: { fontFamily: SANS, fontSize: 12, color: 'var(--tx)' },

  hoverVeil: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(252,240,245,0.94)',
    transition: 'opacity 0.15s ease', pointerEvents: 'none',
  },
  hoverPill: {
    fontFamily: SANS, fontWeight: 600, fontSize: 16,
    padding: '10px 20px', borderRadius: 24,
    background: 'var(--pk)', color: '#fff',
    boxShadow: '0 4px 14px rgba(240,104,164,0.35)',
  },

  lockVeil: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    background: 'rgba(171,173,176,0.92)',
  },
  lockText: {
    fontFamily: MONO, fontSize: 20, letterSpacing: 0.5,
    textTransform: 'uppercase', color: 'var(--tx)', textAlign: 'center',
    padding: '0 16px', margin: 0,
  },
  lockGame: { color: 'var(--pkd)', fontWeight: 700 },
}
