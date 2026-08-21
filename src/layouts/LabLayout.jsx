import { NavLink, Outlet, Link } from 'react-router-dom'

const FOOTER_LINKS = [
  { to: '/platform',    label: 'Platform' },
  { to: '/lab/about',   label: 'Lab' },
  { to: '/lab/media',   label: 'Media' },
  { to: '/lab/contact', label: 'Contact' },
]

const NAV_LINKS = [
  { to: '/lab/about', label: 'About' },
  { to: '/lab/people', label: 'People' },
  { to: '/lab/research', label: 'Research' },
  { to: '/lab/publications', label: 'Publications' },
  { to: '/lab/media', label: 'Media' },
  { to: '/lab/contact', label: 'Contact' },
]

export default function LabLayout() {
  return (
    <div style={{ background: '#FCF0F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={S.nav}>
        <Link to="/" style={S.brand}>
          <div style={{ height: 32, display: 'flex', alignItems: 'center' }}>
            <img src="/RADlab_Logo.svg" style={{ height: '100%', display: 'block' }} alt="RADlab logo" />
          </div>
          <span style={S.wordmark}>RAD<b style={{ color: '#f068a4', fontWeight: 400 }}>lab</b></span>
        </Link>
        <div style={S.links}>
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => isActive ? { ...S.link, ...S.linkActive } : S.link}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <footer style={S.footer}>
        <div style={S.footerLinks}>
          {FOOTER_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} style={S.footerLink}>{label}</Link>
          ))}
        </div>
        © RADlab · University of Toronto Mississauga
      </footer>
    </div>
  )
}

const S = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(252,240,245,0.97)', /* base — matches Nav + Landing */
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(240,104,164,0.35)', /* visible divider (--pkbs) */
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: 56,
    gap: 16,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 },
  wordmark: { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 22, letterSpacing: -0.5, color: '#1c1c1e', lineHeight: 1 },
  links: { display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' },
  link: {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 14,
    color: '#6b6c70',
    textDecoration: 'none',
    paddingBottom: 2,
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  },
  linkActive: {
    color: '#f068a4',
    borderBottom: '2px solid #f068a4',
  },
  footerLinks: {
    display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
    gap: '10px 26px', marginBottom: 12,
  },
  footerLink: {
    fontFamily: '"Space Mono", "Courier New", monospace',
    fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#abadb0', textDecoration: 'none',
  },
  footer: {
    textAlign: 'center',
    padding: '1.5rem',
    fontSize: 13,
    color: '#abadb0',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    borderTop: '1px solid rgba(180,100,140,0.13)',
  },
}
