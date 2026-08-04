import { useState } from 'react'

const LOGOS = [
  {
    file: '/RADlab_Logo.svg',
    label: 'RADlab logo — dark background',
    note: 'White outline. Use only on dark backgrounds.',
    bg: '#1c1c1e',
  },
  {
    file: '/RADlab_Logo_light.svg',
    label: 'RADlab logo — light background',
    note: 'Default for the UI. Use this everywhere unless the background is dark.',
    bg: '#ffffff',
  },
]

const CRESTS = [
  { file: '/RADlab_Logo_light.svg', label: 'RADlab crest', bg: '#ffffff' },
  { file: '/UofT_Logo.svg', label: 'University of Toronto crest', bg: '#ffffff' },
]

const OTHER_MARKS = [
  { file: '/HQlogo.png', label: 'HQ mark' },
  { file: '/HQlogo.only.png', label: 'HQ mark — icon only' },
  { file: '/HQlogo_square.png', label: 'HQ mark — square' },
  { file: '/favicon.svg', label: 'Favicon' },
]

const COLORS = [
  { token: '--bg', hex: '#FCF0F5', label: 'Background' },
  { token: '--bgc', hex: '#ffffff', label: 'Card' },
  { token: '--bgp', hex: '#FBEAF3', label: 'Panel' },
  { token: '--pk', hex: '#f068a4', label: 'Primary' },
  { token: '--pkd', hex: '#c04a82', label: 'Primary — dark' },
  { token: '--gy', hex: '#abadb0', label: 'Muted' },
  { token: '--tx', hex: '#1c1c1e', label: 'Text' },
  { token: '--tx2', hex: '#6b6c70', label: 'Text — secondary' },
  { token: '--err-bg', hex: '#FCEBEB', label: 'Error — background' },
  { token: '--err-bd', hex: '#F09595', label: 'Error — border' },
  { token: '--err-tx', hex: '#A32D2D', label: 'Error — text' },
]

const FONTS = [
  {
    family: 'DM Serif Display',
    weights: '400',
    use: 'Headings, section titles',
    stack: "'DM Serif Display', serif",
    href: 'https://fonts.google.com/specimen/DM+Serif+Display',
  },
  {
    family: 'DM Sans',
    weights: '400, 600',
    use: 'Body copy, UI, nav links, CTAs',
    stack: "'DM Sans', system-ui, sans-serif",
    href: 'https://fonts.google.com/specimen/DM+Sans',
  },
  {
    family: 'Space Mono',
    weights: '400, 700',
    use: 'Labels, chips, data readouts',
    stack: "'Space Mono', monospace",
    href: 'https://fonts.google.com/specimen/Space+Mono',
  },
]

function CopyableSwatch({ token, hex, label }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button onClick={copy} className="brand-swatch" style={{ background: hex }} title={`Copy ${hex}`}>
      <span className="brand-swatch__hex">{copied ? 'copied!' : hex}</span>
      <span className="brand-swatch__label">{label}<br />{token}</span>
    </button>
  )
}

function AssetCard({ file, label, note, bg }) {
  return (
    <div className="brand-asset-card">
      <div className="brand-asset-card__preview" style={{ background: bg ?? '#f5f5f5' }}>
        <img src={file} alt={label} />
      </div>
      <div className="brand-asset-card__meta">
        <span className="brand-asset-card__label">{label}</span>
        {note && <span className="brand-asset-card__note">{note}</span>}
        <a href={file} download className="brand-asset-card__download">Download {file.split('.').pop().toUpperCase()}</a>
      </div>
    </div>
  )
}

export default function BrandAssets() {
  return (
    <div className="lab-page brand-page">
      <div className="brand-page__header">
        <h1 className="brand-page__title">RADlab Brand Assets</h1>
        <p className="brand-page__subtitle">
          Logos, crests, color palette, and typography for press, partners, and collaborators.
          This page isn&rsquo;t linked from the site — bookmark or share the URL directly.
        </p>
      </div>

      <section className="lab-section">
        <h2 className="lab-section__heading">Logos</h2>
        <div className="brand-asset-grid">
          {LOGOS.map((l) => <AssetCard key={l.file} {...l} />)}
        </div>
      </section>

      <section className="lab-section">
        <h2 className="lab-section__heading">Crests</h2>
        <div className="brand-asset-grid">
          {CRESTS.map((c) => <AssetCard key={c.file} {...c} />)}
        </div>
      </section>

      <section className="lab-section">
        <h2 className="lab-section__heading">Other marks</h2>
        <div className="brand-asset-grid">
          {OTHER_MARKS.map((m) => <AssetCard key={m.file} {...m} />)}
        </div>
      </section>

      <section className="lab-section">
        <h2 className="lab-section__heading">Color palette</h2>
        <p className="brand-section-note">Click a swatch to copy its hex code.</p>
        <div className="brand-swatch-grid">
          {COLORS.map((c) => <CopyableSwatch key={c.token} {...c} />)}
        </div>
      </section>

      <section className="lab-section">
        <h2 className="lab-section__heading">Typography</h2>
        <p className="brand-section-note">
          Sourced from Google Fonts via <code>@fontsource</code> — no local font files ship with the site.
          Click a family name to get it from Google Fonts.
        </p>
        <div className="brand-font-list">
          {FONTS.map((f) => (
            <div key={f.family} className="brand-font-row">
              <div className="brand-font-row__meta">
                <a href={f.href} target="_blank" rel="noopener noreferrer" className="brand-font-row__name">{f.family}</a>
                <span className="brand-font-row__detail">Weights {f.weights} &middot; {f.use}</span>
              </div>
              <div className="brand-font-row__specimen" style={{ fontFamily: f.stack }}>Aa Bb Cc 123</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
