/**
 * EyebrowLabel — Onboarding Redesign v1 primitive (Figma node 132:455).
 * Non-clickable tag: Space Mono 400/14, primary-dark text, 12px radius
 * (12px = eyebrow-labels-and-cards rule, Dev Spec §1.3).
 * Variants: pink (tint bg, default), white (surface bg), nobg.
 */
export default function EyebrowLabel({ variant = 'pink', style, children, ...rest }) {
  const s = {
    ...S.base,
    ...(variant === 'nobg' ? S.nobg : variant === 'white' ? S.white : S.pink),
    ...style,
  }
  return <span style={s} {...rest}>{children}</span>
}

const S = {
  base: {
    display: 'inline-flex', alignItems: 'center',
    padding: 8, borderRadius: 12,
    fontFamily: '"Space Mono", monospace', fontWeight: 400,
    fontSize: 14, lineHeight: 1.5, letterSpacing: 0,
    color: 'var(--pkd)', textTransform: 'uppercase', whiteSpace: 'nowrap',
  },
  pink:  { background: 'var(--bgp)', border: '1px solid var(--bgp)' },
  white: { background: 'var(--bgc)', border: '1px solid var(--bgp)' },
  nobg:  { background: 'transparent', border: 'none', padding: 0 },
}
