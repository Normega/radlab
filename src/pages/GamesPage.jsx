import { useEffect, useState } from 'react'
import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import { supabase } from '../lib/supabase'
import GameCard from '../components/GameCard'
import { groupGames } from '../data/games'

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
          {/* Figma "SortBy" pill (Sept 14 handoff): uppercase mono label +
              caret in a 24px-radius pill. A styled native <select> so
              keyboard/screen-reader behavior stays stock. */}
          <label style={S.sortWrap}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={S.sortSelect}
              aria-label="Sort games by"
            >
              {SORTS.map(s => <option key={s.id} value={s.id}>Sort by {s.label}</option>)}
            </select>
            <span style={S.sortCaret} aria-hidden="true">▾</span>
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

// ── STYLES ────────────────────────────────────────────────────────────────
// The card itself is src/components/GameCard.jsx (shared with the About-page
// carousel — Sept 14 2026 design-system handoff).

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  // 1024 − 2×24 gutter = a 976px content column, so the two-up grid lands on
  // the Figma's 480px card width exactly.
  // width:100% is load-bearing: the page root is a flex column, and margin
  // '0 auto' on a flex item disables cross-axis stretch — without an explicit
  // width the wrap shrinks to fit its content, and the two-column grid
  // collapses to one the moment the cards' intrinsic width drops (which is
  // exactly what the Sept 14 shorter descriptions did).
  wrap:  { width: '100%', maxWidth: 1024, margin: '0 auto', padding: '32px 24px 72px' },
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
  // Figma SortBy: transparent pill, mono uppercase, caret. The caret is a
  // separate span because a native <select>'s own arrow can't be styled.
  sortWrap: {
    position: 'relative', display: 'inline-flex', alignItems: 'center',
    borderRadius: 24, cursor: 'pointer',
  },
  sortSelect: {
    appearance: 'none', WebkitAppearance: 'none',
    fontFamily: MONO, fontSize: 14, textTransform: 'uppercase', color: 'var(--tx)',
    background: 'transparent', border: 'none', borderRadius: 24,
    padding: '8px 30px 8px 12px', cursor: 'pointer',
  },
  sortCaret: {
    position: 'absolute', right: 12, pointerEvents: 'none',
    fontSize: 12, color: 'var(--tx)',
  },

  // ── section header ── (Figma CategoryLabel: pink-dark mono label, gray
  // rule, muted semibold count)
  section:     { marginTop: 28 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionLabel: {
    fontFamily: MONO, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
    color: 'var(--pkd)', whiteSpace: 'nowrap',
  },
  rule:         { flex: 1, height: 1, background: 'var(--tx2)', opacity: 0.4 },
  sectionCount: { fontFamily: SANS, fontWeight: 600, fontSize: 16, color: 'var(--gy)', whiteSpace: 'nowrap' },

  // ── grid ──
  // min() clamp so a phone narrower than the 340px track gets one full-width
  // column instead of a track that overflows the viewport.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 16 },
}
