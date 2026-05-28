import SignalGraph from './SignalGraph'
import { getPacerRadius } from '../breathUtils'

const CONDITION_COLORS = { same: '#888', faster: '#e67e22', slower: '#3498db' }
const CONDITION_LABELS = { same: 'Same', faster: 'Faster ↑', slower: 'Slower ↓' }

export default function Phase2ReviewScreen({ reviewData = [], onContinue }) {
  return (
    <div style={S.wrap}>
      <h2 style={S.title}>Phase 2 — trial review</h2>
      <p style={S.sub}>
        Blue = pacer (condition period) · Amber = belt signal. Trials are in presentation order.
      </p>

      <div style={S.legend}>
        <span><span style={{ color: '#3498db' }}>●</span> pacer</span>
        <span><span style={{ color: '#e67e22' }}>●</span> belt</span>
      </div>

      <div style={S.grid}>
        {reviewData.map((entry, i) => {
          const { condition, conditionSamples, trialStartMs, conditionMs, basePeriodMs } = entry
          const conditionStartMs = conditionSamples[0]?.t ?? (trialStartMs + 2 * basePeriodMs)
          const step = Math.max(1, Math.floor(conditionSamples.length / 60))
          const pacerPts = conditionSamples
            .filter((_, j) => j % step === 0)
            .map(s => ({ t: s.t, value: getPacerRadius(s.t, conditionStartMs, conditionMs) }))
          const beltPts = conditionSamples
            .filter((_, j) => j % step === 0)
            .map(s => ({ t: s.t, value: s.value }))

          const color = CONDITION_COLORS[condition] ?? '#888'
          return (
            <div key={i} style={S.cell}>
              <div style={S.cellHeader}>
                <span style={S.cellNum}>T{i + 1}</span>
                <span style={{ ...S.cellCond, color }}>{CONDITION_LABELS[condition] ?? condition}</span>
              </div>
              <SignalGraph pacerPts={pacerPts} beltPts={beltPts} width={140} height={72} />
            </div>
          )
        })}
      </div>

      <button style={S.btn} onClick={onContinue}>
        Continue to phase 3 →
      </button>
    </div>
  )
}

const S = {
  wrap: {
    maxWidth: 520,
    margin: '0 auto',
    padding: '32px 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  title: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 22,
    fontWeight: 400,
    color: 'var(--tx)',
    margin: 0,
  },
  sub: {
    fontSize: 13,
    color: 'var(--tx2)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    margin: 0,
    lineHeight: 1.5,
  },
  legend: {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    color: 'var(--tx3)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    padding: '8px 6px 10px',
  },
  cellHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingLeft: 2,
    paddingRight: 2,
  },
  cellNum: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 10,
    color: 'var(--tx3)',
  },
  cellCond: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 11,
    fontWeight: 600,
  },
  btn: {
    alignSelf: 'flex-start',
    background: 'var(--pk)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 24px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
}
