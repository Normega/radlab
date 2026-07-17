import { Link } from 'react-router-dom'

/**
 * Button/PrimaryCTA — Onboarding Redesign v1 primitive (Figma node 132:472).
 * Variants: BgPink (default), BgWhite; Inactive is derived from `disabled`.
 * Radius 24px = clickable-button rule (Dev Spec §1.3). DM Sans 600/16 (body/600/16).
 *
 * Renders a <Link> when `to` is given, otherwise a <button>.
 * Disabled style is Figma's grayscale Inactive (gate ruling: brief guardrail #5).
 */
export default function PrimaryCTA({ to, onClick, disabled = false, variant = 'pink', type = 'button', style, children, ...rest }) {
  const s = {
    ...S.base,
    ...(disabled ? S.inactive : variant === 'white' ? S.white : S.pink),
    ...style,
  }
  if (to && !disabled) {
    return <Link to={to} style={s} {...rest}>{children}</Link>
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={s} {...rest}>
      {children}
    </button>
  )
}

const S = {
  base: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '10px 16px', borderRadius: 24, border: 'none',
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600,
    fontSize: 16, lineHeight: 1.5, whiteSpace: 'nowrap',
    textDecoration: 'none', cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  pink:     { background: 'var(--pk)',  color: '#fff' },
  white:    { background: 'var(--bgc)', color: 'var(--pk)' },
  inactive: { background: 'var(--gy)',  color: '#fff', cursor: 'default' },
}
