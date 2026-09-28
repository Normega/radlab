import { Link } from 'react-router-dom'
import barn from './owlbarn/assets/c1_plate.webp'

/* ── Night Safari hub (placeholder) ───────────────────────────────────────────
   The illustrated park map comes last in the build order (plan §7, slice F).
   Until then this is a plain list: the exhibits that exist are playable, the
   rest are named so the shape of the safari is visible.
──────────────────────────────────────────────────────────────────────────── */

const EXHIBITS = [
  { slug: 'bat-cave', name: 'The Bat Cave', sense: 'Hearing', blurb: 'The bats are talking about you. Catch what they say before they swoop.' },
  { slug: 'owl-barn', name: 'The Owl Barn', sense: 'Rhythm', blurb: 'You are prey-sized now. Cross the barn in the silences between hoots.', live: true },
  { slug: 'opossum-hut', name: 'The Opossum Hut', sense: 'Touch', blurb: 'A tired mother, twelve babies, a field of dark grass.' },
  { slug: 'raccoon-trash', name: 'The Raccoon Trash Pile', sense: 'Smell', blurb: 'Four picky raccoons expect dinner. Only the most pungent will do.' },
  { slug: 'skunk-den', name: 'The Skunk Den', sense: 'Taste', blurb: 'The babies ate the Skittles. Taste the colour back out of their stripes.' },
  { slug: 'firefly-field', name: 'The Firefly Field', sense: 'Sight', blurb: 'Opens when the other five are done.' },
]

const C = { ground: '#0d0905', card: '#17120e', line: 'rgba(245,230,200,0.14)', text: '#f5e6c8', muted: '#b7a792', amber: '#e0a041', moon: '#9db4e8' }

export default function SafariHub() {
  return (
    <div style={{ minHeight: '100vh', background: C.ground, color: C.text, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px 48px', display: 'grid', gap: 24 }}>
        <Link to="/games" style={{ color: C.muted, fontSize: 14, textDecoration: 'none' }}>← Games</Link>
        <header style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.moon }}>After dark</div>
          <h1 style={{ fontFamily: 'DM Serif Display, Georgia, serif', fontWeight: 400, fontSize: 36, margin: 0 }}>The Night Safari</h1>
          <p style={{ color: C.muted, margin: 0, maxWidth: '60ch', lineHeight: 1.5 }}>
            The bus drops you at the gate a little after ten. Six exhibits, no lights - just the animals and whatever your senses can make of them. Try not to get captured.
          </p>
        </header>
        <div style={{ display: 'grid', gap: 16 }}>
          {EXHIBITS.map(x => {
            const inner = (
              <>
                {x.live && <div style={{ height: 120, borderRadius: 12, background: `url(${barn}) 22% 70% / auto 260% no-repeat`, marginBottom: 8 }} aria-hidden="true" />}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <h2 style={{ fontFamily: 'DM Serif Display, Georgia, serif', fontWeight: 400, fontSize: 20, margin: 0 }}>{x.name}</h2>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: x.live ? C.amber : C.muted }}>{x.live ? `${x.sense} · open` : `${x.sense} · not yet open`}</span>
                </div>
                <p style={{ color: C.muted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>{x.blurb}</p>
              </>
            )
            const style = { display: 'grid', gap: 8, padding: 16, borderRadius: 12, background: C.card, border: `1px solid ${C.line}`, color: C.text, textDecoration: 'none', opacity: x.live ? 1 : 0.6 }
            return x.live
              ? <Link key={x.slug} to={`/safari/${x.slug}`} style={style}>{inner}</Link>
              : <div key={x.slug} style={style} aria-disabled="true">{inner}</div>
          })}
        </div>
      </div>
    </div>
  )
}
