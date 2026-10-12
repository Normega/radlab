// The room's answers, live: felt activation (1-6) for people who noticed the
// change (said "faster") vs people who missed it (said "same" or "slower"),
// once per trial. Polls talk_poll_results() every 2 s while shown.
//
// Small rooms make this noisy, and the script says so. Nothing here asserts a
// result: it draws every dot and prints n beside every mean.
//
// With no answers (phones couldn't connect, or the server can't be reached) it
// shows the hands-up version instead of empty axes, and keeps polling: if
// answers arrive, the figure replaces it on its own.
import { usePoll, summarize, mean } from './talkPoll'

const GOLD = '#D99A00'
const BLUE = '#0072B2'

export default function LiveResults({ code, active }) {
  const { rows, status } = usePoll(code, active)
  const s = summarize(rows)
  if (rows.length === 0 && status !== 'loading') return <ByHands offline={status === 'error'} />
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

// The same three questions the figure answers, asked of the room by hand.
function ByHands({ offline }) {
  const qs = [
    { k: '1', c: BLUE, t: 'Trial 1, the slow drift: hands up if you noticed it speed up.' },
    { k: '2', c: GOLD, t: 'Trial 2, the sudden switch: hands up if you noticed it.' },
    { k: '3', c: 'var(--pkd)', t: 'Hands up if trial 2 left you feeling more activated than trial 1.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 860 }}>
      {qs.map(q => (
        <div key={q.k} style={R.hand}>
          <span style={{ ...R.handK, color: q.c, borderColor: q.c }}>{q.k}</span>
          <span>{q.t}</span>
        </div>
      ))}
      <p style={R.handNote}>{offline ? 'Can’t reach the poll right now' : 'No phone answers yet'} · the figure appears here if answers arrive</p>
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
  hand: { display: 'flex', alignItems: 'center', gap: 16, width: '100%', background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '16px 24px', textAlign: 'left', fontSize: 'clamp(18px, 2.2vw, 24px)', color: 'var(--tx)', lineHeight: 1.35 },
  handK: { flex: '0 0 auto', width: 40, height: 40, borderRadius: 24, border: '2px solid', display: 'grid', placeItems: 'center', fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: 20 },
  handNote: { fontFamily: "'Space Mono',monospace", fontSize: 14, color: 'var(--tx3)', margin: 0 },
  foot: { display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center', fontSize: 'clamp(15px, 1.8vw, 20px)', color: 'var(--tx2)' },
}
