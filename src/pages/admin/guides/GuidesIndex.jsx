import { Link } from 'react-router-dom'
import { GUIDES } from './guides'

const FONT = '"DM Sans",system-ui,sans-serif'

export default function GuidesIndex() {
  return (
    <div>
      <h1 style={S.h1}>Lab Guides</h1>
      <p style={S.sub}>How we run things in the lab. Read the guide for a study before your first shift on it.</p>
      <div style={S.list}>
        {GUIDES.map(g => (
          <Link key={g.slug} to={`/admin/guides/${g.slug}`} style={S.card}>
            <span style={S.title}>{g.title}</span>
            <span style={S.summary}>{g.summary}</span>
            <span style={S.meta}>Updated {g.updated}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

const S = {
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  sub: { fontFamily: FONT, fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)', margin: '0 0 32px', maxWidth: 720 },
  list: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 },
  card: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: 16, textDecoration: 'none',
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
  },
  title: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, color: 'var(--tx)' },
  summary: { fontFamily: FONT, fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)' },
  meta: { fontFamily: FONT, fontSize: 12, color: 'var(--tx3)' },
}
