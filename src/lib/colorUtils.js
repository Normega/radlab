export function hex2rgb(h) {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
}
export function lighten(h, a) { const [r, g, b] = hex2rgb(h); return rgb2hex(r + a, g + a, b + a) }
export function darken(h, a)  { return lighten(h, -a) }
export function mix(a, b, t)  {
  const [r1, g1, b1] = hex2rgb(a), [r2, g2, b2] = hex2rgb(b)
  return rgb2hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}
