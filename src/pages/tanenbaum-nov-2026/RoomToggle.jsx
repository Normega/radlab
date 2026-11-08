// The room's Toggle practice on the projector, from talk_poll_toggle_results()
// (20261108_talk_poll_toggles.sql), re-read every 2 s.
//
//   <RoomToggleLive>    during the two minutes: sensing vs thinking right now, and
//                       the room's share with the breath filling in across time.
//   <RoomToggleResults> after: the same timeline complete, plus the two numbers
//                       the talk is about (how long before a drift was noticed,
//                       and how often people came back).
import { PRACTICE_S, STORY, SENSE, roomSummary, useRows } from './toggle'

function useRoom(code, active) {
  const { rows, status } = useRows('talk_poll_toggle_results', code, active)
  return { s: roomSummary(rows), status }
}

export function RoomToggleLive({ code, active = true }) {
  const { s, status } = useRoom(code, active)
  const now = s.sensingNow + s.thinkingNow
  return (
    <div style={R.wrap}>
      <div style={R.counts}>
        <Count n={s.going} label="practising" />
        <Count n={s.done} label="finished" />
        {status === 'error' && <span style={R.warn}>reconnecting…</span>}
      </div>
      <div style={R.nowRow}>
        <NowBar label="With the breath" n={s.sensingNow} of={now} color={SENSE} />
        <NowBar label="Noticed thinking" n={s.thinkingNow} of={now} color={STORY} />
      </div>
      <Timeline bins={s.bins} />
    </div>
  )
}

export function RoomToggleResults({ code, active = true }) {
  const { s } = useRoom(code, active)
  const drift = s.medianDriftS == null ? '—' : `${Math.round(s.medianDriftS)} s`
  return (
    <div style={R.wrap}>
      <Timeline bins={s.bins} />
      <div style={R.statRow}>
        <Stat big={drift} label="with the breath before a drift was noticed" sub={`median of ${s.drifts} noticed drifts`} color={STORY} />
        <Stat big={s.cameBack} label={`of ${s.n} came back at least once`} sub={`${s.returnsTotal} returns in all`} color={SENSE} />
        <Stat big={s.noDrift} label="noticed no drift at all" sub="lucky, or not looking?" color="var(--tx2)" />
      </div>
    </div>
  )
}

function Count({ n, label }) {
  return <span style={R.count}><b style={R.countN}>{n}</b> {label}</span>
}

function NowBar({ label, n, of, color }) {
  const pct = of ? (n / of) * 100 : 0
  return (
    <div style={R.now}>
      <div style={R.nowHead}><span style={{ color }}>{label}</span><b style={{ ...R.nowN, color }}>{n}</b></div>
      <div style={R.track}><div style={{ ...R.fill, width: `${pct}%`, background: color }} /></div>
    </div>
  )
}

// Share of the room with the breath, 5 s bins across the two minutes. Each bar is
// split: pink with the breath, blue thinking; empty where no one has reached it yet.
function Timeline({ bins }) {
  const W = 960, H = 240, x0 = 48, y0 = 16, ph = H - 52, bw = (W - x0 - 8) / bins.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }} role="img" aria-label="The room's share with the breath over two minutes">
      {[0, 0.5, 1].map(v => (
        <g key={v}>
          <line x1={x0} x2={W - 8} y1={y0 + ph * (1 - v)} y2={y0 + ph * (1 - v)} stroke="#e4dfe2" />
          <text x={x0 - 8} y={y0 + ph * (1 - v) + 4} textAnchor="end" fontSize="13" fill="#8a8b8f" fontFamily="'DM Sans',sans-serif">{Math.round(v * 100)}%</text>
        </g>
      ))}
      {bins.map((b, k) => {
        if (b.share == null) return null
        const x = x0 + k * bw + 1, hs = ph * b.share
        return (
          <g key={k}>
            <rect x={x} y={y0 + ph - hs} width={bw - 2} height={hs} fill={SENSE} rx="2" />
            <rect x={x} y={y0} width={bw - 2} height={ph - hs} fill={STORY} opacity="0.55" rx="2" />
          </g>
        )
      })}
      {[0, 30, 60, 90, PRACTICE_S].map(t => (
        <text key={t} x={x0 + (t / PRACTICE_S) * (W - x0 - 8)} y={H - 20} textAnchor={t === 0 ? 'start' : t === PRACTICE_S ? 'end' : 'middle'} fontSize="13" fill="#8a8b8f" fontFamily="'Space Mono',monospace">
          {`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`}
        </text>
      ))}
      <text x={(W + x0) / 2} y={H - 2} textAnchor="middle" fontSize="13" fill="#8a8b8f" fontFamily="'DM Sans',sans-serif">time into each person’s two minutes</text>
    </svg>
  )
}

function Stat({ big, label, sub, color }) {
  return (
    <div style={R.stat}>
      <div style={{ ...R.statBig, color }}>{big}</div>
      <div style={R.statLabel}>{label}</div>
      {sub && <div style={R.statSub}>{sub}</div>}
    </div>
  )
}

const R = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' },
  counts: { display: 'flex', gap: 32, alignItems: 'baseline', fontSize: 20, color: 'var(--tx2)' },
  count: { display: 'inline-flex', gap: 8, alignItems: 'baseline' },
  countN: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 40, color: 'var(--tx)' },
  warn: { fontSize: 14, color: 'var(--tx3)' },
  nowRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, width: '100%', maxWidth: 960 },
  now: { display: 'flex', flexDirection: 'column', gap: 8 },
  nowHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 24, fontWeight: 600 },
  nowN: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 48 },
  track: { height: 24, borderRadius: 12, background: '#f1ecef', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 12, transition: 'width .6s ease' },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, width: '100%', maxWidth: 960 },
  stat: { background: '#fff', border: '1px solid #ecd6e1', borderRadius: 12, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4 },
  statBig: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 48, lineHeight: 1.05 },
  statLabel: { fontSize: 18, color: 'var(--tx)', lineHeight: 1.3 },
  statSub: { fontSize: 14, color: 'var(--tx3)' },
}
