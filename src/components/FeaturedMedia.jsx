import { useState } from 'react'
import { Link } from 'react-router-dom'
import mediaItems from '../data/media.json'

// Lazy-loaded from Landing so media.json stays out of the entry bundle
// (Landing is the one deliberately static route import — see CLAUDE.md).
// Newest first, so flagging a fresh appearance in media.json leads the strip.
const featured = mediaItems
  .filter(m => m.featured)
  .sort((a, b) => Number(b.date || 0) - Number(a.date || 0))
  .slice(0, 3)

function Tile({ item }) {
  const [hov, setHov] = useState(false)
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{
        ...S.tile,
        borderColor: hov ? 'var(--pk)' : 'var(--pkb)',
        transform:   hov ? 'translateY(-3px)' : 'none',
        boxShadow:   hov ? '0 10px 28px rgba(28,28,30,0.10)' : 'none',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      {item.logo
        ? <img src={item.logo} alt="" aria-hidden="true" loading="lazy" style={S.logo} />
        : <span style={S.logoFallback} aria-hidden="true">{item.outlet.slice(0, 1)}</span>
      }
      <span style={S.body}>
        <span style={{ ...S.outlet, color: hov ? 'var(--pk)' : 'var(--gy)' }}>{item.outlet}</span>
        <span style={S.title}>{item.title}</span>
      </span>
    </a>
  )
}

export default function FeaturedMedia() {
  if (featured.length === 0) return null

  return (
    <section style={S.section} className="px-5 md:px-[52px]" aria-labelledby="featured-media-heading">
      <div style={S.head}>
        <h2 id="featured-media-heading" style={S.eyebrow}>Recently heard on</h2>
        <Link to="/lab/media" style={S.all}>All press &amp; media →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3" style={S.grid}>
        {featured.map(item => <Tile key={item.url} item={item} />)}
      </div>
    </section>
  )
}

const MONO = '"Space Mono", "Courier New", monospace'

const S = {
  section: { paddingTop: 0, paddingBottom: 84, position: 'relative', zIndex: 1 },

  head: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 10, marginBottom: 18, maxWidth: 1080, marginInline: 'auto',
  },
  eyebrow: {
    fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.13em',
    textTransform: 'uppercase', fontWeight: 700, color: 'var(--pk)', margin: 0,
  },
  all: {
    fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--gy)', textDecoration: 'none',
    borderBottom: '1px solid var(--pkb)',
  },

  grid: { gap: 14, maxWidth: 1080, marginInline: 'auto' },

  tile: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', borderRadius: 14,
    border: '1.5px solid', background: 'var(--bgc)',
    textDecoration: 'none', cursor: 'pointer',
    transition: 'border-color 0.28s ease, transform 0.22s ease, box-shadow 0.28s ease',
  },
  logo: {
    width: 52, height: 52, flexShrink: 0, borderRadius: 10,
    objectFit: 'contain', display: 'block',
  },
  logoFallback: {
    width: 52, height: 52, flexShrink: 0, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bgp)', color: 'var(--pk)', fontFamily: MONO, fontSize: '1.1rem',
  },
  body: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  outlet: {
    fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.1em',
    textTransform: 'uppercase', transition: 'color 0.28s',
  },
  title: {
    fontSize: '0.875rem', lineHeight: 1.4, color: 'var(--tx)', fontWeight: 400,
  },
}
