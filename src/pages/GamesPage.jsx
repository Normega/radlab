import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import { COPY } from '../games/FirstContact/constants'

// ── GamesPage ─────────────────────────────────────────────────────────────
// Props:
//   session              — auth session
//   firstContactComplete — undefined (loading) | false | true

export default function GamesPage({ session, firstContactComplete }) {
  const loading    = firstContactComplete === undefined
  const isComplete = firstContactComplete === true

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        <p style={S.eyebrow}>Games</p>
        <h1 style={S.title}>What are you playing today?</h1>

        <div style={S.grid}>

          {/* Still Water — emotion check-in, always available */}
          <GameCard
            title="Still Water"
            badge="Emotion check-in"
            desc="How are you arriving? Two quick questions map your mood on the feeling wheel."
            to="/games/still-water"
          />

          {/* Face Read — expression recognition game */}
          <GameCard
            title="Face Read"
            badge="Emotion recognition"
            desc="A face animates into an expression. Can you name the feeling — and how strong it is?"
            to="/games/face-read"
          />

          {/* Drift — time perception */}
          <GameCard
            title="Drift"
            badge="Time perception · Felt duration"
            desc="A tone marks an interval. A face breathes while you wait. Then you reproduce the duration from felt sense alone."
            to="/games/drift"
          />

          {/* First Contact / Deeper Contact card — conditional on onboarding status */}
          {!loading && !isComplete && (
            <GameCard
              title="First Contact"
              badge="Breath sync · Required"
              desc={COPY.games_tagline_first}
              to="/games/first-contact"
              featured
            />
          )}

          {!loading && isComplete && (
            <GameCard
              title="Deeper Contact"
              badge="Breath sync · Practice"
              desc={COPY.games_tagline_deeper}
              to="/games/first-contact"
            />
          )}

          <GameCard
            title="Pond Watch"
            badge="Go / No-Go · Reaction time"
            desc="Watch the pond. Press when you spot a duck."
            to="/games/pond-watch"
          />

          <GameCard
            title="Owl Barn"
            badge="Hearing · Rhythm · Strategy"
            desc="Cross a dark barn while owls hoot overhead. Read the silence — 3 taps or 8."
            to="/games/owl-barn"
          />

          <GameCard
            title="Farm Joy"
            badge="Values clarification"
            desc="Plant the values that grow joy."
            to="/games/farm-joy"
          />

          {/* Ebb & Flow: locked until First Contact is complete */}
          <GameCard
            title="Ebb &amp; Flow"
            badge="Interoception · Breath sync"
            desc="Breathe with your avatar and detect subtle shifts in rhythm."
            to="/games/ebb-flow"
            locked={!loading && !isComplete}
          />

        </div>
      </div>
    </div>
  )
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────

function GameCard({ title, badge, desc, to, featured = false, locked = false }) {
  return (
    <div style={{
      ...S.card,
      ...(featured ? S.cardFeatured : {}),
    }}>
      <div style={S.cardInner}>
        <div style={S.badgeRow}>
          <span style={S.gameBadge}>{badge}</span>
          {locked && <span style={S.lockBadge}>🔒 Complete First Contact first</span>}
        </div>
        <h2 style={S.gameTitle} dangerouslySetInnerHTML={{ __html: title }} />
        <p style={S.gameDesc}>{desc}</p>
      </div>
      <Link
        to={to}
        style={{
          ...S.playLink,
          ...(featured ? S.playLinkFeatured : {}),
          ...(locked   ? S.playLinkLocked  : {}),
        }}
      >
        {featured ? 'Begin →' : locked ? 'Locked' : 'Play now →'}
      </Link>
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  wrap:    { maxWidth: 900, margin: '0 auto', padding: '48px 32px' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title:   { fontFamily: SERIF, fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--tx)', letterSpacing: -1, marginBottom: 36 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },

  card:         { background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardFeatured: { border: '2px solid var(--pk)', boxShadow: '0 0 0 4px rgba(240,104,164,0.10)' },
  cardInner:    { padding: '24px 24px 20px', flex: 1 },

  badgeRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 },

  gameBadge: {
    display: 'inline-block', fontFamily: MONO, fontSize: 12, letterSpacing: 1,
    textTransform: 'uppercase', padding: '3px 9px', borderRadius: 5,
    background: 'var(--bgp)', color: 'var(--pkd)', border: '1px solid var(--pkb)',
  },
  lockBadge: {
    display: 'inline-block', fontFamily: MONO, fontSize: 12, letterSpacing: 0.5,
    padding: '3px 8px', borderRadius: 5,
    background: '#f5f5f5', color: 'var(--tx3)', border: '1px solid var(--bd)',
  },

  gameTitle:  { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8 },
  gameDesc:   { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },

  playLink: {
    display: 'block', padding: '13px 24px',
    background: 'var(--bgp)', borderTop: '1px solid var(--pkb)',
    fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
    color: 'var(--pk)', textDecoration: 'none',
  },
  playLinkFeatured: {
    background: 'var(--pk)', color: '#fff',
    borderTop: 'none',
  },
  playLinkLocked: {
    color: 'var(--tx3)', cursor: 'default', pointerEvents: 'none',
  },
}
