// The room's answers, live: felt activation (1-6) for people who noticed the
// change (said "faster") vs people who missed it (said "same" or "slower"),
// once per trial. Polls talk_poll_results() every 2 s while shown.
//
// Small rooms make this noisy, and the script says so. Nothing here asserts a
// result: it draws every dot and prints n beside every mean.
import { usePollResults, summarize, mean } from './talkPoll'

const GOLD = '#D99A00'
const BLUE = '#0072B2'

export default function LiveResults({ code, active }) {
  const rows = usePollResults(code, active)
  const s = summarize(rows)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
        <Panel title="Trial 1 · gradual" split={s.t1} />
        <Panel title="Trial 2 · abrupt" split={s.t2} />
      </div>
      <div style={R.foot}>
        <span><b>{s.t1.noticed.length}</b> of {s.n1} noticed trial 1</span>
        <span><b>{s.t2.noticed.length}</b> of {s.n2} noticed trial 2</span>
        {s.pairs > 0 && <span><b>{s.higherAfter2}</b> of {s.pairs} felt more activated after trial 2</span>}
      </div>
    </div>
  )
}

function Panel({ title, split }) {
  const W = 420, H = 320, padL = 44, padB = 54, padT = 36
  const yOf = v => padT + (6 - v) * ((H - padT - padB) / 5)
  const cols = [
    { key: 'missed', label: 'missed it', x: 150, color: BLUE, vals: split.missed },
    { key: 'noticed', label: 'noticed it', x: 320, color: GOLD, vals: split.noticed },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 'min(46vw, 460px)', height: 'auto', background: '#fff', borderRadius: 12, border: '1px solid rgba(180,100,140,0.18)' }}>
      <text x={W / 2} y={22} textAnchor="middle" fontSize="16" fontWeight="600" fill="#1c1c1e" fontFamily="'DM Sans',sans-serif">{title}</text>
      {[1, 2, 3, 4, 5, 6].map(v => (
        <g key={v}>
          <line x1={padL} x2={W - 12} y1={yOf(v)} y2={yOf(v)} stroke="#f0e4ea" />
          <text x={padL - 10} y={yOf(v) + 4} textAnchor="end" fontSize="12" fill="#8a8b8f" fontFamily="'Space Mono',monospace">{v}</text>
        </g>
      ))}
      <text x={14} y={(padT + H - padB) / 2} fontSize="12" fill="#8a8b8f" textAnchor="middle" transform={`rotate(-90 14 ${(padT + H - padB) / 2})`} fontFamily="'DM Sans',sans-serif">felt activation</text>
      {cols.map(c => {
        // stack dots side by side at each rating
        const counts = {}
        const dots = c.vals.map(v => {
          const k = counts[v] = (counts[v] ?? 0) + 1
          const off = (k % 2 ? 1 : -1) * Math.floor(k / 2) * 11
          return { v, x: c.x + off }
        })
        const m = mean(c.vals)
        return (
          <g key={c.key}>
            {dots.map((d, i) => <circle key={i} cx={d.x} cy={yOf(d.v)} r={5} fill={c.color} fillOpacity="0.55" />)}
            {m !== null && (
              <g>
                <line x1={c.x - 46} x2={c.x + 46} y1={yOf(m)} y2={yOf(m)} stroke={c.color} strokeWidth="4" strokeLinecap="round" />
                <text x={c.x + 50} y={yOf(m) + 4} fontSize="13" fontWeight="700" fill={c.color} fontFamily="'Space Mono',monospace">{m.toFixed(1)}</text>
              </g>
            )}
            <text x={c.x} y={H - padB + 24} textAnchor="middle" fontSize="14" fontWeight="600" fill={c.color} fontFamily="'DM Sans',sans-serif">{c.label}</text>
            <text x={c.x} y={H - padB + 42} textAnchor="middle" fontSize="12" fill="#8a8b8f" fontFamily="'Space Mono',monospace">n = {c.vals.length}</text>
          </g>
        )
      })}
    </svg>
  )
}

const R = {
  foot: { display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center', fontSize: 'clamp(15px, 1.8vw, 20px)', color: 'var(--tx2)' },
}
