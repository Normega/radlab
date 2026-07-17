/**
 * Checkbox — Onboarding Redesign v1 primitive (Figma node 170:1159).
 * 16px square, 1px text-main border; checked = primary-pink fill + check mark.
 * Square corners per Figma (the 12px card radius does not apply to checkboxes).
 *
 * With `children`, renders a full <label> row (≥44px touch target, Dev Spec §6.2);
 * bare otherwise. The native input is visually hidden but drives a11y/keyboard.
 */
export default function Checkbox({ checked, onChange, children, style, boxStyle, ...rest }) {
  const box = (
    <span style={{ ...S.box, ...(checked ? S.boxChecked : null), ...boxStyle }} aria-hidden="true">
      {checked && <CheckMark />}
    </span>
  )
  return (
    <label style={{ ...(children ? S.row : S.bare), ...style }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={S.native} {...rest} />
      {box}
      {children && <span style={S.labelText}>{children}</span>}
    </label>
  )
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5 L4.8 9.2 L10 3.2" stroke="var(--tx)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const S = {
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    minHeight: 44, cursor: 'pointer', userSelect: 'none',
  },
  bare: { display: 'inline-flex', alignItems: 'center', cursor: 'pointer' },
  native: {
    position: 'absolute', opacity: 0, width: 1, height: 1,
    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
  },
  box: {
    width: 16, height: 16, flexShrink: 0, boxSizing: 'border-box',
    border: '1px solid var(--tx)', background: 'var(--bgc)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.12s ease',
  },
  boxChecked: { background: 'var(--pk)' },
  labelText: {
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 400,
    fontSize: 'var(--fs-body-sm)', lineHeight: 1.5, color: 'var(--tx)',
  },
}
