/**
 * NavigationIcon — Onboarding Redesign v1 primitive (Figma node 153:404).
 * The exit/back affordance (top-left of auth boxes, Dev Spec §3.2).
 * Variants: close (X), back (←). Inline SVG (Figma's PNG assets not shipped).
 * Renders a 40px button (≥44px effective tap area with spacing, Dev Spec §6.3).
 * Default behavior is history back (Dev Spec §2.4) unless onClick is given.
 */
import { useNavigate } from 'react-router-dom'

export default function NavigationIcon({ variant = 'close', onClick, label, style, ...rest }) {
  const navigate = useNavigate()
  const handle = onClick || (() => navigate(-1))
  return (
    <button
      type="button"
      onClick={handle}
      aria-label={label || (variant === 'back' ? 'Go back' : 'Close')}
      style={{ ...S.btn, ...style }}
      {...rest}
    >
      {variant === 'back' ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 4 L6.5 10 L12.5 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

const S = {
  btn: {
    width: 40, height: 40, padding: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', borderRadius: 24,
    color: 'var(--tx2)', cursor: 'pointer',
  },
}
