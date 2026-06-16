import { Link } from 'react-router-dom'

const GAMES = [
  // ── On public /games page ──────────────────────────────────────────────
  { name: 'Still Water',   slug: 'still-water',    badge: 'Emotion check-in',             public: true  },
  { name: 'Face Read',     slug: 'face-read',      badge: 'Emotion recognition',          public: true  },
  { name: 'Drift',         slug: 'drift',           badge: 'Time perception',              public: true  },
  { name: 'First Contact', slug: 'first-contact',  badge: 'Breath sync',                  public: true  },
  { name: 'Pond Watch',    slug: 'pond-watch',     badge: 'Go/No-Go · Reaction time',    public: true  },
  { name: 'Owl Barn',      slug: 'owl-barn',       badge: 'Hearing · Rhythm · Strategy', public: true  },
  { name: 'Farm Joy',      slug: 'farm-joy',       badge: 'Values clarification',         public: true  },
  { name: 'Ebb & Flow',    slug: 'ebb-flow',       badge: 'Interoception · Breath sync',  public: true  },
  // ── Study / researcher tools ───────────────────────────────────────────
  { name: 'AptitudeSuite', slug: 'aptitude-suite', badge: 'Cognitive assessment',         public: false },
  { name: 'WordMax',       slug: 'word-max',       badge: 'Language · Working memory',    public: false },
  { name: 'ColorMax',      slug: 'color-max',      badge: 'Attention · Motor',            public: false },
  { name: 'Breath Belt',   slug: 'breath-belt',    badge: 'Physio · Breath sync',         public: false, note: 'Requires Polar H10 belt' },
]

export default function GamesPage() {
  const publicGames = GAMES.filter(g => g.public)
  const studyGames  = GAMES.filter(g => !g.public)

  return (
    <div>
      <h1 style={S.h1}>Games</h1>
      <p style={S.sub}>All tasks available on the platform. Click Review to run any game as a participant would see it.</p>

      <Section title="Public — available to all participants" games={publicGames} />
      <Section title="Study & researcher tools" games={studyGames} />
    </div>
  )
}

function Section({ title, games }) {
  return (
    <div style={S.section}>
      <h2 style={S.sectionTitle}>{title}</h2>
      <div style={S.grid}>
        {games.map(g => <GameCard key={g.slug} {...g} />)}
      </div>
    </div>
  )
}

function GameCard({ name, slug, badge, note }) {
  return (
    <div style={S.card}>
      <div style={S.cardBody}>
        <span style={S.badge}>{badge}</span>
        <h3 style={S.gameName}>{name}</h3>
        {note && <p style={S.note}>{note}</p>}
      </div>
      <Link to={`/games/${slug}`} style={S.reviewLink} target="_blank" rel="noreferrer">
        Review →
      </Link>
    </div>
  )
}

const S = {
  h1: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 28, fontWeight: 400,
    color: 'var(--tx)', margin: '0 0 6px',
  },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 36px' },

  section:      { marginBottom: 40 },
  sectionTitle: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 11, fontWeight: 700,
    color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.08em',
    margin: '0 0 14px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },

  card: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardBody: { padding: '18px 18px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },

  badge: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 10, color: 'var(--tx3)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  gameName: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 20, fontWeight: 400,
    color: 'var(--tx)', margin: 0,
  },
  note: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 12, color: 'var(--tx3)',
    margin: 0, lineHeight: 1.4,
  },

  reviewLink: {
    display: 'block', padding: '10px 18px',
    background: 'var(--bgp)', borderTop: '1px solid var(--pkb)',
    fontFamily: '"Space Mono",monospace', fontSize: 11,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--pk)', textDecoration: 'none',
  },
}
