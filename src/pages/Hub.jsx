import { useState } from 'react'
import { Link } from 'react-router-dom'

function HubCard({ title, desc, to, href }) {
  const [hov, setHov] = useState(false)
  const content = (
    <div
      style={{
        background: hov ? '#1c1c1e' : '#ffffff',
        borderRadius: 12,
        padding: '2rem',
        boxShadow: '0 2px 12px rgba(180,100,140,0.08)',
        cursor: 'pointer',
        transition: 'background 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minHeight: 140,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <h2 style={{
        fontFamily: '"DM Serif Display", serif',
        fontSize: '1.5rem',
        fontWeight: 400,
        color: hov ? '#ffffff' : '#1c1c1e',
        margin: 0,
        transition: 'color 0.2s',
      }}>{title}</h2>
      <p style={{
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '0.875rem',
        color: hov ? 'rgba(255,255,255,0.65)' : '#abadb0',
        margin: 0,
        transition: 'color 0.2s',
        lineHeight: 1.5,
      }}>{desc}</p>
    </div>
  )
  const linkStyle = { textDecoration: 'none', display: 'block' }
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{content}</a>
  return <Link to={to} style={linkStyle}>{content}</Link>
}

export default function Hub() {
  return (
    <div style={{
      background: '#FCF0F5',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
          <img src="/RADlab_Logo.svg" height="56" alt="RADlab" />
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1.25rem',
        }}>
          <HubCard title="Come, See" desc="Perceptual games and research tasks" to="/games" />
          <HubCard title="Our Lab" desc="People, research, and publications" to="/lab/about" />
          <HubCard title="UTMaps" desc="Student wellbeing mapping project" href="https://utmaps.ca" />
          <div style={{
            borderRadius: 12,
            border: '1.5px dashed #d0b8c8',
            minHeight: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: '#d0b8c8', fontSize: '0.75rem', fontFamily: '"Space Mono", monospace' }}>
              coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
