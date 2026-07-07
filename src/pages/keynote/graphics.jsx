// Original SVG graphics for the ISARP keynote deck. No paper figures here —
// these are the "build fresh" schematics/illustrations called out in the brief.
// Styled to the RADlab palette (pink var(--pk) #f068a4, blue #4A90D9 accent).
import { mulberry32, hashStringToInt } from '../../utils/seededRandom'

const PINK = '#f068a4'
const BLUE = '#4A90D9'
const INK  = '#1c1c1e'
const GRY  = '#a8a9ad'

// ── Slide 6: three intervention-target icons ────────────────────────────────
export function PositionIcons() {
  const items = [
    { key: 'body',      title: 'Constitutive',   sub: 'intervene on the body',      icon: <BodyIcon /> },
    { key: 'meaning',   title: 'Constructivist', sub: 'intervene on meaning',       icon: <ThoughtIcon /> },
    { key: 'detection', title: 'Moderate',       sub: 'intervene on detection',     icon: <EyeIcon /> },
  ]
  return (
    <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
      {items.map(it => (
        <div key={it.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 180 }}>
          <div style={{ width: 96, height: 96, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'rgba(240,104,164,0.08)', border: '1.5px solid rgba(240,104,164,0.25)' }}>
            {it.icon}
          </div>
          <div style={{ fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 22, color: INK }}>{it.title}</div>
          <div style={{ fontSize: 15, color: '#6b6c70', textAlign: 'center' }}>{it.sub}</div>
        </div>
      ))}
    </div>
  )
}

function BodyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke={PINK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="11" r="6" />
      <path d="M24 17 L24 34 M24 22 L13 28 M24 22 L35 28 M24 34 L17 44 M24 34 L31 44" />
    </svg>
  )
}
function ThoughtIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke={PINK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 22 a12 9 0 1 1 24 0 a12 9 0 0 1 -14 8 l-6 5 l1 -7 a12 9 0 0 1 -5 -6 Z" />
      <circle cx="17" cy="22" r="1.4" fill={PINK} stroke="none" />
      <circle cx="23" cy="22" r="1.4" fill={PINK} stroke="none" />
      <circle cx="29" cy="22" r="1.4" fill={PINK} stroke="none" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke={PINK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 24 C12 13 36 13 44 24 C36 35 12 35 4 24 Z" />
      <circle cx="24" cy="24" r="6" />
      <circle cx="24" cy="24" r="1.6" fill={PINK} stroke="none" />
    </svg>
  )
}

// ── Slide 9: salience (abrupt vs ramp) × magnitude (staircase) schematic ────
// Each cell shows baseline breathing then a rate change: abrupt = step onset,
// ramp = gradual; small vs large = change magnitude (one of several staircase
// levels).
export function SalienceMagnitudeSchematic() {
  const cellW = 190, cellH = 96
  const cell = (abrupt, big, key) => (
    <div key={key} style={{ border: '1px solid rgba(180,100,140,0.2)', borderRadius: 10, background: '#fff', padding: 8 }}>
      <RateChangeTrace w={cellW} h={cellH} abrupt={abrupt} big={big} />
    </div>
  )
  const colLabel = { fontFamily: '"Space Mono",monospace', fontSize: 12, color: GRY, textAlign: 'center', letterSpacing: '0.04em' }
  const rowLabel = { fontFamily: '"Space Mono",monospace', fontSize: 12, color: GRY, writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', letterSpacing: '0.06em' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '24px auto auto', gridTemplateRows: 'auto auto auto', gap: 10, alignItems: 'center' }}>
        <div />
        <div style={colLabel}>small change</div>
        <div style={colLabel}>large change</div>

        <div style={rowLabel}>abrupt</div>
        {cell(true,  false, 'af')}
        {cell(true,  true,  'at')}

        <div style={rowLabel}>gradual</div>
        {cell(false, false, 'gf')}
        {cell(false, true,  'gt')}
      </div>
      <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: GRY }}>
        salience (rows) × magnitude — staircase levels (columns)
      </div>
    </div>
  )
}

function RateChangeTrace({ w, h, abrupt, big }) {
  // Exactly 4 breaths: 2 baseline, then a change at breath 3. Each breath is one
  // sine cycle; a shorter duration = faster breath. big => larger change;
  // abrupt = step at breath 3, gradual = ramp across breaths 3–4.
  const pad = 6
  const baseD = 1.0
  const accD  = big ? 0.55 : 0.78
  const durs  = abrupt
    ? [baseD, baseD, accD, accD]
    : [baseD, baseD, (baseD + accD) / 2, accD]
  const total   = durs.reduce((a, b) => a + b, 0)
  const usableW = w - 2 * pad
  const amp     = h / 2 - pad - 2
  const SPB     = 44   // samples per breath

  const pts = []
  let t = 0
  durs.forEach((d, bi) => {
    for (let s = 0; s <= SPB; s++) {
      if (bi > 0 && s === 0) continue   // shared boundary point
      const frac = s / SPB
      const x = pad + ((t + frac * d) / total) * usableW
      const y = h / 2 - Math.sin(frac * 2 * Math.PI) * amp
      pts.push(`${pts.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    }
    t += d
  })
  const onsetX = pad + ((durs[0] + durs[1]) / total) * usableW  // start of breath 3
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <line x1={onsetX} y1={4} x2={onsetX} y2={h - 4} stroke={PINK} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <path d={pts.join(' ')} fill="none" stroke={BLUE} strokeWidth="2" />
    </svg>
  )
}

// ── Slide 13: two belt traces, hit vs miss, both showing the real change ────
export function BeltTraces() {
  const panels = [
    { label: 'Hit trial',  stat: '88.9% correct direction', tone: PINK },
    { label: 'Miss trial', stat: '91.0% correct direction', tone: BLUE },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
        {panels.map((p, i) => (
          <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, color: INK }}>{p.label}</div>
            <div style={{ border: '1px solid rgba(180,100,140,0.2)', borderRadius: 10, background: '#0d1117', padding: 10 }}>
              <BeltWave w={300} h={120} seed={i} color={p.tone} />
            </div>
            <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, color: GRY }}>{p.stat}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BeltWave({ w, h, seed, color }) {
  // Respiration-like trace: slow breaths then faster, with a little jitter so it
  // reads like a real belt. Both panels change identically — the point of the slide.
  const rng = mulberry32(1000 + seed * 7)
  const N = 320, pad = 8
  const baseP = 62, newP = 40, onset = 0.45
  let phase = 0
  const pts = []
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1)
    const period = f < onset ? baseP : newP
    phase += (2 * Math.PI) / period
    const jitter = (rng() - 0.5) * 4
    const x = pad + f * (w - 2 * pad)
    const y = h / 2 - Math.sin(phase) * (h / 2 - pad - 6) + jitter
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  const onsetX = pad + onset * (w - 2 * pad)
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <line x1={onsetX} y1={4} x2={onsetX} y2={h - 4} stroke="#e67e22" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      <text x={onsetX + 4} y={14} fill="#e67e22" fontSize="9" fontFamily="monospace">rate ↑</text>
      <path d={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" opacity="0.95" />
    </svg>
  )
}

// ── Slide 14: two illustrative MAIA scatterplots (r = .260 and r = .071) ─────
export function MaiaScatter({ r, yLabel, seed }) {
  const w = 300, h = 220, pad = 34
  const pts = genCorrelated(90, r, seed)
  // normalize to plot box
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)
  const toX = x => pad + ((x - xMin) / (xMax - xMin)) * (w - pad - 8)
  const toY = y => (h - pad) - ((y - yMin) / (yMax - yMin)) * (h - pad - 8)
  // least-squares line
  const n = pts.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0
  pts.forEach(p => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2 })
  const slope = sxy / sxx, intc = my - slope * mx
  const lineX1 = xMin, lineX2 = xMax
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={w} height={h} style={{ background: '#fff', border: '1px solid rgba(180,100,140,0.18)', borderRadius: 8 }}>
        <line x1={pad} y1={h - pad} x2={w - 6} y2={h - pad} stroke={GRY} strokeWidth="1" />
        <line x1={pad} y1={6} x2={pad} y2={h - pad} stroke={GRY} strokeWidth="1" />
        {pts.map((p, i) => (
          <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r="3" fill={PINK} opacity="0.5" />
        ))}
        <line x1={toX(lineX1)} y1={toY(slope * lineX1 + intc)} x2={toX(lineX2)} y2={toY(slope * lineX2 + intc)} stroke={INK} strokeWidth="2" />
        <text x={(w + pad) / 2} y={h - 8} fill="#6b6c70" fontSize="12" textAnchor="middle" fontFamily="'DM Sans',sans-serif">MAIA total</text>
        <text x={14} y={h / 2} fill="#6b6c70" fontSize="12" textAnchor="middle" fontFamily="'DM Sans',sans-serif" transform={`rotate(-90 14 ${h / 2})`}>{yLabel}</text>
      </svg>
      <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 13, color: INK }}>r = {r.toFixed(3)}</div>
    </div>
  )
}

function genCorrelated(n, r, seedStr) {
  const rng = mulberry32(hashStringToInt(String(seedStr)))
  const gauss = () => {
    let u = 0, v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const pts = []
  for (let i = 0; i < n; i++) {
    const x = gauss()
    const y = r * x + Math.sqrt(1 - r * r) * gauss()
    pts.push({ x, y })
  }
  return pts
}

// ── Slide 18: neural pathway flow ───────────────────────────────────────────
export function NeuralFlow() {
  const stages = [
    { t: 'Breath signal',            s: 'interoceptive afferents' },
    { t: 'Insula · post. cingulate', s: 'primary representation' },
    { t: 'ACC — gate',               s: 'sparing tracks MAIA' },
    { t: 'Dorsal attention network', s: 'attentional engagement' },
    { t: 'Conscious detection',      s: 'you notice the change' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {stages.map((st, i) => (
        <div key={st.t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 150, minHeight: 84, borderRadius: 12, padding: '12px 12px',
            background: i === 2 ? 'rgba(240,104,164,0.1)' : '#fff',
            border: `1.5px solid ${i === 2 ? PINK : 'rgba(180,100,140,0.2)'}`,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{st.t}</div>
            <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, color: GRY }}>{st.s}</div>
          </div>
          {i < stages.length - 1 && <span style={{ color: PINK, fontSize: 20 }}>→</span>}
        </div>
      ))}
    </div>
  )
}

// ── Slide 21: person attending to the pacer (image-only callback) ───────────
export function PacerAttentionIllustration() {
  return (
    <svg width="360" height="240" viewBox="0 0 360 240" fill="none">
      <circle cx="250" cy="110" r="62" fill="url(#pk)" opacity="0.9" />
      <defs>
        <radialGradient id="pk" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#ff9ec9" />
          <stop offset="72%" stopColor={PINK} />
        </radialGradient>
      </defs>
      {/* head + shoulders silhouette, facing the circle */}
      <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="96" cy="96" r="30" />
        <path d="M52 190 C52 150 140 150 140 190" />
      </g>
      <path d="M132 108 C170 100 196 104 186 110" stroke={GRY} strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
    </svg>
  )
}
