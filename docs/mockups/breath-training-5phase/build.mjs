// Mock-up generator for the five-phase breath training game (working title
// "Windward"). Writes one standalone SVG per screen, plus index.html to view
// them together. Every screen shares the same parts (sky, hills, kites, ghost,
// pads), so the art stays consistent while the design changes.
//
//   node docs/mockups/breath-training-5phase/build.mjs
//
// Geometry follows Kite 2.0 (F:\gits\Handbook\src\games\Kite2\kiteGeom.js):
// one breath {inh, hold, exh, rest} = four spars (top, right, bottom, left)
// with the same floors and cap. Palette: Kite 2.0 sky, KITE_COLORS, ink.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const W = 1280, H = 720
const INK = '#1f2a3d'
const KITE_COLORS = ['#2fa9b3', '#e2557f', '#f0a032', '#8a6fd1', '#62a845']
const SANS = "'DM Sans', system-ui, sans-serif"
const SERIF = "'DM Serif Display', Georgia, serif"
const MONO = "'Space Mono', ui-monospace, monospace"

// ── Kite 2.0 geometry ──────────────────────────────────────────────────────
const CAP_S = 9, FLOOR_UP = 0.4, FLOOR_SIDE = 0.55
// G1 (Norm, 2026-11-07): pauses get their own axis, 1.5x wider per second than in/out
const SIDE_K = 1.5
const axisK = k => (k === 'right' || k === 'left') ? SIDE_K : 1
function spars(b, S, sideK = SIDE_K) {
  const c = v => Math.min(CAP_S, Math.max(0, v || 0))
  return {
    top: Math.max(FLOOR_UP, c(b.inh)) * S,
    right: Math.max(FLOOR_SIDE, c(b.hold)) * S * sideK,
    bottom: Math.max(FLOOR_UP, c(b.exh)) * S,
    left: Math.max(FLOOR_SIDE, c(b.rest)) * S * sideK,
  }
}
function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = s => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * k)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = s => Math.round(((n >> s) & 255) * (1 - k))
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const f1 = v => Math.round(v * 10) / 10
const pts = a => a.map(p => `${f1(p[0])},${f1(p[1])}`).join(' ')
// control point for an edge A→B bowed outward by `bulge` px at its middle
function edgeCtrl(A, B, bulge) {
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2
  if (!bulge) return [mx, my]
  let nx = B[1] - A[1], ny = -(B[0] - A[0])
  const n = Math.hypot(nx, ny) || 1
  nx /= n; ny /= n
  if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny }
  return [mx + nx * bulge * 2, my + ny * bulge * 2]
}
const P = q => `${f1(q[0])} ${f1(q[1])}`
function outlineD(T, R, B, L, bulge) {
  return `M${P(T)} Q${P(edgeCtrl(T, R, bulge))} ${P(R)} Q${P(edgeCtrl(R, B, bulge))} ${P(B)} Q${P(edgeCtrl(B, L, bulge))} ${P(L)} Q${P(edgeCtrl(L, T, bulge))} ${P(T)} Z`
}
function wedgeD(A, B, bulge) {
  return `M0 0 L${P(A)} Q${P(edgeCtrl(A, B, bulge))} ${P(B)} Z`
}

// ── Scene palettes: the journey runs morning → dusk across the five phases ──
const SCENES = {
  morning: { sky: ['#4f9fd8', '#86c0e6', '#bfe0f2', '#e3f0f2'], sun: '#fff6d8', sunAt: [1080, 110],
    hills: ['#b9d7cf', '#a6cf8f', '#7fb56a'], haze: '#e3f0f2' },
  noon: { sky: ['#58a5db', '#8cc4e7', '#c6e3f1', '#e8f3ef'], sun: '#fffbe8', sunAt: [930, 80],
    hills: ['#b5d4c6', '#a2cc89', '#78b063'], haze: '#e8f3ef' },
  overcast: { sky: ['#7ea7c8', '#a7c4da', '#d2e0e9', '#ecf0ee'], sun: '#ffffff', sunAt: [760, 90],
    hills: ['#bccdc8', '#a5c495', '#80aa6d'], haze: '#ecf0ee' },
  golden: { sky: ['#6a98c7', '#a9bfd6', '#f0d2ae', '#f7e3c6'], sun: '#ffe2a8', sunAt: [430, 440],
    hills: ['#c9c7b0', '#b4bd82', '#8ea35a'], haze: '#f7e3c6' },
  dusk: { sky: ['#3f5590', '#8a7fb4', '#e2a69e', '#f4cfa8'], sun: '#ffd3a0', sunAt: [400, 470],
    hills: ['#a99aae', '#8f9a7a', '#6c7f55'], haze: '#f0c6a4' },
}

function defs(sc) {
  const [s0, s1, s2, s3] = sc.sky
  const [h0, h1, h2] = sc.hills
  return `<defs>
  <style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&amp;family=DM+Serif+Display&amp;family=Space+Mono:wght@400;700&amp;display=swap');</style>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${s0}"/><stop offset="0.38" stop-color="${s1}"/>
    <stop offset="0.72" stop-color="${s2}"/><stop offset="1" stop-color="${s3}"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${sc.sun}" stop-opacity="0.95"/>
    <stop offset="0.18" stop-color="${sc.sun}" stop-opacity="0.55"/>
    <stop offset="1" stop-color="${sc.sun}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="hill0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${h0}"/><stop offset="1" stop-color="${sc.haze}"/></linearGradient>
  <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint(h1.length === 7 ? h1 : '#a6cf8f', 0.12)}"/><stop offset="1" stop-color="${h1}"/></linearGradient>
  <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${h2}"/><stop offset="1" stop-color="${shade(h2, 0.18)}"/></linearGradient>
  <linearGradient id="cloudShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.65" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8f0"/></linearGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.42"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b4320"/><stop offset="0.5" stop-color="#b07d4a"/><stop offset="1" stop-color="#6b4320"/></linearGradient>
  <linearGradient id="frost" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.74"/></linearGradient>
  <radialGradient id="beadGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75"><stop offset="0.6" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity="0.16"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
  <filter id="haze" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="kshadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="5" dy="10" stdDeviation="7" flood-color="${INK}" flood-opacity="0.2"/></filter>
  <filter id="card" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="${INK}" flood-opacity="0.13"/></filter>
  <filter id="grass" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.32" numOctaves="3" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.26  0 0 0 0 0.1  0 0 0 1.4 -0.55" result="st"/>
    <feComposite in="st" in2="SourceGraphic" operator="in" result="st2"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="st2"/></feMerge>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.12  0 0 0 0 0.16  0 0 0 0.09 0"/>
  </filter>
  <filter id="fabric" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="turbulence" baseFrequency="0.9 0.05" numOctaves="1" seed="2" result="w"/>
    <feColorMatrix in="w" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.16 0" result="w2"/>
    <feComposite in="w2" in2="SourceGraphic" operator="in" result="w3"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="w3"/></feMerge>
  </filter>
</defs>`
}

function cloud(x, y, s, op = 1) {
  const blobs = [[0, 0, 60, 26], [-46, 8, 40, 20], [48, 6, 46, 22], [-14, -18, 38, 26], [24, -14, 34, 22]]
  return `<g transform="translate(${x},${y}) scale(${s})" opacity="${op}" filter="url(#soft)">
    <ellipse cx="6" cy="22" rx="96" ry="12" fill="#c9d8e6" opacity="0.35"/>
    ${blobs.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#cloudShade)"/>`).join('')}
  </g>`
}

function cloudBank(x, y, w, op = 0.96) {
  // a long low bank: many overlapping cloud bodies
  let g = ''
  for (let i = 0; i < 9; i++) {
    const cx = x + (i / 8) * w, cy = y + Math.sin(i * 1.7) * 10
    g += cloud(cx, cy, 1.05 + 0.25 * Math.sin(i * 2.3), op)
  }
  return `<g>${g}</g>`
}

function background(sc, { clouds = true, bank = false } = {}) {
  const [sx, sy] = sc.sunAt
  return `
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${sx}" cy="${sy}" r="260" fill="url(#sun)"/>
  <circle cx="${sx}" cy="${sy}" r="26" fill="${sc.sun}" opacity="0.9"/>
  ${clouds ? cloud(420, 210, 0.7, 0.85) + cloud(760, 70, 0.55, 0.75) + cloud(860, 250, 0.6, 0.8) : ''}
  ${bank ? cloudBank(700, 60, 560) : ''}
  <path d="M0 455 C 180 420 360 440 560 428 S 960 405 1280 432 V720 H0Z" fill="url(#hill0)" opacity="0.95"/>
  <path d="M0 450 C 300 470 600 455 900 470 S 1180 450 1280 458" stroke="${sc.haze}" stroke-width="30" fill="none" opacity="0.55" filter="url(#haze)"/>
  <path d="M0 520 C 230 478 500 512 760 497 S 1120 468 1280 492 V720 H0Z" fill="url(#hill1)"/>
  <path d="M0 602 C 280 560 620 598 900 584 S 1180 556 1280 570 V720 H0Z" fill="url(#hill2)" filter="url(#grass)"/>
  ${flowers()}`
}

function flowers() {
  let s = ''
  let seed = 11
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = 610 + rnd() * 105
    const c = ['#fff6e0', '#f7d36b', '#f2b6c8', '#ffffff'][i % 4]
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1 + rnd() * 1.6)}" fill="${c}" opacity="0.8"/>`
  }
  return s
}

function overlayGrain() {
  return `<rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="1"/>`
}

// ── Kites ──────────────────────────────────────────────────────────────────
function tailPath(by, len, amp, phase) {
  const n = 16, p = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    p.push([Math.sin(k * 0.75 + phase) * amp * t, by + len * t])
  }
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`
  for (let k = 1; k < p.length; k++) d += ` L${f1(p[k][0])} ${f1(p[k][1])}`
  const bows = []
  for (let k = 4; k <= n; k += 4) {
    const [x, y] = p[k]
    bows.push(`<path d="M${f1(x)} ${f1(y)} l-7 -4 l0 8 Z M${f1(x)} ${f1(y)} l7 -4 l0 8 Z" />`)
  }
  return { d, bows: bows.join('') }
}

// A finished kite, Kite 2.0 construction with a richer finish: two-tone
// fabric, sheen, hem stitching, wooden spars, bridle, ribbon tail with bows.
function kite({ x, y, b, S = 40, color = KITE_COLORS[0], scale = 1, rot = 0, tail = true, shadow = true, phase = 0, label = '', bulge = 0, sideK = SIDE_K }) {
  const sp = spars(b, S, sideK)
  const T = [0, -sp.top], R = [sp.right, 0], B = [0, sp.bottom], L = [-sp.left, 0], O = [0, 0]
  const inset = q => [q[0] * 0.9, q[1] * 0.9]
  const len = Math.min(CAP_S, b.exh || 0) * S * 0.9 + 24
  const tp = tailPath(sp.bottom, len, 9, phase)
  return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${rot}) scale(${scale})" ${shadow ? 'filter="url(#kshadow)"' : ''}>
    ${tail ? `<path d="${tp.d}" stroke="${shade(color, 0.15)}" stroke-width="2.2" fill="none" stroke-linecap="round"/><g fill="${tint(color, 0.25)}" stroke="${INK}" stroke-opacity="0.45" stroke-width="0.8" vector-effect="non-scaling-stroke">${tp.bows}</g>` : ''}
    <g filter="url(#fabric)">
      <path d="${wedgeD(L, T, bulge)}" fill="${tint(color, 0.42)}"/>
      <path d="${wedgeD(B, L, bulge)}" fill="${tint(color, 0.18)}"/>
      <path d="${wedgeD(T, R, bulge)}" fill="${color}"/>
      <path d="${wedgeD(R, B, bulge)}" fill="${shade(color, 0.1)}"/>
    </g>
    <path d="${outlineD(T, R, B, L, bulge)}" fill="url(#sheen)"/>
    <path d="${outlineD(...[T, R, B, L].map(inset), bulge * 0.9)}" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="1.1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
    <path d="${outlineD(T, R, B, L, bulge)}" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <line x1="${T[0]}" y1="${T[1]}" x2="${B[0]}" y2="${B[1]}" stroke="url(#wood)" stroke-width="3.4" stroke-linecap="round"/>
    <line x1="${L[0]}" y1="${L[1]}" x2="${R[0]}" y2="${R[1]}" stroke="#8a5a2c" stroke-width="3" stroke-linecap="round"/>
    <line x1="${L[0]}" y1="${L[1] - 0.8}" x2="${R[0]}" y2="${R[1] - 0.8}" stroke="#d7a875" stroke-opacity="0.7" stroke-width="0.9" stroke-linecap="round"/>
    <circle r="4" fill="#c8a25a" stroke="${INK}" stroke-opacity="0.5" stroke-width="1" vector-effect="non-scaling-stroke"/>
    ${label ? `<text y="${f1(sp.bottom + len + 22)}" text-anchor="middle" font-family="${SANS}" font-size="${f1(12 / scale)}" fill="${INK}" opacity="0.7">${esc(label)}</text>` : ''}
  </g>`
}

// A kite as it is being built: grown spars, the sail between finished spars,
// a halo under each spar, and the live tip on the growing one.
function liveKite({ x, y, sec, growing, S = 40, color = KITE_COLORS[1] }) {
  const L = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }
  const order = ['top', 'right', 'bottom', 'left']
  const tip = k => sec[k] == null ? null : [L[k][0] * sec[k] * S * axisK(k), L[k][1] * sec[k] * S]
  let sail = ''
  for (let i = 0; i < 4; i++) {
    const a = order[i], c = order[(i + 1) % 4]
    if (sec[a] != null && sec[c] != null) {
      const fill = i % 2 ? tint(color, 0.25) : color
      sail += `<polygon points="${pts([[0, 0], tip(a), tip(c)])}" fill="${fill}" opacity="0.78"/>`
    }
  }
  let sparsSvg = '', tipSvg = ''
  for (const k of order) {
    const p = tip(k)
    if (!p) continue
    sparsSvg += `<line x1="0" y1="0" x2="${f1(p[0])}" y2="${f1(p[1])}" stroke="#fff" stroke-opacity="0.55" stroke-width="9" stroke-linecap="round"/>`
    sparsSvg += `<line x1="0" y1="0" x2="${f1(p[0])}" y2="${f1(p[1])}" stroke="url(#wood)" stroke-width="3.4" stroke-linecap="round"/>`
    if (k === growing) tipSvg = `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="7" fill="#fff" stroke="${INK}" stroke-opacity="0.85" stroke-width="2"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="9.5" fill="none" stroke="${color}" stroke-width="1.2"/>`
  }
  // outline only along finished edges
  let edges = ''
  for (let i = 0; i < 4; i++) {
    const a = order[i], c = order[(i + 1) % 4]
    if (sec[a] != null && sec[c] != null && a !== growing && c !== growing)
      edges += `<line x1="${f1(tip(a)[0])}" y1="${f1(tip(a)[1])}" x2="${f1(tip(c)[0])}" y2="${f1(tip(c)[1])}" stroke="${INK}" stroke-opacity="0.55" stroke-width="1.5"/>`
  }
  return `<g transform="translate(${x},${y})">${sail}${edges}${sparsSvg}<circle r="4.5" fill="#c8a25a" stroke="${INK}" stroke-opacity="0.5"/>${tipSvg}</g>`
}

// The plan: dashed ink outline, faint fill, dashed spars, end ticks with the
// seconds beside them. Optionally the bead (the pacer) on one spar.
function ghost({ x, y, b, S = 40, bead = null, nums = true, brighten = null, bulge = 0, sideK = SIDE_K }) {
  const sp = spars(b, S, sideK)
  const T = [0, -sp.top], R = [sp.right, 0], B = [0, sp.bottom], L = [-sp.left, 0]
  const tick = (p, dir, n, key) => {
    const [dx, dy] = dir
    const nx = p[0] + dx * 22, ny = p[1] + dy * 22 + 5
    return `<line x1="${f1(p[0] - dy * 6)}" y1="${f1(p[1] - dx * 6)}" x2="${f1(p[0] + dy * 6)}" y2="${f1(p[1] + dx * 6)}" stroke="${INK}" stroke-width="2" stroke-opacity="0.8"/>` +
      (nums ? `<text x="${f1(nx)}" y="${f1(ny)}" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="14" fill="${INK}" stroke="#fff" stroke-opacity="0.75" stroke-width="3" paint-order="stroke">${n}</text>` : '')
  }
  const sparLine = (p, k) => `<line x1="0" y1="0" x2="${p[0]}" y2="${p[1]}" stroke="${INK}" stroke-opacity="${brighten === k ? 0.9 : 0.45}" stroke-width="${brighten === k ? 2.6 : 1.5}" stroke-dasharray="2 4"/>`
  let beadSvg = ''
  if (bead) {
    const dir = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }[bead.spar]
    const bx = dir[0] * bead.sec * S * sideK, by = dir[1] * bead.sec * S
    beadSvg = `<circle cx="${f1(bx)}" cy="${f1(by)}" r="22" fill="url(#beadGlow)"/><circle cx="${f1(bx)}" cy="${f1(by)}" r="6" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`
  }
  return `<g transform="translate(${x},${y})">
    <path d="${outlineD(T, R, B, L, bulge)}" fill="#fff" fill-opacity="0.2" stroke="${INK}" stroke-opacity="0.65" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round"/>
    ${sparLine(T, 'top')}${sparLine(R, 'right')}${sparLine(B, 'bottom')}${sparLine(L, 'left')}
    ${tick(T, [0, -1], fmt(b.inh))}${tick(R, [1, 0], fmt(b.hold))}${tick(B, [0, 1], fmt(b.exh))}${tick(L, [-1, 0], fmt(b.rest))}
    ${beadSvg}
  </g>`
}
const fmt = v => (Math.round(v * 10) / 10).toString()

function stitches(x, y, spar, sec, S = 40) {
  const dir = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }[spar]
  let s = ''
  for (let i = 1; i <= 6; i++) {
    const t = (i / 7) * sec * S * axisK(spar)
    const cx = x + dir[0] * t, cy = y + dir[1] * t
    s += `<path d="M${f1(cx - 4)} ${f1(cy - 4)} L${f1(cx + 4)} ${f1(cy + 4)}" stroke="${INK}" stroke-opacity="0.75" stroke-width="1.6" stroke-linecap="round"/>`
  }
  return s
}

function kiteString(x1, y1, x2, y2, sag = 40, op = 0.35) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag
  return `<path d="M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" stroke="${INK}" stroke-opacity="${op}" stroke-width="1" fill="none"/>`
}

// ── HUD ────────────────────────────────────────────────────────────────────
const PHASES = [
  { n: 1, key: 'open', title: 'Open field', sub: 'Breathe freely and see your kites' },
  { n: 2, key: 'trace', title: 'Follow the plan', sub: 'Match the plan, watching your kite' },
  { n: 3, key: 'cloud', title: 'Into the clouds', sub: 'Follow the plan without seeing your kite' },
  { n: 4, key: 'crosswind', title: 'Crosswind', sub: 'Keep building while sounds play' },
  { n: 5, key: 'messages', title: 'Messages on the wind', sub: 'Keep building and listen' },
]

function phaseChip(n) {
  const p = PHASES[n - 1]
  let ladder = ''
  for (let i = 1; i <= 5; i++) {
    const x = 24 + (i - 1) * 22
    ladder += i === n
      ? `<rect x="${x}" y="88" width="18" height="6" rx="3" fill="${INK}"/>`
      : `<rect x="${x + 0.75}" y="88.75" width="16.5" height="4.5" rx="2.25" fill="none" stroke="${INK}" stroke-opacity="${i < n ? 0.75 : 0.35}" stroke-width="1.5"/>${i < n ? `<rect x="${x + 3}" y="90" width="12" height="2" rx="1" fill="${INK}" opacity="0.6"/>` : ''}`
  }
  return `<g transform="translate(24,24)" filter="url(#card)">
    <rect width="${Math.max(260, p.title.length * 13 + 40)}" height="108" rx="12" fill="url(#frost)"/>
    <text x="24" y="30" font-family="${MONO}" font-size="12" letter-spacing="1.5" fill="${INK}" opacity="0.7">PHASE ${n} OF 5</text>
    <text x="24" y="64" font-family="${SERIF}" font-size="28" fill="${INK}">${esc(p.title)}</text>
    ${ladder}
  </g>`
}

function safety() {
  return `<g font-family="${SANS}" font-size="14" font-weight="600" fill="${INK}">
    <g filter="url(#card)"><rect x="${W - 404}" y="24" width="208" height="44" rx="22" fill="url(#frost)" stroke="${INK}" stroke-opacity="0.35"/></g>
    <text x="${W - 300}" y="51" text-anchor="middle">dizzy or short of air</text>
    <g filter="url(#card)"><rect x="${W - 184}" y="24" width="160" height="44" rx="22" fill="url(#frost)" stroke="${INK}" stroke-opacity="0.35"/></g>
    <rect x="${W - 160}" y="39" width="12" height="12" rx="2" fill="${INK}"/>
    <text x="${W - 96}" y="51" text-anchor="middle">stop <tspan font-weight="400" opacity="0.65">(Esc)</tspan></text>
  </g>`
}

function pads(active = null) {
  const pad = (x, label, glyph, on) => `<g filter="url(#card)">
      <rect x="${x}" y="626" width="248" height="68" rx="24" fill="${on ? INK : 'url(#frost)'}" fill-opacity="${on ? 0.88 : 1}" stroke="${INK}" stroke-opacity="${on ? 1 : 0.35}" stroke-width="${on ? 2.5 : 1}"/>
    </g>
    <text x="${x + 124}" y="667" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="600" fill="${on ? '#fff' : INK}">${glyph}  ${label}</text>`
  return pad(W / 2 - 264, 'breathe in', '↑', active === 'in') + pad(W / 2 + 16, 'breathe out', '↓', active === 'out')
}

function caption(text, y = 596, w = 720) {
  return `<g filter="url(#card)"><rect x="${(W - w) / 2}" y="${y - 26}" width="${w}" height="40" rx="12" fill="url(#frost)"/></g>
  <text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="16" fill="${INK}">${esc(text)}</text>`
}

function card(x, y, w, h, inner) {
  return `<g transform="translate(${x},${y})"><g filter="url(#card)"><rect width="${w}" height="${h}" rx="12" fill="url(#frost)"/></g>${inner}</g>`
}

function lines(x, y, arr, { size = 14, lh = 20, weight = 400, op = 1, font = SANS, anchor = 'start' } = {}) {
  return arr.map((t, i) => `<text x="${x}" y="${y + i * lh}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${INK}" opacity="${op}">${esc(t)}</text>`).join('')
}

function mockNote(text) {
  // a researcher-facing annotation, styled as a pencil note, not game UI
  return `<g transform="translate(${W - 24},${H - 6})"><text text-anchor="end" font-family="${MONO}" font-size="12" fill="${INK}" opacity="0.55">${esc(text)}</text></g>`
}

function svg(sc, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">
${defs(sc)}
${body}
${overlayGrain()}
</svg>`
}

// ── Screens ────────────────────────────────────────────────────────────────
const BOX = { inh: 3, hold: 3, exh: 3, rest: 3 }
const PLANS = {
  square: { name: 'The square sail', b: BOX, line: 'in 3 · pause 3 · out 3 · rest 3' },
  longtail: { name: 'The long-tail', b: { inh: 4, hold: 0.5, exh: 6, rest: 0.5 }, line: 'in 4 · pause 0.5 · out 6 · rest 0.5' },
  drifter: { name: 'The drifter', b: { inh: 5, hold: 0.5, exh: 5, rest: 0.5 }, line: 'in 5 · pause 0.5 · out 5 · rest 0.5' },
}

function screen1() {
  const sc = SCENES.morning
  // earlier free kites flying, strings to a stake on the near hill
  const flown = [
    { x: 300, y: 180, b: { inh: 2.4, hold: 0.2, exh: 3.6, rest: 1.0 }, c: 0, s: 0.42, r: -8, kind: 'dart' },
    { x: 470, y: 120, b: { inh: 3.0, hold: 1.6, exh: 3.2, rest: 2.2 }, c: 2, s: 0.38, r: 6, kind: 'float' },
    { x: 905, y: 150, b: { inh: 2.8, hold: 0.6, exh: 4.6, rest: 0.8 }, c: 3, s: 0.4, r: 9, kind: 'sail' },
    { x: 860, y: 300, b: { inh: 4.0, hold: 0.3, exh: 2.2, rest: 0.4 }, c: 4, s: 0.36, r: -5, kind: 'dart' },
  ]
  const stake = [640, 610]
  let sky = ''
  for (const k of flown) {
    sky += kiteString(k.x, k.y + 12, stake[0], stake[1], 60, 0.28)
    sky += kite({ x: k.x, y: k.y, b: k.b, color: KITE_COLORS[k.c], scale: k.s, rot: k.r, phase: k.x })
  }
  const live = liveKite({ x: 640, y: 318, sec: { top: 2.6, right: 0.55, bottom: 2.3, left: null }, growing: 'bottom', color: KITE_COLORS[1] })
  // notebook of kinds
  const note = card(W - 296, 96 + 24, 272, 236, `
    ${lines(24, 34, ['Kites you have made'], { size: 16, weight: 600 })}
    ${lines(24, 56, ['each one is a breath; none is the right one'], { size: 12, op: 0.7 })}
    ${[0, 1, 2, 3].map(i => kite({ x: 46 + i * 60, y: 108, b: flown[i].b, color: KITE_COLORS[flown[i].c], scale: 0.2, tail: false, shadow: false })).join('')}
    ${lines(46, 168, ['dart', 'float', 'sail', 'dart'].map(() => ''), {})}
    ${['dart', 'float', 'sail', 'dart'].map((t, i) => `<text x="${46 + i * 60}" y="166" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${INK}" opacity="0.75">${t}</text>`).join('')}
    <line x1="24" y1="186" x2="248" y2="186" stroke="${INK}" stroke-opacity="0.12"/>
    ${lines(24, 210, ['A pause at the top makes it wider.'], { size: 12, op: 0.8 })}
  `)
  const stakeSvg = `<g transform="translate(${stake[0]},${stake[1]})"><ellipse cx="0" cy="8" rx="22" ry="5" fill="${INK}" opacity="0.15"/><rect x="-3" y="-18" width="6" height="26" rx="2" fill="#7a4e25"/><ellipse cx="0" cy="-6" rx="11" ry="7" fill="#c8a25a" stroke="${INK}" stroke-opacity="0.4"/></g>`
  const body = `${background(sc)}${sky}${kiteString(640, 330, stake[0], stake[1] - 12, 20, 0.4)}${live}${stakeSvg}
    ${phaseChip(1)}${safety()}${note}
    ${caption('Breathe however you like. Each breath becomes a kite.')}
    ${pads('out')}
    ${mockNote('mock-up 1 · open field · free breathing, no plan (Kite 2.0)')}`
  return svg(sc, body, 'Phase 1, open field')
}

function roundCard(x, y, k, of, extra = []) {
  let dots = ''
  for (let i = 0; i < of; i++) {
    const cx = 28 + i * 26
    dots += i < k - 1 ? `<circle cx="${cx}" cy="64" r="7" fill="${INK}" opacity="0.8"/>`
      : i === k - 1 ? `<circle cx="${cx}" cy="64" r="6.25" fill="none" stroke="${INK}" stroke-width="2.5"/><circle cx="${cx}" cy="64" r="2.5" fill="${INK}"/>`
        : `<circle cx="${cx}" cy="64" r="6.25" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="1.5"/>`
  }
  const h = 92 + extra.length * 20
  return card(x, y, 220, h, `${lines(20, 34, [`Round 1 · kite ${k} of ${of}`], { size: 14, weight: 600 })}${dots}${lines(20, 100, extra, { size: 12, op: 0.75 })}`)
}

function planCard(x, y, plan = PLANS.square, tag = 'The plan') {
  const S = Math.min(12, 110 / (plan.b.inh + plan.b.exh))
  const cyy = 132 + (plan.b.inh - plan.b.exh) * S / 2
  return card(x, y, 220, 220, `
    ${lines(20, 34, [tag], { size: 12, op: 0.7, font: MONO })}
    ${lines(20, 62, [plan.name], { size: 20, font: SERIF })}
    ${ghost({ x: 110, y: cyy, b: plan.b, S, nums: false })}
    ${lines(110, 200, [plan.line], { size: 12, op: 0.8, anchor: 'middle' })}
  `)
}

function screen2() {
  const sc = SCENES.noon
  const cx = 640, cy = 318
  const body = `${background(sc)}
    ${kite({ x: 880, y: 150, b: { inh: 3.1, hold: 2.8, exh: 3.2, rest: 3.0 }, color: KITE_COLORS[0], scale: 0.34, rot: 6 })}
    ${kite({ x: 960, y: 250, b: { inh: 2.9, hold: 3.3, exh: 2.7, rest: 3.1 }, color: KITE_COLORS[2], scale: 0.32, rot: -4 })}
    ${kiteString(880, 160, 820, 560, 30, 0.25)}${kiteString(960, 260, 820, 560, 30, 0.25)}
    ${ghost({ x: cx, y: cy, b: BOX, bead: { spar: 'bottom', sec: 2.1 }, brighten: 'bottom' })}
    ${liveKite({ x: cx, y: cy, sec: { top: 3.1, right: 2.8, bottom: 1.5, left: null }, growing: 'bottom', color: KITE_COLORS[1] })}
    ${stitches(cx, cy, 'top', 3.1)}${stitches(cx, cy, 'right', 2.8)}
    ${phaseChip(2)}${safety()}
    ${planCard(24, 156)}
    ${roundCard(W - 244, 96 + 24, 3, 6, ['stitches mark a side that fit'])}
    ${caption('Follow the bead. Press when your breath turns, not when the kite does.')}
    ${pads('out')}
    ${mockNote('mock-up 2 · follow the plan · plan + bead + your kite (Kitewright Learn)')}`
  return svg(sc, body, 'Phase 2, follow the plan')
}

function hiddenKiteBank(sc) {
  // the player's kite is up in the cloud bank; only its string shows
  return `${cloudBank(720, 150, 520, 0.98)}
    <path d="M1010 190 Q 960 400 900 560" stroke="${INK}" stroke-opacity="0.45" stroke-width="1.2" fill="none"/>
    <g transform="translate(900,566)"><ellipse cx="0" cy="8" rx="20" ry="5" fill="${INK}" opacity="0.15"/><rect x="-3" y="-16" width="6" height="24" rx="2" fill="#7a4e25"/><ellipse cx="0" cy="-5" rx="10" ry="6.5" fill="#c8a25a" stroke="${INK}" stroke-opacity="0.4"/></g>
    <g filter="url(#card)"><rect x="960" y="232" width="232" height="34" rx="12" fill="url(#frost)"/></g>
    <text x="1076" y="254" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${INK}">your kite is up in the clouds</text>`
}

function screen3() {
  const sc = SCENES.overcast
  const cx = 560, cy = 318
  const body = `${background(sc, { clouds: false })}
    ${cloud(180, 110, 0.7, 0.85)}
    ${hiddenKiteBank(sc)}
    ${ghost({ x: cx, y: cy, b: BOX, bead: { spar: 'left', sec: 1.2 }, brighten: 'left' })}
    <circle cx="${cx}" cy="${cy}" r="4.5" fill="#c8a25a" stroke="${INK}" stroke-opacity="0.5"/>
    ${phaseChip(3)}${safety()}
    ${planCard(24, 156)}
    ${roundCard(W - 244, 300, 4, 6, ['after each kite: rate it, then see it'])}
    ${caption('Follow the plan. Your kite comes out of the clouds once you\u2019ve rated it.')}
    ${pads(null)}
    ${mockNote('mock-up 3 · into the clouds · plan + bead, your kite hidden')}`
  return svg(sc, body, 'Phase 3, into the clouds')
}

function confidenceModal(sc, { phaseN, after = '' }) {
  const mx = 340, my = 150, mw = 600, mh = 360
  let btns = ''
  const labels = ['1', '2', '3', '4', '5', '6']
  for (let i = 0; i < 6; i++) {
    const x = mx + 48 + i * 86, sel = i === 3
    btns += `<g filter="url(#card)"><rect x="${x}" y="${my + 196}" width="72" height="56" rx="24" fill="${sel ? INK : '#fff'}" stroke="${INK}" stroke-opacity="${sel ? 1 : 0.4}" stroke-width="${sel ? 2.5 : 1.25}"/></g>
      <text x="${x + 36}" y="${my + 230}" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="600" fill="${sel ? '#fff' : INK}">${labels[i]}</text>`
  }
  return `<rect width="${W}" height="${H}" fill="${INK}" opacity="0.28"/>
    <g filter="url(#card)"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="12" fill="#fff" fill-opacity="0.96"/></g>
    ${lines(mx + 48, my + 52, [`KITE 4 OF 6`], { size: 12, op: 0.65, font: MONO })}
    ${lines(mx + 48, my + 92, ['How close was that kite to the plan?'], { size: 28, font: SERIF })}
    ${lines(mx + 48, my + 124, ['Go by how the breath felt. There is no wrong answer.'], { size: 14, op: 0.75 })}
    ${btns}
    ${lines(mx + 48, my + 280, ['not close at all'], { size: 12, op: 0.75 })}
    ${lines(mx + mw - 48, my + 280, ['right on the plan'], { size: 12, op: 0.75, anchor: 'end' })}
    <line x1="${mx + 48}" y1="${my + 306}" x2="${mx + mw - 48}" y2="${my + 306}" stroke="${INK}" stroke-opacity="0.1"/>
    ${lines(mx + 48, my + 334, [after || 'Press a number, or 1–6 on the keyboard. Breathe normally while you choose.'], { size: 12, op: 0.65 })}`
}

function screen3b() {
  const sc = SCENES.overcast
  const body = `${background(sc, { clouds: false })}${cloud(180, 110, 0.7, 0.85)}${hiddenKiteBank(sc)}
    ${ghost({ x: 560, y: 318, b: BOX })}
    ${phaseChip(3)}${safety()}
    ${confidenceModal(sc, { phaseN: 3 })}
    ${mockNote('mock-up 3b · confidence after each hidden kite')}`
  return svg(sc, body, 'Phase 3, confidence rating')
}

function screen3r() {
  // straight after the rating: the kite drops out of the clouds onto the plan
  const sc = SCENES.overcast
  const cx = 560, cy = 318
  const made = { inh: 3.2, hold: 2.5, exh: 3.1, rest: 3.3 }
  const body = `${background(sc, { clouds: false })}
    ${cloud(180, 110, 0.7, 0.85)}
    ${cloudBank(720, 150, 520, 0.98)}
    <path d="M1000 196 Q 760 250 ${cx + 10} ${cy - 130}" stroke="${INK}" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="3 6" fill="none"/>
    ${ghost({ x: cx, y: cy, b: BOX })}
    ${kite({ x: cx, y: cy, b: made, color: KITE_COLORS[3], tail: true, phase: 1.2 })}
    ${ghost({ x: cx, y: cy, b: BOX, nums: true })}
    ${stitches(cx, cy, 'top', 3.2)}${stitches(cx, cy, 'bottom', 3.1)}${stitches(cx, cy, 'left', 3.3)}
    ${phaseChip(3)}${safety()}
    ${planCard(24, 156)}
    ${card(W - 284, 300, 260, 132, `
      ${lines(20, 34, ['KITE 4 OF 6'], { size: 12, op: 0.65, font: MONO })}
      ${lines(20, 62, ['You said 4 of 6'], { size: 20, font: SERIF })}
      ${lines(20, 90, ['Stitches mark the sides that fit.', 'Next kite when you breathe in.'], { size: 12, op: 0.8, lh: 18 })}`)}
    ${caption('Here is the kite you just made, drawn over the plan.')}
    ${pads(null)}
    ${mockNote('mock-up 3c · after the rating, the kite comes out of the clouds (W5)')}`
  return svg(sc, body, 'Phase 3, kite revealed after rating')
}

function screen3c() {
  // end-of-round reveal: the hidden kites come down, each beside the plan,
  // with the player's rating under it
  const sc = SCENES.overcast
  const made = [
    { inh: 3.2, hold: 2.6, exh: 3.1, rest: 3.4, r: 5 },
    { inh: 2.6, hold: 3.4, exh: 3.3, rest: 2.2, r: 4 },
    { inh: 3.0, hold: 3.0, exh: 2.9, rest: 3.1, r: 6 },
    { inh: 3.8, hold: 1.4, exh: 3.0, rest: 2.8, r: 4 },
    { inh: 3.1, hold: 2.9, exh: 3.6, rest: 3.0, r: 3 },
    { inh: 2.9, hold: 3.2, exh: 3.0, rest: 2.7, r: 5 },
  ]
  let tiles = ''
  made.forEach((b, i) => {
    const x = 260 + i * 152, y = 330
    tiles += `<g filter="url(#card)"><rect x="${x - 64}" y="${y - 108}" width="128" height="200" rx="12" fill="url(#frost)"/></g>`
    tiles += ghost({ x, y: y - 10, b: BOX, S: 11, nums: false })
    tiles += kite({ x, y: y - 10, b, S: 11, color: KITE_COLORS[i % 5], scale: 1, tail: false, shadow: false })
    tiles += `<text x="${x}" y="${y + 66}" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${INK}" opacity="0.7">you said</text>`
    tiles += `<text x="${x}" y="${y + 84}" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="600" fill="${INK}">${b.r} of 6</text>`
  })
  const body = `${background(sc, { clouds: false })}${cloud(200, 120, 0.7, 0.8)}${cloud(1100, 110, 0.8, 0.85)}
    ${phaseChip(3)}${safety()}
    ${lines(W / 2, 176, ['Round 1: your six kites and what you said'], { size: 28, font: SERIF, anchor: 'middle' })}
    ${tiles}
    ${caption('Each kite is drawn over the plan. Rest here as long as you like.', 520, 600)}
    <g filter="url(#card)"><rect x="${W / 2 - 112}" y="560" width="224" height="52" rx="24" fill="${INK}"/></g>
    <text x="${W / 2}" y="592" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="600" fill="#fff">next round</text>
    ${mockNote('mock-up 3d · end-of-round recap (W7)')}`
  return svg(sc, body, 'Phase 3, end of round reveal')
}

function soundRibbons(color = '#fff') {
  // decoration only: faint gust lines across the sky
  let s = ''
  for (let i = 0; i < 6; i++) {
    const y = 130 + i * 46, x0 = 80 + (i % 3) * 140
    s += `<path d="M${x0} ${y} C ${x0 + 120} ${y - 18} ${x0 + 220} ${y + 18} ${x0 + 340} ${y} S ${x0 + 520} ${y - 10} ${x0 + 600} ${y + 4}" stroke="${color}" stroke-opacity="${0.22 + (i % 2) * 0.12}" stroke-width="${1.5 + (i % 3)}" fill="none" stroke-linecap="round"/>`
  }
  return s
}

function listenChip(x, y, title, sub) {
  let bars = ''
  const hs = [6, 14, 22, 12, 18, 8, 16, 10]
  hs.forEach((h, i) => { bars += `<rect x="${24 + i * 6}" y="${36 - h / 2}" width="3" height="${h}" rx="1.5" fill="${INK}" opacity="0.75"/>` })
  return card(x, y, 340, 72, `${bars}${lines(88, 32, [title], { size: 14, weight: 600 })}${lines(88, 52, [sub], { size: 12, op: 0.75 })}`)
}

function screen4() {
  const sc = SCENES.golden
  const cx = 560, cy = 318
  const body = `${background(sc, { clouds: false })}
    ${soundRibbons('#fff')}
    ${hiddenKiteBank(sc)}
    ${ghost({ x: cx, y: cy - 40, b: PLANS.longtail.b, bead: { spar: 'top', sec: 2.1 }, brighten: 'top' })}
    <circle cx="${cx}" cy="${cy - 40}" r="4.5" fill="#c8a25a" stroke="${INK}" stroke-opacity="0.5"/>
    ${phaseChip(4)}${safety()}
    ${planCard(24, 156, PLANS.longtail, 'This round\u2019s plan')}
    ${roundCard(W - 244, 300, 2, 6, ['after each kite: rate it, then see it'])}
    ${listenChip(24, 396, 'Sounds are playing', 'nothing to do with them, just keep building')}
    ${caption('Sounds will come and go. Let them, and keep following the plan.')}
    ${pads('in')}
    ${mockNote('mock-up 4 · crosswind · phase 3 + background sounds · plan: long-tail')}`
  return svg(sc, body, 'Phase 4, crosswind')
}

function screen5() {
  const sc = SCENES.dusk
  const cx = 560, cy = 318
  const body = `${background(sc, { clouds: false })}
    ${soundRibbons('#ffe7c9')}
    ${hiddenKiteBank(sc)}
    ${ghost({ x: cx, y: cy, b: PLANS.drifter.b, S: 32, bead: { spar: 'bottom', sec: 1.9 }, brighten: 'bottom' })}
    <circle cx="${cx}" cy="${cy}" r="4.5" fill="#c8a25a" stroke="${INK}" stroke-opacity="0.5"/>
    ${phaseChip(5)}${safety()}
    ${planCard(24, 156, PLANS.drifter, 'This round\u2019s plan')}
    ${roundCard(W - 244, 300, 5, 6, ['after each kite: rate it, then see it'])}
    ${listenChip(24, 396, 'Listen: a short story', 'questions about it come after the round')}
    ${caption('Keep building, and listen. You\u2019ll be asked about what you heard.')}
    ${pads(null)}
    ${mockNote('mock-up 5 · messages on the wind · phase 4 + a spoken story · plan: drifter')}`
  return svg(sc, body, 'Phase 5, messages on the wind')
}

function screen5b() {
  const sc = SCENES.dusk
  const mx = 300, my = 120, mw = 680, mh = 440
  const opts = ['The wind had turned', 'A passenger was missing', 'The harbour master was asleep', 'Fog had come in']
  let o = ''
  opts.forEach((t, i) => {
    const y = my + 168 + i * 60, sel = false
    o += `<g filter="url(#card)"><rect x="${mx + 48}" y="${y}" width="${mw - 96}" height="48" rx="24" fill="#fff" stroke="${INK}" stroke-opacity="0.4" stroke-width="1.25"/></g>
      <text x="${mx + 76}" y="${y + 30}" font-family="${SANS}" font-size="16" fill="${INK}">${esc(t)}</text>
      <text x="${mx + mw - 76}" y="${y + 30}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${INK}" opacity="0.5">${'ABCD'[i]}</text>`
  })
  const body = `${background(sc, { clouds: false })}${hiddenKiteBank(sc)}
    ${phaseChip(5)}${safety()}
    <rect width="${W}" height="${H}" fill="${INK}" opacity="0.32"/>
    <g filter="url(#card)"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="12" fill="#fff" fill-opacity="0.96"/></g>
    ${lines(mx + 48, my + 52, ['ABOUT THE STORY · QUESTION 2 OF 4'], { size: 12, op: 0.65, font: MONO })}
    ${lines(mx + 48, my + 96, ['Why did the ferry leave late?'], { size: 28, font: SERIF })}
    ${lines(mx + 48, my + 128, ['Pick one. Guessing is fine.'], { size: 14, op: 0.75 })}
    ${o}
    ${mockNote('mock-up 5b · comprehension question after a phase 5 round (placeholder story)')}`
  return svg(sc, body, 'Phase 5, comprehension question')
}

function screen0() {
  // the journey: one hillside running morning → dusk, five stations on a path
  const sc = SCENES.noon
  const skyH = `<linearGradient id="journeySky" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#86c0e6"/><stop offset="0.3" stop-color="#9cc8e6"/>
      <stop offset="0.5" stop-color="#b9cbd9"/><stop offset="0.72" stop-color="#e9c9a4"/><stop offset="1" stop-color="#9a86b5"/></linearGradient>
    <linearGradient id="journeyFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2a3d" stop-opacity="0.18"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#fff" stop-opacity="0.35"/></linearGradient>`
  const stations = [
    { x: 150, y: 566, n: 1, t: 'Open field', newL: ['Nothing to match.'], doL: ['Breathe freely; see each', 'breath become a kite.'], recL: ['natural breath shapes'] },
    { x: 395, y: 548, n: 2, t: 'Follow the plan', newL: ['A plan and a pacer.'], doL: ['Build the plan\u2019s kite,', 'watching your own.'], recL: ['fit to the plan, with', 'feedback'] },
    { x: 640, y: 530, n: 3, t: 'Into the clouds', newL: ['Your kite is hidden.'], doL: ['Follow the pacer; rate', 'each kite 1\u20136.'], recL: ['fit, and confidence', 'vs fit (metacognition)'] },
    { x: 885, y: 514, n: 4, t: 'Crosswind', newL: ['Sounds play.'], doL: ['Keep building; ignore', 'the sounds.'], recL: ['fit and confidence', 'by sound valence'] },
    { x: 1130, y: 498, n: 5, t: 'Messages on the wind', newL: ['The sounds matter.'], doL: ['Keep building and', 'listen; answer after.'], recL: ['fit, confidence and', 'comprehension'] },
  ]
  let path = `M40 640 C 120 600 120 560 ${stations[0].x} ${stations[0].y}`
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i]
    path += ` C ${a.x + 90} ${a.y + 40} ${b.x - 90} ${b.y + 40} ${b.x} ${b.y}`
  }
  path += ` C 1200 440 1240 420 1280 410`
  const icons = [
    s => kite({ x: s.x, y: s.y - 70, b: { inh: 2.6, hold: 0.4, exh: 3.4, rest: 1.1 }, color: KITE_COLORS[1], scale: 0.3, rot: -6 }),
    s => ghost({ x: s.x, y: s.y - 74, b: BOX, S: 8, nums: false }) + kite({ x: s.x, y: s.y - 74, b: { inh: 3.1, hold: 2.8, exh: 3.0, rest: 3.0 }, S: 8, color: KITE_COLORS[0], tail: false, shadow: false }),
    s => ghost({ x: s.x, y: s.y - 74, b: BOX, S: 8, nums: false }) + cloud(s.x + 30, s.y - 66, 0.3, 0.95),
    s => ghost({ x: s.x, y: s.y - 74, b: BOX, S: 8, nums: false }) + `<path d="M${s.x - 46} ${s.y - 92} q 20 -8 40 0 t 40 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    s => ghost({ x: s.x, y: s.y - 74, b: BOX, S: 8, nums: false }) + `<g transform="translate(${s.x + 30},${s.y - 92})">${[6, 12, 18, 10, 14].map((h, i) => `<rect x="${i * 5}" y="${-h / 2}" width="3" height="${h}" rx="1.5" fill="${INK}" opacity="0.7"/>`).join('')}</g>`,
  ]
  let st = ''
  stations.forEach((s, i) => {
    const cw = 216, cx = s.x - cw / 2, cy = 120
    st += `<line x1="${s.x}" y1="${cy + 252}" x2="${s.x}" y2="${s.y - 20}" stroke="${INK}" stroke-opacity="0.25" stroke-dasharray="2 4"/>`
    st += card(cx, cy, cw, 252, `
      ${lines(18, 30, [`PHASE ${s.n}`], { size: 12, op: 0.65, font: MONO })}
      ${lines(18, 58, [s.t], { size: s.t.length > 16 ? 18 : 20, font: SERIF })}
      ${lines(18, 86, ['NEW'], { size: 12, op: 0.55, font: MONO })}
      ${lines(18, 104, s.newL, { size: 14, weight: 600 })}
      ${lines(18, 132, ['YOU'], { size: 12, op: 0.55, font: MONO })}
      ${lines(18, 150, s.doL, { size: 14 })}
      ${lines(18, 196, ['WE RECORD'], { size: 12, op: 0.55, font: MONO })}
      ${lines(18, 214, s.recL, { size: 12, op: 0.85, lh: 16 })}`)
    st += icons[i](s)
    st += `<g filter="url(#card)"><circle cx="${s.x}" cy="${s.y}" r="18" fill="#fff" stroke="${INK}" stroke-width="2"/></g><text x="${s.x}" y="${s.y + 6}" text-anchor="middle" font-family="${SERIF}" font-size="18" fill="${INK}">${s.n}</text>`
  })
  const body = `<defs>${skyH}</defs>
    <rect width="${W}" height="${H}" fill="url(#journeySky)"/>
    <rect width="${W}" height="${H}" fill="url(#journeyFade)"/>
    ${cloud(120, 380, 0.6, 0.6)}${cloud(1180, 380, 0.5, 0.5)}
    <path d="M0 470 C 200 440 420 455 640 438 S 1060 400 1280 420 V720 H0Z" fill="#b6cdc3" opacity="0.9"/>
    <path d="M0 540 C 260 500 520 520 780 498 S 1120 450 1280 466 V720 H0Z" fill="#a1c38a"/>
    <path d="M0 620 C 300 590 640 610 900 590 S 1180 556 1280 560 V720 H0Z" fill="url(#hill2)" filter="url(#grass)"/>
    ${flowers()}
    <path d="${path}" stroke="#f4ead6" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="${path}" stroke="${INK}" stroke-opacity="0.18" stroke-width="1.5" stroke-dasharray="1 9" fill="none" stroke-linecap="round"/>
    ${lines(40, 64, ['Five phases, one change at a time'], { size: 40, font: SERIF })}
    ${lines(40, 94, ['Each phase keeps the last one\u2019s task and adds exactly one thing.'], { size: 16, op: 0.8 })}
    ${st}
    ${mockNote('mock-up 0 · overview · working title Windward')}`
  return svg(sc, body, 'Overview of the five phases')
}

function screen6() {
  const sc = SCENES.noon
  const S = 12
  const cols = [
    { x: 420, plan: PLANS.square, head: 'square sail', sub: '3 · 3 · 3 · 3' },
    { x: 620, plan: PLANS.longtail, head: 'long-tail', sub: '4 · 0.5 · 6 · 0.5' },
    { x: 820, plan: PLANS.drifter, head: 'drifter', sub: '5 · 0.5 · 5 · 0.5' },
    { x: 1020, plan: { b: { inh: 2.6, hold: 0.3, exh: 3.4, rest: 1.1 } }, head: 'a free breath', sub: '2.6 · 0.3 · 3.4 · 1.1' },
  ]
  const rows = [
    { y: 150, t: 'A · As in Kite 2.0', d: ['Same seconds per pixel on both', 'axes; straight edges.'], o: { sideK: 1 } },
    { y: 290, t: 'B · Billowed sail', d: ['Same tips; edges bow out like', 'cloth. Narrow kites pinch.'], o: { bulge: 0.42 * S, sideK: 1 } },
    { y: 430, t: 'C · Pause axis 1.5×', d: ['Pauses drawn 1.5× wider per', 'second; the square is a wide-ish kite.'], o: { sideK: 1.5 } },
    { y: 570, t: 'D · Pause axis 2×', d: ['Pauses drawn 2× wider per', 'second; the square gets very wide.'], o: { sideK: 2 } },
  ]
  let g = ''
  cols.forEach(c => {
    g += `<text x="${c.x}" y="118" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="600" fill="${INK}">${c.head}</text>`
    g += `<text x="${c.x}" y="136" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${INK}" opacity="0.65">${c.sub}</text>`
  })
  rows.forEach((r, ri) => {
    g += card(32, r.y, 1216, 132, '')
    g += lines(56, r.y + 40, [r.t], { size: 20, font: SERIF })
    g += lines(56, r.y + 70, r.d, { size: 14, op: 0.8 })
    cols.forEach((c, ci) => {
      const b = c.plan.b
      const cy = r.y + 66 + (b.inh - b.exh) * S / 2
      g += ghost({ x: c.x, y: cy, b, S, nums: false, ...r.o })
      g += kite({ x: c.x, y: cy, b, S, color: KITE_COLORS[(ci + 1) % 5], tail: false, shadow: false, ...r.o })
    })
  })
  const body = `<rect width="${W}" height="${H}" fill="#f4eef0"/>
    ${lines(32, 56, ['Narrow kites: four ways to draw them'], { size: 28, font: SERIF })}
    ${lines(32, 84, ['No plan has a true zero any more: the shortest pause is 0.5 s. The dashed outline is the plan; each kite here fits its plan exactly.'], { size: 14, op: 0.8 })}
    ${g}
    ${mockNote('mock-up 6 · narrow kites · comparison sheet (G1)')}`
  return svg(sc, body, 'Narrow kites, four renderings')
}

// ── Write ──────────────────────────────────────────────────────────────────
const SCREENS = [
  ['00_overview', screen0, 'Overview: five phases, one change at a time'],
  ['01_open_field', screen1, 'Phase 1 · Open field (free breathing)'],
  ['02_follow_the_plan', screen2, 'Phase 2 · Follow the plan (plan, pacer and your kite)'],
  ['03_into_the_clouds', screen3, 'Phase 3 · Into the clouds (pacer, kite hidden)'],
  ['03b_confidence', screen3b, 'Phase 3 · Confidence rating after each kite'],
  ['03c_after_rating', screen3r, 'Phase 3 · The kite comes out of the clouds after the rating'],
  ['03d_round_recap', screen3c, 'Phase 3 · End-of-round recap'],
  ['04_crosswind', screen4, 'Phase 4 · Crosswind (background sounds)'],
  ['05_messages', screen5, 'Phase 5 · Messages on the wind (listen while building)'],
  ['05b_comprehension', screen5b, 'Phase 5 · Comprehension question'],
  ['06_narrow_kites', screen6, 'Design sheet · Narrow kites, four ways to draw them'],
]
for (const [name, fn] of SCREENS) writeFileSync(join(OUT, `${name}.svg`), fn())

const index = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Breath training, five phases: mock-ups</title>
<style>
  body{margin:0;background:#f3eef2;font-family:'DM Sans',system-ui,sans-serif;color:${INK}}
  header{padding:32px 40px 8px} h1{font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:40px;margin:0}
  header p{margin:8px 0 0;font-size:16px;opacity:.8}
  section{padding:24px 40px} h2{font-size:16px;font-weight:600;margin:0 0 8px}
  img{width:100%;max-width:1280px;display:block;border-radius:12px;box-shadow:0 6px 24px rgba(31,42,61,.15)}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&family=DM+Serif+Display&display=swap"></head>
<body><header><h1>Breath training, five phases</h1><p>SVG mock-ups, round 1. Plan: docs/markdowns/breath_training_5phase_plan.md</p></header>
${SCREENS.map(([n, , t]) => `<section><h2>${t}</h2><img src="${n}.svg" alt="${t}"></section>`).join('\n')}
</body></html>`
writeFileSync(join(OUT, 'index.html'), index)
console.log(`wrote ${SCREENS.length} SVGs + index.html to ${OUT}`)
