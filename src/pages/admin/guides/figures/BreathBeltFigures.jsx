// What the Experiment Triggers channel looks like in AcqKnowledge, drawn from
// real recordings (Nov 5 2026, one right-seat file and one two-seat file):
// pulses about 30 ms wide, one every 0.3 s in the test cascade; in a paced
// trial, code 10 and code 12 about 18 s apart.
const FONT = '"DM Sans",system-ui,sans-serif'
const W = 640
const H = 160
const PAD = { l: 48, r: 16, t: 16, b: 32 }

// pulses: [{ t: seconds, v: level }], each held `width` seconds above `base`.
function tracePath({ pulses, base, width, tMax, yMin, yMax }) {
  const x = t => PAD.l + (t / tMax) * (W - PAD.l - PAD.r)
  const y = v => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  let d = `M ${x(0)} ${y(base)}`
  for (const p of pulses) {
    d += ` L ${x(p.t)} ${y(base)} L ${x(p.t)} ${y(p.v)} L ${x(p.t + width)} ${y(p.v)} L ${x(p.t + width)} ${y(base)}`
  }
  return { d: `${d} L ${x(tMax)} ${y(base)}`, x, y }
}

function Trace({ title, caption, pulses, base, width = 0.03, tMax, yMin, yMax, ticks, timeLabel }) {
  const { d, y } = tracePath({ pulses, base, width, tMax, yMin, yMax })
  return (
    <figure style={S.card}>
      <figcaption style={S.title}>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} style={S.svg} role="img" aria-label={`${title}. ${caption}`}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--bd)" strokeDasharray="4 4" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" style={S.tick}>{v}</text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--tx)" strokeWidth="1.5" />
        <text x={W - PAD.r} y={H - 8} textAnchor="end" style={S.tick}>{timeLabel}</text>
      </svg>
      <p style={S.caption}>{caption}</p>
    </figure>
  )
}

const cascade = (start, step) =>
  Array.from({ length: 13 }, (_, i) => ({ t: start + i * 0.3, v: step * (i + 1) }))

function RightStaircase() {
  return (
    <Trace
      title="Right rig, left seat empty (after autoscale)"
      caption="The line sits at 240. Thirteen spikes climb one step each, 241 to 253, over about 4 seconds."
      pulses={cascade(0.3, 1).map(p => ({ ...p, v: 240 + p.v }))}
      base={240} tMax={4.6} yMin={238} yMax={255} ticks={[240, 253]} timeLabel="4.6 s"
    />
  )
}

function LeftStaircase() {
  return (
    <Trace
      title="Left rig"
      caption="Big steps of 16: 16, 32, 48 … 208. The line sits at or near 0."
      pulses={cascade(0.3, 16)}
      base={0} tMax={4.6} yMin={0} yMax={224} ticks={[0, 208]} timeLabel="4.6 s"
    />
  )
}

function BothStaircases() {
  return (
    <Trace
      title="Both seats running"
      caption="The line sits at 0. The left computer's staircase is tall; the right computer's is the small one beside it (1 to 13). Zoom in to count it."
      pulses={[...cascade(0.3, 16), ...cascade(6.4, 1)]}
      base={0} tMax={10.6} yMin={0} yMax={224} ticks={[0, 208]} timeLabel="10.6 s"
    />
  )
}

// The trial pulses are drawn 0.3 s wide, not their real 30 ms, so they show
// at a 60-second scale.
function PacedTrials() {
  const trials = [0, 21.7, 43.4]
  return (
    <Trace
      title="During Blocks 3 and 4, right rig"
      caption="No staircase now. Each trial makes a pair: 250 at its start and 252 at its end, about 15 to 20 s apart, then a short gap before the next trial. The left rig's pair is 160 and 192."
      pulses={trials.flatMap(t => [{ t: t + 1, v: 250 }, { t: t + 19, v: 252 }])}
      base={240} width={0.3} tMax={66} yMin={236} yMax={256} ticks={[240, 252]} timeLabel="66 s"
    />
  )
}

export const FIGURES = {
  'staircase-right': RightStaircase,
  'staircase-left': LeftStaircase,
  'staircase-both': BothStaircases,
  'paced-trials': PacedTrials,
}

const S = {
  card: {
    margin: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
  },
  title: { fontFamily: FONT, fontSize: 14, fontWeight: 600, color: 'var(--tx)' },
  svg: { width: '100%', height: 'auto', display: 'block' },
  tick: { fontFamily: FONT, fontSize: 12, fill: 'var(--tx2)' },
  caption: { fontFamily: FONT, fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)', margin: 0 },
}
