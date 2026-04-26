import { Link } from 'react-router-dom'
import Nav from '../components/Nav'

export default function GamesPage({ session }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        <p style={S.eyebrow}>Games</p>
        <h1 style={S.title}>What are you playing today?</h1>

        <div style={S.grid}>
          <GameCard
            title="Pond Watch"
            badge="Go / No-Go · Reaction time"
            desc="Watch the pond. Press when you spot a duck."
            to="/games/pond-watch"
          />
          <GameCard
            title="Ebb &amp; Flow"
            badge="Interoception · Breath sync"
            desc="Breathe with your avatar and detect subtle shifts in rhythm."
            to="/games/ebb-flow"
          />
        </div>
      </div>
    </div>
  )
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function GameCard({ title, badge, desc, to }) {
  return (
    <div style={S.card}>
      <div style={S.cardInner}>
        <span style={S.gameBadge}>{badge}</span>
        <h2 style={S.gameTitle} dangerouslySetInnerHTML={{ __html: title }} />
        <p style={S.gameDesc}>{desc}</p>
      </div>
      <Link to={to} style={S.playLink}>Play now →</Link>
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  wrap:    { maxWidth: 900, margin: '0 auto', padding: '48px 32px' },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title:   { fontFamily: SERIF, fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--tx)', letterSpacing: -1, marginBottom: 36 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },

  card:      { background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardInner: { padding: '24px 24px 20px', flex: 1 },

  gameBadge: {
    display: 'inline-block', fontFamily: MONO, fontSize: 11, letterSpacing: 1,
    textTransform: 'uppercase', padding: '3px 9px', borderRadius: 5,
    background: 'var(--bgp)', color: 'var(--pkd)', border: '1px solid var(--pkb)',
    marginBottom: 10,
  },
  gameTitle: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8 },
  gameDesc:  { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },

  playLink: {
    display: 'block', padding: '13px 24px',
    background: 'var(--bgp)', borderTop: '1px solid var(--pkb)',
    fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
    color: 'var(--pk)', textDecoration: 'none',
  },
}
