import NavigationIcon from './NavigationIcon'

/**
 * CredentialsBox — Onboarding Redesign v1 auth form container (Figma node 153:400).
 * White card, tint border, 12px card radius, 314px wide (near-full-width with
 * gutter on phones — 314 fits a 375px viewport minus gutters, Dev Spec §6.3).
 *
 * Top-left exit = NavigationIcon Close → history back, NOT a hardcoded route
 * (Dev Spec §3.2 / §4.2). Pass `exit={false}` to hide it (e.g. mid reset-flow).
 * Centered logo (live /RADlab_Logo.svg — never the Figma placeholder asset),
 * DM Serif title, 12px tagline, then children (form etc.).
 */
export default function CredentialsBox({ title, tagline, exit = true, onExit, children }) {
  return (
    <div style={S.page}>
      <div style={S.card}>
        {exit && (
          <NavigationIcon
            variant="close"
            onClick={onExit}
            label="Close and go back"
            style={S.exit}
          />
        )}
        <div style={S.content}>
          <img src="/RADlab_Logo.svg" alt="" aria-hidden="true" style={S.logo} />
          {title && <h1 style={S.title}>{title}</h1>}
          {tagline && <p style={S.tagline}>{tagline}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

const S = {
  page: {
    display: 'flex', justifyContent: 'center',
    padding: '40px 20px 120px',
  },
  card: {
    background: 'var(--bgc)', border: '1px solid var(--bgp)', borderRadius: 12,
    padding: 16, width: '100%', maxWidth: 314, boxSizing: 'border-box',
  },
  exit: { color: 'var(--pk)', margin: '-6px 0 0 -6px' },
  content: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '0 16px 8px',
  },
  logo: { height: 120, display: 'block' },
  title: {
    fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400,
    fontSize: 24, lineHeight: 1.5, color: 'var(--tx)',
    margin: 0, textAlign: 'center',
  },
  tagline: {
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 400,
    fontSize: 12, lineHeight: 1.5, color: 'var(--tx2)',
    margin: '0 0 8px', textAlign: 'center',
  },
}
