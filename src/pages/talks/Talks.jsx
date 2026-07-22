// Private talks hub at /talks — a small library of slide decks, gated to the
// PI (superAdmin) by TalksRoute. Add a future deck by appending one entry to
// TALKS below; no other change needed.
import { Link } from 'react-router-dom'

const TALKS = [
  {
    to: '/toni-july-2026',
    kicker: 'ToNI Users Meeting · July 2026',
    title: 'From DICOMs to denoised fMRI',
    sub: 'fMRI preprocessing and downstream analysis with an AI coding agent in the loop.',
    tags: ['Neuroimaging methods', 'Dataset 1 + 2', 'Working with Claude'],
    accent: '#4A90D9',
  },
  {
    to: '/keynote',
    kicker: 'ISARP Keynote · 2026',
    title: 'What You Miss Won’t Move You',
    sub: 'Awareness connects respiratory change to subjective arousal.',
    tags: ['Interoception', 'BCAT', 'fMRI'],
    accent: '#f068a4',
  },
]

export default function Talks() {
  return (
    <div style={S.page}>
      <div style={S.inner}>
        <header style={S.header}>
          <div>
            <div style={S.kicker}>Private · talks library</div>
            <h1 style={S.h1}>Talks</h1>
            <p style={S.lead}>Slide decks, presented and archived. Visible only to you.</p>
          </div>
          <Link to="/dashboard" style={S.back}>← radlab.zone</Link>
        </header>

        <div style={S.grid}>
          {TALKS.map(t => (
            <Link key={t.to} to={t.to} style={S.card} className="talk-card">
              <span style={{ ...S.cardBar, background: t.accent }} />
              <div style={S.cardBody}>
                <div style={{ ...S.cardKicker, color: t.accent }}>{t.kicker}</div>
                <h2 style={S.cardTitle}>{t.title}</h2>
                <p style={S.cardSub}>{t.sub}</p>
                <div style={S.tags}>
                  {t.tags.map(tag => <span key={tag} style={S.tag}>{tag}</span>)}
                </div>
              </div>
              <span style={{ ...S.open, color: t.accent }}>Open the deck →</span>
            </Link>
          ))}
        </div>

        <p style={S.foot}>
          Decks are click-through (← / → / Space, or click to advance). Log in on the presenting
          machine beforehand — the session persists and the show then runs fully offline.
        </p>
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg, #FCF0F5)', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)', padding: '48px 24px 64px' },
  inner: { maxWidth: 960, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 34 },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px,6vw,56px)', fontWeight: 400, margin: '6px 0 8px', lineHeight: 1.05 },
  lead: { fontSize: 'clamp(15px,2vw,19px)', color: 'var(--tx2)', margin: 0 },
  back: { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', border: '1px solid var(--bd)', borderRadius: 999, padding: '8px 16px', background: '#fff', whiteSpace: 'nowrap' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 },
  card: { display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', transition: 'transform 0.15s ease, box-shadow 0.15s ease' },
  cardBar: { height: 6, width: '100%' },
  cardBody: { padding: '20px 22px 12px', flex: 1 },
  cardKicker: { fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.04em' },
  cardTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(21px,2.6vw,28px)', fontWeight: 400, margin: '8px 0 8px', lineHeight: 1.12, color: 'var(--tx)' },
  cardSub: { fontSize: 15, color: 'var(--tx2)', margin: 0, lineHeight: 1.45 },
  tags: { display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 },
  tag: { fontSize: 12, color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 999, padding: '4px 11px' },
  open: { fontFamily: '"Space Mono",monospace', fontSize: 13, fontWeight: 700, padding: '0 22px 20px' },

  foot: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', marginTop: 30, lineHeight: 1.6, maxWidth: 640 },
}

// Card hover lift — injected once.
if (typeof document !== 'undefined' && !document.getElementById('talks-hover')) {
  const s = document.createElement('style')
  s.id = 'talks-hover'
  s.textContent = `.talk-card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(0,0,0,0.10)!important}`
  document.head.appendChild(s)
}
