export const AURA_COLORS = [
  { label: 'Silver',   value: '#C0C0C0' },
  { label: 'Gold',     value: '#ffb300' },
  { label: 'Flame',    value: '#ff4400' },
  { label: 'Ghost',    value: '#60b8e8' },
  { label: 'Electric', value: '#88ff00' },
  { label: 'Violet',   value: '#9b50e0' },
]

export const AURA_DEFAULT_COLOR = '#C0C0C0'

export function auraParamsFromSync(sync) {
  if (sync < 0.5) return null
  if (sync >= 0.8) return { inset: 4, opacity: 0.4 }
  if (sync >= 0.7) return { inset: 3, opacity: 0.3 }
  if (sync >= 0.6) return { inset: 2, opacity: 0.2 }
  return { inset: 1, opacity: 0.1 }
}
