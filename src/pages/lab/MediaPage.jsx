import { useState } from 'react'
import mediaItems from '../../data/media.json'

const videos   = mediaItems.filter(m => m.type === 'video')
const podcasts = mediaItems.filter(m => m.type === 'podcast')
const print    = mediaItems.filter(m => m.type === 'print')

function VideoCard({ item }) {
  const [hov, setHov] = useState(false)
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ ...S.card, ...(hov ? S.cardHov : {}) }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <div style={S.thumb}>
        <img
          src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`}
          alt={item.title}
          loading="lazy"
          style={S.thumbImg}
        />
        <span style={S.play}>▶</span>
      </div>
      <div style={S.cardBody}>
        <p style={S.cardTitle}>{item.title}</p>
        <p style={S.cardMeta}>{item.outlet}{item.date ? ` · ${item.date}` : ''}</p>
      </div>
    </a>
  )
}

function LogoCard({ item }) {
  const [hov, setHov] = useState(false)
  const El = item.url ? 'a' : 'div'
  const linkProps = item.url
    ? { href: item.url, target: '_blank', rel: 'noopener noreferrer' }
    : {}
  return (
    <El {...linkProps}
      style={{ ...S.card, ...(item.url ? {} : S.cardNoLink), ...(hov && item.url ? S.cardHov : {}) }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <div style={S.logoWrap}>
        {item.logo
          ? <img src={item.logo} alt={item.outlet} loading="lazy" style={S.logo} />
          : <span style={S.logoFallback}>{item.outlet}</span>
        }
      </div>
      <div style={S.cardBody}>
        <p style={S.cardTitle}>{item.title}</p>
        <p style={S.cardMeta}>{item.outlet}{item.date ? ` · ${item.date}` : ''}</p>
      </div>
    </El>
  )
}

export default function MediaPage() {
  return (
    <div className="lab-page">

      {/* ── Hero ── */}
      <section className="lab-section">
        <p style={S.eyebrow}>Press &amp; Media</p>
        <h1 style={S.h1}>In the Media</h1>
        <p style={S.intro}>
          Interviews, podcast appearances, and press coverage featuring Norman Farb and the RAD Lab.
        </p>
      </section>

      {/* ── Video ── */}
      {videos.length > 0 && (
        <section className="lab-section">
          <h2 className="lab-section__heading">Video</h2>
          <div style={S.videoGrid}>
            {videos.map(item => <VideoCard key={item.url} item={item} />)}
          </div>
        </section>
      )}

      {/* ── Podcasts ── */}
      {podcasts.length > 0 && (
        <section className="lab-section">
          <h2 className="lab-section__heading">Podcasts</h2>
          <div style={S.logoGrid}>
            {podcasts.map(item => <LogoCard key={item.url} item={item} />)}
          </div>
        </section>
      )}

      {/* ── Print & Online ── */}
      {print.length > 0 && (
        <section className="lab-section">
          <h2 className="lab-section__heading">Print &amp; Online</h2>
          <div style={S.logoGrid}>
            {print.map(item => <LogoCard key={item.url} item={item} />)}
          </div>
        </section>
      )}

      {/* ── Press contact ── */}
      <section className="lab-section">
        <div style={S.pressBox}>
          <h2 style={S.pressHeading}>Press Inquiries</h2>
          <p style={S.pressBody}>
            For interviews, speaking engagements, or media requests:
          </p>
          <a href="mailto:norman@radlab.zone" style={S.pressEmail}>
            norman@radlab.zone
          </a>
        </div>
      </section>

    </div>
  )
}

const S = {
  eyebrow: {
    fontFamily: '"Space Mono", monospace',
    fontSize: '0.7rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#f068a4',
    margin: '0 0 0.75rem',
  },
  h1: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
    fontWeight: 400,
    color: '#1c1c1e',
    margin: '0 0 0.75rem',
  },
  intro: {
    fontSize: '1rem',
    lineHeight: 1.75,
    color: '#555',
    margin: 0,
    maxWidth: 620,
  },

  // Grids
  videoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1.25rem',
  },
  logoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1.25rem',
  },

  // Shared card base
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    textDecoration: 'none',
    border: '1px solid rgba(180,100,140,0.13)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  cardNoLink: {
    cursor: 'default',
    pointerEvents: 'none',
  },
  cardHov: {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 28px rgba(180,100,140,0.14)',
  },

  // Video thumbnail
  thumb: {
    position: 'relative',
    aspectRatio: '16 / 9',
    overflow: 'hidden',
    background: '#111',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    opacity: 0.88,
    transition: 'opacity 0.2s',
  },
  play: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    color: '#fff',
    textShadow: '0 2px 10px rgba(0,0,0,0.55)',
    pointerEvents: 'none',
  },

  // Logo area
  logoWrap: {
    height: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    borderBottom: '1px solid rgba(180,100,140,0.1)',
    background: '#fff',
  },
  logo: {
    maxHeight: 64,
    maxWidth: '100%',
    width: 'auto',
    objectFit: 'contain',
  },
  logoFallback: {
    fontFamily: '"Space Mono", monospace',
    fontSize: '0.75rem',
    color: '#abadb0',
    textAlign: 'center',
  },

  // Card body
  cardBody: {
    padding: '0.9rem 1.1rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: 1,
  },
  cardTitle: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: '0.95rem',
    fontStyle: 'italic',
    lineHeight: 1.4,
    color: '#1c1c1e',
    margin: 0,
  },
  cardMeta: {
    fontFamily: '"Space Mono", monospace',
    fontSize: '0.7rem',
    color: '#abadb0',
    letterSpacing: '0.04em',
    margin: 0,
  },

  // Press contact
  pressBox: {
    background: '#fff',
    borderRadius: 14,
    padding: '2rem 2.5rem',
    border: '1px solid rgba(180,100,140,0.13)',
    maxWidth: 480,
  },
  pressHeading: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: '1.4rem',
    fontWeight: 400,
    color: '#1c1c1e',
    margin: '0 0 0.5rem',
  },
  pressBody: {
    fontSize: '0.9rem',
    color: '#555',
    lineHeight: 1.7,
    margin: '0 0 0.75rem',
  },
  pressEmail: {
    fontFamily: '"Space Mono", monospace',
    fontSize: '0.875rem',
    color: '#f068a4',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(240,104,164,0.35)',
    paddingBottom: 2,
  },
}
