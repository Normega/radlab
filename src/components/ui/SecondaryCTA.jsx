import { Link } from 'react-router-dom'

/**
 * Button/SecondaryCTA — Onboarding Redesign v1 primitive (Figma node 132:479).
 * Outline pill: 1px text-secondary border, text-secondary label, 24px radius.
 * Renders a <Link> when `to` is given, otherwise a <button>.
 */
export default function SecondaryCTA({ to, onClick, type = 'button', style, children, ...rest }) {
  const s = { ...S.base, ...style }
  if (to) {
    return <Link to={to} style={s} {...rest}>{children}</Link>
  }
  return (
    <button type={type} onClick={onClick} style={s} {...rest}>
      {children}
    </button>
  )
}

const S = {
  base: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '10px 16px', borderRadius: 24,
    border: '1px solid var(--tx2)', background: 'transparent',
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600,
    fontSize: 16, lineHeight: 1.5, whiteSpace: 'nowrap',
    color: 'var(--tx2)', textDecoration: 'none', cursor: 'pointer',
    transition: 'border-color 0.15s ease, color 0.15s ease',
  },
}
