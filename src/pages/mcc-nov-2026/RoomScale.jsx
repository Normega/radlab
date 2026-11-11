// The room's answers to the eight statements on the projector, from
// talk_poll_scale_results() (20261111_talk_poll_scale.sql), re-read every 2 s.
//
//   <RoomScaleLive>    while people answer: how many have sent.
//   <RoomScaleResults> later: the spread of people's averages beside Study 2a's
//                      mean, and each statement's agreement, room vs Study 2a.
import { STORY, SENSE } from '../tanenbaum-nov-2026/toggle'
import { REF_2A, MIN_ANSWERED, scaleSummary, useScaleRows } from './scale'

export function RoomScaleLive({ code, active = true }) {
  const { rows, status } = useScaleRows(code, active)
  return (
    <div style={R.live}>
      <b style={R.liveN}>{rows.length}</b>
      <span style={R.liveL}>{rows.length === 1 ? 'person has answered' : 'people have answered'}</span>
      {status === 'error' && <span style={R.warn}>reconnecting…</span>}
    </div>
  )
}

export function RoomScaleResults({ code, active = true }) {
  const { rows, status } = useScaleRows(code, active)
  const s = scaleSummary(rows)
  return (
    <div style={R.wrap}>
      <div style={R.grid}>
        <div style={R.panel}>
          <span style={R.head}>Each person’s average · higher = more sensing</span>
          <Spread bins={s.bins} mean={s.mean} />
          <div style={R.legend}>
            <span><i style={{ ...R.swatch, background: SENSE }} /> this room{s.mean != null ? `, mean ${s.mean.toFixed(2)}` : ''} (n = {s.n})</span>
            <span><i style={{ ...R.swatch, background: 'var(--tx)', height: 3 }} /> Study 2a, mean {REF_2A.mean.toFixed(2)} (N = {REF_2A.n})</span>
          </div>
        </div>
        <div style={R.panel}>
          <span style={R.head}>% agreeing with each statement</span>
          <div style={R.items}>
            {s.items.map(it => <ItemRow key={it.code} it={it} hardest={s.hardest?.code === it.code} />)}
          </div>
          <div style={R.legend}>
            <span><i style={{ ...R.swatch, background: SENSE }} /> this room</span>
            <span><i style={{ ...R.swatch, background: 'var(--tx)', width: 3, height: 14 }} /> Study 2a</span>
            <span><b style={R.rTag}>R</b> reversed: agreeing means less sensing</span>
          </div>
        </div>
      </div>
      {status === 'error' && <span style={R.warn}>reconnecting…</span>}
      {s.answered > s.n && <span style={R.note}>{s.answered - s.n} answered fewer than {MIN_ANSWERED} of the 8 and aren’t in the averages.</span>}
    </div>
  )
}

// Histogram of person averages in half-point bins, 1 to 6, with the room's and
// Study 2a's means marked.
function Spread({ bins, mean }) {
  const W = 560, H = 260, x0 = 16, x1 = W - 16, y0 = 16, ph = H - 64
  const max = Math.max(1, ...bins.map(b => b.n))
  const x = v => x0 + ((v - 1) / 5) * (x1 - x0)
  const bw = (x1 - x0) / bins.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Histogram of each person's average from 1 to 6, with this room's mean and Study 2a's mean">
      <line x1={x0} x2={x1} y1={y0 + ph} y2={y0 + ph} stroke="#cfc8cc" />
      {bins.map((b, k) => {
        const h = (b.n / max) * ph
        return (
          <g key={k}>
            {b.n > 0 && <rect x={x0 + k * bw + 2} y={y0 + ph - h} width={bw - 4} height={h} rx="4" fill={SENSE} opacity="0.85" />}
            {b.n > 0 && <text x={x0 + k * bw + bw / 2} y={y0 + ph - h - 6} textAnchor="middle" fontSize="14" fill="#6b6c70" fontFamily="'Space Mono',monospace">{b.n}</text>}
          </g>
        )
      })}
      <line x1={x(REF_2A.mean)} x2={x(REF_2A.mean)} y1={y0} y2={y0 + ph + 6} stroke="#2a2a2e" strokeWidth="3" strokeDasharray="6 4" />
      {mean != null && <line x1={x(mean)} x2={x(mean)} y1={y0} y2={y0 + ph + 6} stroke="#c04a82" strokeWidth="4" />}
      {[1, 2, 3, 4, 5, 6].map(v => (
        <text key={v} x={x(v)} y={y0 + ph + 24} textAnchor="middle" fontSize="14" fill="#6b6c70" fontFamily="'Space Mono',monospace">{v}</text>
      ))}
      <text x={x0} y={H - 8} fontSize="14" fill={STORY} fontFamily="'DM Sans',sans-serif">more doing</text>
      <text x={x1} y={H - 8} textAnchor="end" fontSize="14" fill="#c04a82" fontFamily="'DM Sans',sans-serif">more sensing</text>
    </svg>
  )
}

function ItemRow({ it, hardest }) {
  return (
    <div style={{ ...R.row, ...(hardest ? R.rowHard : {}) }}>
      <span style={R.rowText}>
        {it.reversed && <b style={R.rTag}>R</b>}
        {it.short}
        {hardest && <span style={R.hardTag}>hardest for this room</span>}
      </span>
      <div style={R.track}>
        {it.agree != null && <div style={{ ...R.fill, width: `${it.agree}%`, background: it.reversed ? STORY : SENSE }} />}
        <span style={{ ...R.tick, left: `${it.agree2a}%` }} />
      </div>
      <span style={R.pct}>{it.agree == null ? '—' : `${Math.round(it.agree)}%`}</span>
    </div>
  )
}

const R = {
  live: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  liveN: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 'clamp(64px, 10vw, 120px)', lineHeight: 1, color: 'var(--pkd)' },
  liveL: { fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--tx2)' },
  warn: { fontSize: 14, color: 'var(--tx3)' },
  note: { fontSize: 14, color: 'var(--tx3)' },
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: 24, width: '100%', alignItems: 'start' },
  panel: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' },
  head: { fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pkd)' },
  legend: { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14, color: 'var(--tx2)', alignItems: 'center' },
  swatch: { display: 'inline-block', width: 14, height: 14, borderRadius: 4, verticalAlign: 'middle', marginRight: 4 },
  items: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(120px, 0.8fr) 48px', gap: 16, alignItems: 'center', padding: '4px 8px', borderRadius: 12 },
  rowHard: { background: 'var(--pkb, #fde8f2)' },
  rowText: { fontSize: 'clamp(14px, 1.3vw, 16px)', color: 'var(--tx)', lineHeight: 1.3, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'baseline' },
  rTag: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: STORY, border: `1px solid ${STORY}`, borderRadius: 4, padding: '0 4px', marginRight: 4 },
  hardTag: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--pkd)' },
  track: { position: 'relative', height: 16, borderRadius: 12, background: '#f1ecef' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12, transition: 'width .6s ease' },
  tick: { position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1, background: 'var(--tx)', borderRadius: 2 },
  pct: { fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx)', textAlign: 'right' },
}
