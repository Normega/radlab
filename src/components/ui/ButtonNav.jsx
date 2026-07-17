import { Link } from 'react-router-dom'

/**
 * ButtonNav — Onboarding Redesign v1 primitive (Figma node 2001:1213).
 * Borderless nav pill, DM Sans 600/16, 24px radius padding box.
 * States:
 *   - default:  text-secondary
 *   - active:   text-main (current route; Figma's 4px text-shadow dropped as artifact)
 *   - inert:    text-muted, non-navigating — the guest preview-only state for
 *               Dashboard/Games (DRIFT-REPORT §9 Q7: visible, inert, hint on hover)
 */
export default function ButtonNav({ to, onClick, active = false, inert = false, hint, style, children, ...rest }) {
  const s = {
    ...S.base,
    color: inert ? 'var(--gy)' : active ? 'var(--tx)' : 'var(--tx2)',
    cursor: inert ? 'default' : 'pointer',
    ...style,
  }
  if (inert) {
    return (
      <span style={s} title={hint || 'Join free to unlock'} aria-disabled="true" {...rest}>
        {children}
      </span>
    )
  }
  if (to) {
    return <Link to={to} onClick={onClick} style={s} {...rest}>{children}</Link>
  }
  return (
    <button type="button" onClick={onClick} style={{ ...s, border: 'none', background: 'transparent' }} {...rest}>
      {children}
    </button>
  )
}

const S = {
  base: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '10px 16px', borderRadius: 24,
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600,
    fontSize: 16, lineHeight: 1.5, whiteSpace: 'nowrap',
    textDecoration: 'none', background: 'transparent',
    transition: 'color 0.15s ease',
  },
}
