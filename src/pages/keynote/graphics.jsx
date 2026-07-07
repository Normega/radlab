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
  const cellW = 220, cellH = 92
  const cell = (abrupt, big, showAxis, key) => (
    <div key={key} style={{ border: '1px solid rgba(180,100,140,0.2)', borderRadius: 10, background: '#fff', padding: '8px 8px 4px' }}>
      <RateChangeTrace w={cellW} h={cellH} abrupt={abrupt} big={big} showAxis={showAxis} />
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
        {cell(true,  false, false, 'af')}
        {cell(true,  true,  false, 'at')}

        <div style={rowLabel}>gradual</div>
        {cell(false, false, true,  'gf')}
        {cell(false, true,  true,  'gt')}
      </div>
      <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: GRY }}>
        salience (rows) × magnitude (columns) · shared time axis, seconds
      </div>
    </div>
  )
}

const SCHEMA_BASE_S = 4.0   // baseline breath, seconds
const SCHEMA_TMAX_S = 16    // x-axis extent, shared by every panel
const SCHEMA_TICKS  = [0, 4, 8, 12, 16]

function RateChangeTrace({ w, h, abrupt, big, showAxis }) {
  // Exactly 4 breaths: 2 baseline, then a change at breath 3. Each breath is one
  // sine cycle. Critically, x is REAL TIME on a fixed seconds/pixel scale shared
  // across all four panels — so a large (faster) change draws visibly narrower
  // breaths than a small one, instead of being stretched to the same width.
  const pad = 10
  const b = SCHEMA_BASE_S
  const a = big ? 2.0 : 3.2                                  // seconds/breath after the change
  // Low salience amortizes the change linearly over breaths 2–4 so the total
  // duration equals the high-salience [b,b,a,a] version (= 2b + 2a). Both rows
  // therefore end at the same x within a magnitude column.
  const durs = abrupt
    ? [b, b, a, a]
    : [b, b + (a - b) / 3, b + 2 * (a - b) / 3, a]
  const usableW  = w - 2 * pad
  const pxPerSec = usableW / SCHEMA_TMAX_S
  const xOf = t => pad + t * pxPerSec
  const amp = h / 2 - 6
  const SPB = 44

  const pts = []
  let t0 = 0
  durs.forEach((d, bi) => {
    for (let s = 0; s <= SPB; s++) {
      if (bi > 0 && s === 0) continue
      const frac = s / SPB
      const x = xOf(t0 + frac * d)
      const y = h / 2 - Math.sin(frac * 2 * Math.PI) * amp
      pts.push(`${pts.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    }
    t0 += d
  })
  const onsetX = xOf(abrupt ? b * 2 : b)   // abrupt steps at breath 3; gradual begins at breath 2
  const svgH = showAxis ? h + 20 : h
  return (
    <svg width={w} height={svgH} style={{ display: 'block' }}>
      {SCHEMA_TICKS.map(tk => (
        <line key={tk} x1={xOf(tk)} y1={2} x2={xOf(tk)} y2={h - 2} stroke="#1c1c1e" strokeWidth="1" opacity="0.05" />
      ))}
      <line x1={onsetX} y1={2} x2={onsetX} y2={h - 2} stroke={PINK} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <path d={pts.join(' ')} fill="none" stroke={BLUE} strokeWidth="2" />
      {showAxis && (
        <g>
          <line x1={xOf(0)} y1={h + 2} x2={xOf(SCHEMA_TMAX_S)} y2={h + 2} stroke={GRY} strokeWidth="1" />
          {SCHEMA_TICKS.map(tk => (
            <g key={tk}>
              <line x1={xOf(tk)} y1={h + 2} x2={xOf(tk)} y2={h + 5} stroke={GRY} strokeWidth="1" />
              <text x={xOf(tk)} y={h + 15} fill={GRY} fontSize="9" fontFamily="monospace" textAnchor="middle">{tk}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

// ── Slide 13: one annotated MISSED trial ────────────────────────────────────
// A single belt trace (with the pacer target overlaid) from a trial the person
// did NOT consciously detect. It still shows the paced rate change — and the
// annotation makes explicit how the per-trial "correct direction" adherence
// score is read off the belt. That score is ~equal on hits and misses, so
// adherence is not what separates them.
export function MissTrialTrace() {
  const W = 560, H = 256, padL = 18, padR = 18
  const T = 24, cue = 8
  const bandTop = 84, bandBot = 176
  const midY = (bandTop + bandBot) / 2, amp = (bandBot - bandTop) / 2 - 4
  const xOf = t => padL + (t / T) * (W - padL - padR)
  const periodAt = t => (t < cue ? 4.0 : 5.0)   // seconds/breath: 15/min → 12/min (Study 5 range)

  const rng = mulberry32(42)
  const N = 700
  const pacer = [], belt = []
  let phP = 0, phB = 0, prev = 0
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * T
    const dt = t - prev; prev = t
    phP += (2 * Math.PI / periodAt(t)) * dt
    phB += (2 * Math.PI / periodAt(Math.max(0, t - 0.4))) * dt   // slight belt lag
    const yP = midY - Math.sin(phP) * amp
    const yB = midY - Math.sin(phB) * (amp * 0.9) + (rng() - 0.5) * 3
    pacer.push(`${i === 0 ? 'M' : 'L'}${xOf(t).toFixed(1)},${yP.toFixed(1)}`)
    belt.push(`${i === 0 ? 'M' : 'L'}${xOf(t).toFixed(1)},${yB.toFixed(1)}`)
  }

  const cueX = xOf(cue)
  const ticks = [0, 4, 8, 12, 16, 20, 24]
  const bracket = (x1, x2, label, sub) => (
    <g>
      <line x1={x1} y1={70} x2={x2} y2={70} stroke={GRY} strokeWidth="1" />
      <line x1={x1} y1={70} x2={x1} y2={76} stroke={GRY} strokeWidth="1" />
      <line x1={x2} y1={70} x2={x2} y2={76} stroke={GRY} strokeWidth="1" />
      <text x={(x1 + x2) / 2} y={60} fill="#6b6c70" fontSize="11" fontFamily="'DM Sans',sans-serif" textAnchor="middle">{label}</text>
      <text x={(x1 + x2) / 2} y={49} fill={GRY} fontSize="10" fontFamily="monospace" textAnchor="middle">{sub}</text>
    </g>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width={W} height={H} style={{ background: '#fff', border: '1px solid rgba(180,100,140,0.18)', borderRadius: 12, display: 'block', maxWidth: '100%' }}>
        {/* miss label */}
        <text x={padL} y={22} fill="#e0447a" fontSize="12" fontFamily="monospace" letterSpacing="0.08em">MISSED TRIAL</text>
        <text x={padL} y={36} fill="#6b6c70" fontSize="11" fontFamily="'DM Sans',sans-serif">participant reported: no change</text>

        {/* rate brackets */}
        {bracket(xOf(0.4), xOf(7.6), 'baseline', '15 / min · 4 s')}
        {bracket(xOf(8.4), xOf(23.6), 'after cue', '12 / min · 5 s')}

        {/* cue line */}
        <line x1={cueX} y1={bandTop - 8} x2={cueX} y2={bandBot + 8} stroke="#e8a33d" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={cueX + 5} y={bandTop + 4} fill="#c98a1f" fontSize="10" fontFamily="monospace">rate-change cue</text>

        {/* traces */}
        <path d={pacer.join(' ')} fill="none" stroke={BLUE} strokeWidth="1.6" strokeDasharray="5 4" opacity="0.75" />
        <path d={belt.join(' ')} fill="none" stroke={PINK} strokeWidth="2" />

        {/* time axis */}
        <line x1={xOf(0)} y1={bandBot + 12} x2={xOf(T)} y2={bandBot + 12} stroke={GRY} strokeWidth="1" />
        {ticks.map(tk => (
          <g key={tk}>
            <line x1={xOf(tk)} y1={bandBot + 12} x2={xOf(tk)} y2={bandBot + 16} stroke={GRY} strokeWidth="1" />
            <text x={xOf(tk)} y={bandBot + 28} fill={GRY} fontSize="9" fontFamily="monospace" textAnchor="middle">{tk}</text>
          </g>
        ))}
        <text x={xOf(T)} y={bandBot + 28} fill={GRY} fontSize="9" fontFamily="monospace" textAnchor="end">s</text>

        {/* legend */}
        <g fontFamily="'DM Sans',sans-serif" fontSize="10.5">
          <line x1={W - 210} y1={20} x2={W - 188} y2={20} stroke={BLUE} strokeWidth="1.6" strokeDasharray="5 4" />
          <text x={W - 184} y={23} fill="#6b6c70">pacer target</text>
          <line x1={W - 210} y1={36} x2={W - 188} y2={36} stroke={PINK} strokeWidth="2" />
          <text x={W - 184} y={39} fill="#6b6c70">breath (belt)</text>
        </g>
      </svg>

      {/* how the adherence score is read off this trial */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(240,104,164,0.1)', border: '1px solid rgba(240,104,164,0.35)', borderRadius: 10, padding: '8px 16px', fontSize: 14, color: INK }}>
        <span style={{ fontFamily: '"Space Mono",monospace', color: '#c04a82' }}>belt rate 15 → 12 / min</span>
        <span style={{ color: GRY }}>moved in the cued direction</span>
        <span style={{ fontWeight: 700, color: '#2ecc71' }}>✓ correct</span>
      </div>
    </div>
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
