// The room's mood check-in, live: one dot per phone on the mood circle
// (StillWater's wheel, as in the Lecture Lounge check-ins, but no avatars and
// no "you" dot: everyone is the same pink). Polls talk_poll_mood_results()
// every 2 s while shown, so late taps still land; each dot is placed by a seed
// from its person number, so it stays put between reads.
//
// The point of the slide is the question beside it: the top of the circle is
// activated and the bottom calm, so how did anyone know which half they were
// in? With no answers (phones couldn't connect) it shows the empty circle and
// asks the same thing by hands, and keeps polling.
import { CX, CY, INNER_R, OUTER_R, LABEL_R, EMOTIONS, d2r, wedgePath, centerAngle } from '../../games/StillWater/constants'
import { usePoll, moodBands, moodPoint } from './talkPoll'

const PK = '#F068A4'
const ZW = (OUTER_R - INNER_R) / 3
const MONO = "'Space Mono',monospace"
const SANS = "'DM Sans',sans-serif"
const SERIF = "'DM Serif Display',Georgia,serif"

export default function RoomMood({ code, active }) {
  const { rows, status } = usePoll(code, active, 2000, 'talk_poll_mood_results')
  const empty = rows.length === 0 && status !== 'loading'
  const b = moodBands(rows)
  return (
    <div style={M.row}>
      <Wheel rows={rows} />
      <div style={M.side}>
        {empty ? (
          <>
            <Hand k="↑" t="Hands up if you’d put yourself in the top half: more activated." />
            <Hand k="↓" t="And the bottom half: calmer, quieter?" />
            <p style={M.q}>How did you know which half you were in?</p>
            <p style={M.note}>{status === 'error' ? 'Can’t reach the poll right now' : 'No phone answers yet'} · dots appear if answers arrive</p>
          </>
        ) : (
          <>
            <p style={M.n}><b style={M.nBig}>{b.n}</b> {b.n === 1 ? 'person' : 'people'}</p>
            <div style={M.bands}>
              <Band k="↑" label="more activated" v={b.up} />
              <Band k="↔" label="in the middle" v={b.mid} />
              <Band k="↓" label="calmer" v={b.down} />
            </div>
            <p style={M.q}>How did you know whether to put yourself high or low?</p>
          </>
        )}
      </div>
    </div>
  )
}

function Wheel({ rows }) {
  const axis = { fontFamily: MONO, fontSize: 13, fill: '#8a8b8f', letterSpacing: '0.06em' }
  return (
    <svg viewBox="-100 -34 570 444" style={M.svg} role="img" aria-label={`Mood circle with ${rows.length} answers`}>
      <style>{`
        @keyframes rmPop { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.35); opacity: 1 } 100% { transform: scale(1) } }
        .rm-dot { transform-box: fill-box; transform-origin: center; animation: rmPop 0.5s ease-out both }
      `}</style>
      <defs>
        {EMOTIONS.map(e => (
          <radialGradient key={e.id} id={`rmg${e.id}`} cx={CX} cy={CY} r={OUTER_R} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FCF0F5" />
            <stop offset={`${(INNER_R / OUTER_R * 100).toFixed(1)}%`} stopColor={e.inner} stopOpacity="0.75" />
            <stop offset="100%" stopColor={e.outer} />
          </radialGradient>
        ))}
      </defs>
      {EMOTIONS.map(e => [0, 1, 2].map(z => (
        <path key={`${e.id}-${z}`} d={wedgePath(e.startAngle, e.endAngle, INNER_R + z * ZW, INNER_R + (z + 1) * ZW)}
          fill={`url(#rmg${e.id})`} stroke="#FCF0F5" strokeWidth="1.2" opacity="0.38" />
      )))}
      <circle cx={CX} cy={CY} r={INNER_R} fill="#FCF0F5" stroke="#E8D4E0" />

      {/* arousal is the vertical axis: say so outside the circle */}
      <line x1={CX} x2={CX} y1={CY - OUTER_R - 6} y2={CY - OUTER_R - 20} stroke="#8a8b8f" strokeWidth="1.5" />
      <text x={CX} y={CY - OUTER_R - 24} textAnchor="middle" style={axis}>MORE ACTIVATED</text>
      <line x1={CX} x2={CX} y1={CY + OUTER_R + 6} y2={CY + OUTER_R + 20} stroke="#8a8b8f" strokeWidth="1.5" />
      <text x={CX} y={CY + OUTER_R + 36} textAnchor="middle" style={axis}>CALMER</text>
      <text x={CX - OUTER_R - 10} y={CY + 4} textAnchor="end" style={axis}>UNPLEASANT</text>
      <text x={CX + OUTER_R + 10} y={CY + 4} textAnchor="start" style={axis}>PLEASANT</text>

      {rows.map(r => {
        const p = moodPoint(r)
        return <circle key={`${r.person}-${r.emotion_id}-${r.zone}`} className="rm-dot" cx={p.x} cy={p.y} r={7.5} fill={PK} stroke="#fff" strokeWidth="2" />
      })}

      {/* labels last, haloed, so dots never hide them */}
      {EMOTIONS.map(e => {
        const a = d2r(centerAngle(e))
        return (
          <text key={e.id} x={CX + LABEL_R * Math.cos(a)} y={CY + LABEL_R * Math.sin(a) + 5} textAnchor="middle"
            fontSize="15" fontWeight="600" fill="#5a5a60" fontFamily={SANS}
            stroke="#FCF0F5" strokeWidth="4" strokeOpacity="0.85" paintOrder="stroke">{e.name}</text>
        )
      })}
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize="14" fill="#B49AAA" fontFamily={SANS}>neutral</text>
    </svg>
  )
}

function Band({ k, label, v }) {
  return (
    <div style={M.band}>
      <span style={M.bandK}>{k}</span>
      <b style={M.bandV}>{v}</b>
      <span>{label}</span>
    </div>
  )
}

function Hand({ k, t }) {
  return (
    <div style={M.hand}>
      <span style={M.handK}>{k}</span>
      <span>{t}</span>
    </div>
  )
}

const M = {
  row: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, width: '100%', flexWrap: 'wrap' },
  svg: { height: 'min(60vh, 600px)', width: 'auto', maxWidth: '100%', display: 'block' },
  side: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: 16, maxWidth: 420, minWidth: 280, flex: '1 1 300px' },
  n: { margin: 0, fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--tx2)' },
  nBig: { fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(40px, 5vw, 64px)', color: 'var(--tx)', marginRight: 8 },
  bands: { display: 'flex', flexDirection: 'column', gap: 8 },
  band: { display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 'clamp(16px, 1.8vw, 22px)', color: 'var(--tx2)' },
  bandK: { fontFamily: MONO, color: 'var(--pkd)', width: 24, textAlign: 'center' },
  bandV: { fontFamily: MONO, color: 'var(--tx)', minWidth: 32, textAlign: 'right' },
  q: { margin: '8px 0 0', fontFamily: SERIF, fontSize: 'clamp(24px, 2.8vw, 34px)', lineHeight: 1.2, color: 'var(--tx)' },
  hand: { display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '16px 24px', fontSize: 'clamp(17px, 2vw, 22px)', color: 'var(--tx)', lineHeight: 1.35 },
  handK: { flex: '0 0 auto', width: 40, height: 40, borderRadius: 24, border: '2px solid var(--pkd)', color: 'var(--pkd)', display: 'grid', placeItems: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 20 },
  note: { fontFamily: MONO, fontSize: 14, color: 'var(--tx3)', margin: 0 },
}
