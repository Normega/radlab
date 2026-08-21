import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import { supabase } from '../lib/supabase'
import { GAMES, groupGames } from '../data/games'

// ── GamesPage ─────────────────────────────────────────────────────────────
// Revised games page (Figma node 4047:3653). Three states in one component:
//
//   Guest  — public, read-only. Full catalogue, nothing locked, no check-in
//            card; every card routes to /signup instead of the game.
//   User   — check-in reminder (until today's check-in is done), unlock gates,
//            cards route to the game.
//
// Sorting is client-side over the static catalogue in `src/data/games.js`;
// there is no server round-trip for the grid.
//
// Props:
//   session — auth session, or null for guests

const SORTS = [
  { id: 'category', label: 'Category' },
  { id: 'duration', label: 'Duration' },
]

export default function GamesPage({ session }) {
  const userId = session?.user?.id ?? null
  const [sortBy, setSortBy] = useState('category')
  const { unlocked, ready } = useUnlockState(userId)

  const sections = groupGames(sortBy)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        <h1 style={S.title}>What are you playing today?</h1>

        {userId && <CheckinReminder userId={userId} />}

        <div style={S.headingRow}>
          <EyebrowLabel variant="white">Games</EyebrowLabel>
          <label style={S.sortWrap}>
            <span style={S.sortLabel}>Sort by</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={S.sortSelect}
              aria-label="Sort games by"
            >
              {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {sections.map(section => (
          <section key={section.id} style={S.section}>
            <div style={S.sectionHead}>
              <span style={S.sectionLabel}>{section.label}</span>
              <span style={S.rule} />
              <span style={S.sectionCount}>
                {section.games.length} {section.games.length === 1 ? 'game' : 'games'}
              </span>
            </div>

            <div style={S.grid}>
              {section.games.map(game => (
                <GameCard
                  key={game.slug}
                  game={game}
                  isGuest={!userId}
                  // Until the profile read lands, treat everything as unlocked
                  // so the grid never flashes a wall of padlocks.
                  locked={!!userId && ready && !!game.unlock && !unlocked[game.unlock.requires]}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <SiteFooter session={session} />
    </div>
  )
}

// ── UNLOCK STATE ──────────────────────────────────────────────────────────
// Both gating games record completion on `profiles`, not `game_sessions`
// (Still Water writes `still_water_sessions`; First Contact writes
// `first_contact_complete`), so one row answers every gate.

function useUnlockState(userId) {
  const [state, setState] = useState({ unlocked: {}, ready: false })

  useEffect(() => {
    if (!userId) { setState({ unlocked: {}, ready: false }); return }
    let cancelled = false

    supabase.from('profiles')
      .select('still_water_sessions, first_contact_complete')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setState({
          unlocked: {
            still_water:   (data?.still_water_sessions ?? 0) > 0,
            first_contact: data?.first_contact_complete === true,
          },
          ready: true,
        })
      })

    return () => { cancelled = true }
  }, [userId])

  return state
}

// ── CHECK-IN REMINDER ─────────────────────────────────────────────────────
// Mirrors Dashboard.jsx's checkedInToday test (local calendar date vs
// ripples.last_checkin_on). Renders nothing until the read resolves, and
// nothing at all once today's check-in exists.

function CheckinReminder({ userId }) {
  const [checkedIn, setCheckedIn] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.from('ripples')
      .select('last_checkin_on')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const pad = n => String(n).padStart(2, '0')
        const now = new Date()
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        setCheckedIn(data?.last_checkin_on === today)
      })
    return () => { cancelled = true }
  }, [userId])

  if (checkedIn !== false) return null

  return (
    <div style={S.checkinBlock}>
      <EyebrowLabel variant="white">Today's check-in</EyebrowLabel>
      <div style={S.checkinCard}>
        <span style={S.checkinAccent} aria-hidden="true" />
        <div style={S.checkinText}>
          <p style={S.checkinTitle}>You haven't checked in yet today.</p>
          <p style={S.checkinSub}>It takes one minute to reflect and set an intention.</p>
        </div>
        <PrimaryCTA to="/checkin" style={S.checkinCta}>Check in now →</PrimaryCTA>
      </div>
    </div>
  )
}

// ── GAME CARD ─────────────────────────────────────────────────────────────
// The whole card is the click target — the Figma replaces the old PLAY NOW
// footer with a hover-only "Play now →". Hover is desktop-only, so the label
// is an affordance layered on top of a card that is already a link (and
// already keyboard-focusable) rather than the only way in.

function GameCard({ game, isGuest, locked }) {
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
      style={{ ...S.card, ...S.cardLocked }}
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
      <h2 style={S.gameTitle}>{game.title}</h2>
      <p style={S.gameDesc}>{game.desc}</p>
      <div style={S.meta}>
        <Stat label="Duration" value={game.duration ?? 'Open-ended'} />
        <Stat label="Trials"   value={game.trials ?? '—'} />
      </div>
    </>
  )
}

function Stat({ label, value }) {
  return (
    <div style={S.stat}>
      <span style={S.statLabel}>{label}</span>
      <span style={S.statValue}>{value}</span>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="3" fill="var(--pk)" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--pk)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.6" fill="#fff" />
      <rect x="11.2" y="15" width="1.6" height="3" rx="0.8" fill="#fff" />
    </svg>
  )
}

// ── STYLES ────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  // 1024 − 2×24 gutter = a 976px content column, so the two-up grid lands on
  // the Figma's 480px card width exactly.
  wrap:  { maxWidth: 1024, margin: '0 auto', padding: '32px 24px 72px' },
  title: { fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 36px)', color: 'var(--tx)', letterSpacing: -0.5, marginBottom: 28 },

  // ── check-in reminder ──
  checkinBlock: { marginBottom: 32 },
  checkinCard: {
    position: 'relative', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    marginTop: 10, padding: '18px 20px 18px 28px',
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
  },
  checkinAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 6,
    background: 'var(--pk)', borderRadius: '12px 0 0 12px',
  },
  checkinText:  { flex: '1 1 260px' },
  checkinTitle: { fontFamily: SANS, fontWeight: 600, fontSize: 16, color: 'var(--tx)' },
  checkinSub:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', marginTop: 2 },
  checkinCta:   { flexShrink: 0 },

  // ── heading row ──
  headingRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap', marginBottom: 8,
  },
  sortWrap:  { display: 'inline-flex', alignItems: 'center', gap: 10 },
  sortLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)' },
  sortSelect: {
    fontFamily: MONO, fontSize: 14, color: 'var(--tx)',
    background: 'transparent', border: 'none', borderBottom: '1px solid var(--bds)',
    padding: '4px 2px', cursor: 'pointer',
  },

  // ── section header ──
  section:     { marginTop: 28 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionLabel: {
    fontFamily: MONO, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase',
    color: 'var(--pk)', whiteSpace: 'nowrap',
  },
  rule:         { flex: 1, height: 1, background: 'var(--bd)' },
  sectionCount: { fontFamily: MONO, fontSize: 12, color: 'var(--gy)', whiteSpace: 'nowrap' },

  // ── grid + card ──
  // min() clamp so a phone narrower than the 340px track gets one full-width
  // column instead of a track that overflows the viewport.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 16 },

  card: {
    position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    padding: 24, background: 'var(--bgc)',
    border: '1px solid var(--bd)', borderRadius: 12,
  },
  cardLink: {
    textDecoration: 'none', color: 'inherit',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
  },
  cardHover: {
    borderColor: 'var(--pkbs)',
    boxShadow: '0 6px 20px rgba(240,104,164,0.14)',
    transform: 'translateY(-2px)',
  },
  cardLocked: { background: 'var(--bgc)' },

  badge: {
    alignSelf: 'flex-start', fontFamily: MONO, fontSize: 12, letterSpacing: 0.5,
    textTransform: 'uppercase', padding: '5px 10px', borderRadius: 12,
    background: 'var(--bgp)', color: 'var(--pkd)',
  },
  gameTitle: { fontFamily: SERIF, fontSize: 24, color: 'var(--tx)', margin: '14px 0 8px' },
  gameDesc:  { fontFamily: SANS, fontSize: 14, lineHeight: 1.55, color: 'var(--tx2)', flex: 1 },

  meta: {
    display: 'flex', gap: 40, marginTop: 18, paddingTop: 14,
    borderTop: '1px solid var(--bd)',
  },
  stat:      { display: 'flex', flexDirection: 'column', gap: 3 },
  statLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--gy)' },
  statValue: { fontFamily: MONO, fontSize: 14, color: 'var(--tx)' },

  // ── hover affordance ──
  hoverVeil: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(252,240,245,0.82)',
    transition: 'opacity 0.15s ease', pointerEvents: 'none',
  },
  hoverPill: {
    fontFamily: SANS, fontWeight: 600, fontSize: 16,
    padding: '10px 20px', borderRadius: 24,
    background: 'var(--pk)', color: '#fff',
    boxShadow: '0 4px 14px rgba(240,104,164,0.35)',
  },

  // ── locked state ──
  // Stacked column rather than the mock's centred text, which landed on top
  // of the description.
  lockVeil: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    background: 'rgba(240,236,238,0.88)',
  },
  lockText: {
    fontFamily: MONO, fontSize: 13, letterSpacing: 0.5,
    textTransform: 'uppercase', color: 'var(--tx2)', textAlign: 'center',
    padding: '0 16px',
  },
  lockGame: { color: 'var(--pkd)', fontWeight: 700 },
}
