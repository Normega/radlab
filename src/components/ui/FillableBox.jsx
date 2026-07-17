/**
 * FillableBox — Onboarding Redesign v1 primitive (Figma node 152:250).
 * Labelled text input with background fill for contrast (Dev Spec §4.3).
 * Structure: SPACE MONO label / filled input (card white, tint border, 12px radius) / description.
 * Fill is --bgc (white), not --bg: every consumer renders this directly on the
 * --bg page, so a --bg fill made fields invisible (reported 2026-07-17).
 *
 * Deviations from Figma, per repo guardrails (index.css --fs rules):
 *   - input text 16px, not 12px (iOS auto-zoom floor; --fs-body)
 *   - description 12px, not 10px (WCAG floor; --fs-min)
 *   - input min-height 40px, not 32px (≥44px touch target with border, Dev Spec §6.2)
 */
export default function FillableBox({ label, description, id, style, inputStyle, ...inputProps }) {
  const inputId = id || (label ? `fb-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined)
  return (
    <div style={{ ...S.wrap, ...style }}>
      {label && <label htmlFor={inputId} style={S.label}>{label}</label>}
      <input id={inputId} style={{ ...S.input, ...inputStyle }} {...inputProps} />
      {description && <div style={S.desc}>{description}</div>}
    </div>
  )
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 4, width: '100%' },
  label: {
    fontFamily: '"Space Mono", monospace', fontWeight: 400,
    fontSize: 'var(--fs-mono-sm)', lineHeight: 1.5,
    color: 'var(--tx)', textTransform: 'uppercase',
  },
  input: {
    minHeight: 40, padding: '0 8px', boxSizing: 'border-box', width: '100%',
    background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 12,
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 400,
    fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--tx)',
    outline: 'none',
  },
  desc: {
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 400,
    fontSize: 'var(--fs-min)', lineHeight: 1.5, color: 'var(--gy)',
  },
}
