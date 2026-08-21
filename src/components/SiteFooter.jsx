import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * SiteFooter — the one-line site footer: the Landing hub cards' four
 * destinations as links (same names, same targets), identity right.
 * Extracted from Landing 2026-08-21 when the platform pages gained it.
 * Come, See resolves per session exactly like the hub card.
 * LabLayout keeps its own footer (same links, its DM Sans register).
 */
export default function SiteFooter({ session, style }) {
  const links = [
    { to: session ? '/dashboard' : '/platform', label: 'Come, See' },
    { href: 'http://www.utmap.org', label: 'UTMaps' },
    { to: '/lab/about', label: 'People & Research' },
    { href: 'https://www.betterineverysense.com', label: 'Book' },
  ]
  return (
    <footer style={{ ...S.footer, ...style }} className="px-5 md:px-[52px]">
      <div style={S.links}>
        {links.map(l => <FooterLink key={l.label} {...l} />)}
      </div>
      <div style={S.text}>
        <span style={S.pulse} />
        <strong style={{ color: 'var(--tx)' }}>RADlab</strong>&nbsp;&middot;&nbsp;University of Toronto Mississauga
      </div>
    </footer>
  )
}

function FooterLink({ to, href, label }) {
  const [hov, setHov] = useState(false)
  const style = { ...S.link, color: hov ? 'var(--pk)' : 'var(--gy)' }
  const hover = { onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false) }
  return to
    ? <Link to={to} style={style} {...hover}>{label}</Link>
    : <a href={href} target="_blank" rel="noopener noreferrer" style={style} {...hover}>{label}</a>
}

const MONO = '"Space Mono", "Courier New", monospace'

const S = {
  footer: {
    marginTop: 'auto', paddingTop: 24, paddingBottom: 24,
    borderTop: '1px solid var(--pkbs)', /* visible divider, matches the nav */
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: '12px 20px', position: 'relative', zIndex: 1,
  },
  links: { display: 'flex', flexWrap: 'wrap', gap: '10px 26px' },
  link: {
    fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.1em',
    textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.15s ease',
  },
  text: {
    fontFamily: MONO, fontSize: '0.75rem', color: 'var(--gy)',
    letterSpacing: '0.06em', display: 'flex', alignItems: 'center',
  },
  pulse: {
    display: 'inline-block', width: 6, height: 6, background: 'var(--pk)',
    borderRadius: '50%', marginRight: 7, verticalAlign: 'middle',
    animation: 'hub-pulse 2.6s ease-in-out infinite',
  },
}
