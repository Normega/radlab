import { useEffect, useRef, useState } from 'react'

const MONO = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The waiting screen after a student answers an open check-in: kernels along
// the top are the room still answering, popcorn in the bowl is the room that
// has. answered is the server's count and total is the room (presence; see
// roomProgress.js). The bowl fills by proportion: 40 pieces at most, 12 kernels at most, whatever the
// class size. Each new answer still gets its own pop, a kernel bursting and
// dropping into the bowl, capped at a few per update so a rush stays legible.
// Plan and rationale: docs/markdowns/lounge_popcorn_plan.md.

const PIECES = 40
const KERNELS = 12
const KERNEL_Y = 20
const MAX_BURSTS = 6

// Fixed pile slots, bottom row first and centre-out within a row, so the pile
// grows as a dome. Jitter is deterministic: the same slot always sits in the
// same place, so a re-render never reshuffles the bowl.
const SLOTS = (() => {
  const slots = []
  for (let r = 0; slots.length < PIECES; r++) {
    const y = 124 - r * 13
    const half = Math.max(0, 78 - r * 12)
    const n = Math.floor((half * 2) / 16) + 1
    const row = []
    for (let i = 0; i < n; i++) row.push(n === 1 ? 120 : 120 - half + (i * half * 2) / (n - 1))
    row.sort((a, b) => Math.abs(a - 120) - Math.abs(b - 120))
    for (const x of row) {
      if (slots.length >= PIECES) break
      const k = slots.length
      slots.push({ x: x + ((k * 37) % 7) - 3, y: y + ((k * 53) % 5) - 2, rot: (k * 47) % 360 })
    }
  }
  return slots
})()

function kernelX(i, n) {
  return n === 1 ? 120 : 48 + (i * 144) / (n - 1)
}

function Piece({ x, y, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <circle cx={-4} cy={1} r={6} fill="var(--bgc)" stroke="var(--bds)" strokeWidth={1} />
      <circle cx={4} cy={2} r={5.5} fill="var(--bgc)" stroke="var(--bds)" strokeWidth={1} />
      <circle cx={0} cy={-4} r={6} fill="var(--bgc)" stroke="var(--bds)" strokeWidth={1} />
      <circle cx={0} cy={1} r={4} fill="var(--bgc)" />
      <circle cx={1} cy={4} r={1.6} fill="var(--pkbs)" />
    </g>
  )
}

function Kernel({ x, y }) {
  return <path d={`M${x} ${y - 6} C${x + 5} ${y - 3} ${x + 5} ${y + 4} ${x} ${y + 5} C${x - 5} ${y + 4} ${x - 5} ${y - 3} ${x} ${y - 6} Z`} fill="var(--pkd)" />
}

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export default function PopcornBowl({ answered: answeredOrNull, total, width = 240 }) {
  // null = the first count hasn't arrived: an empty bowl and "Counting…",
  // never a guessed number.
  const counting = answeredOrNull === null || answeredOrNull === undefined
  const answered = counting ? 0 : answeredOrNull
  const shownTotal = counting ? 0 : Math.max(total, answered)
  const ratio = shownTotal > 0 ? answered / shownTotal : 0
  const waiting = shownTotal - answered
  const pieces = answered > 0 ? Math.min(PIECES, Math.max(1, Math.round(ratio * PIECES))) : 0
  const kernels = waiting > 0 ? Math.min(KERNELS, Math.max(1, Math.round((1 - ratio) * KERNELS))) : 0

  // A burst is a kernel popping and falling into the pile. The first value
  // seen fires one (this student's own answer, the reason the bowl is on
  // screen); after that, one per newly counted answer.
  const [bursts, setBursts] = useState([])
  const prevRef = useRef(null)
  const nextIdRef = useRef(0)
  useEffect(() => {
    if (counting) return
    const prev = prevRef.current
    prevRef.current = answered
    if (prefersReducedMotion()) return
    const fresh = prev === null ? (answered > 0 ? 1 : 0) : Math.min(MAX_BURSTS, answered - prev)
    if (fresh <= 0) return
    const target = SLOTS[Math.max(0, pieces - 1)]
    const n = Math.max(kernels, 1)
    const made = []
    for (let i = 0; i < fresh; i++) {
      const kx = kernelX((nextIdRef.current * 5) % n, n)
      made.push({
        id: nextIdRef.current++, kx,
        dx: target.x - kx + ((i * 11) % 9) - 4, dy: target.y - KERNEL_Y, delay: i * 140,
      })
    }
    setBursts((b) => [...b, ...made])
    const ids = new Set(made.map((m) => m.id))
    const timer = setTimeout(() => setBursts((b) => b.filter((m) => !ids.has(m.id))), 1100 + fresh * 140)
    return () => clearTimeout(timer)
    // pieces/kernels derive from answered and total; answered alone is the event.
  }, [answered, counting]) // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Math.round(ratio * 100)
  const label = shownTotal > 0
    ? `${answered} of ${shownTotal} in the room have answered, ${pct}%`
    : 'Counting the room'

  return (
    <div style={S.wrap}>
      <svg viewBox="0 0 240 206" width={width} style={S.svg} role="img" aria-label={label}>
        <defs>
          <clipPath id="popcorn-bucket">
            <path d="M40 132 L200 132 L180 202 L60 202 Z" />
          </clipPath>
        </defs>

        {Array.from({ length: kernels }, (_, i) => <Kernel key={`k${i}`} x={kernelX(i, kernels)} y={KERNEL_Y} />)}

        {SLOTS.slice(0, pieces).map((s, i) => <Piece key={`p${i}`} {...s} />)}

        {bursts.map((b) => (
          <g key={b.id} transform={`translate(${b.kx} ${KERNEL_Y})`}>
            <g className="popcorn-burst" style={{ '--dx': `${b.dx}px`, '--dy': `${b.dy}px`, animationDelay: `${b.delay}ms` }}>
              <Piece x={0} y={0} />
            </g>
          </g>
        ))}

        <g clipPath="url(#popcorn-bucket)">
          <rect x={40} y={132} width={160} height={70} fill="var(--pk)" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={52 + i * 32} y={132} width={14} height={70} fill="var(--bgc)" />
          ))}
        </g>
        <rect x={34} y={126} width={172} height={10} rx={5} fill="var(--pkd)" />
      </svg>

      {shownTotal > 0 ? (
        <>
          <p style={S.pct}>{pct}%</p>
          <p style={S.caption}>{answered} of {shownTotal} in the room have answered</p>
        </>
      ) : (
        <p style={S.caption}>Counting the room…</p>
      )}
    </div>
  )
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  svg: { maxWidth: '100%', height: 'auto', overflow: 'visible' },
  pct: { fontFamily: SERIF, fontSize: 32, color: 'var(--pkd)', margin: '8px 0 0', lineHeight: 1.1 },
  caption: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '4px 0 0' },
}

// The burst: a kernel scales up into a piece (the pop), hops, then falls to
// its spot in the pile and fades, handing over to the pile's own piece.
// transform-box makes the scale centre on the piece; translate stays in SVG
// user units. Reduced-motion users never get bursts (checked in JS), and the
// media query is a second guard.
if (typeof document !== 'undefined' && !document.getElementById('lecture-lounge-popcorn-kf')) {
  const style = document.createElement('style')
  style.id = 'lecture-lounge-popcorn-kf'
  style.textContent = `
.popcorn-burst { transform-box: fill-box; transform-origin: center; opacity: 0; animation: lecture-lounge-popcorn-pop 950ms cubic-bezier(.45,0,.75,.6) forwards; }
@keyframes lecture-lounge-popcorn-pop {
  0%   { transform: translate(0, 0) scale(0.3); opacity: 1; }
  22%  { transform: translate(0, -14px) scale(1.3); opacity: 1; }
  88%  { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .popcorn-burst { animation: none; display: none; } }`
  document.head.appendChild(style)
}
