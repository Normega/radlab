import SignalGraph from './SignalGraph'

const CONDITION_COLORS = {
  faster: '#3498db',
  slower: '#9b59b6',
  same:   '#95a5a6',
}

const CONDITION_LABELS = { faster: 'Faster', slower: 'Slower', same: 'Same' }

export default function Phase2ReviewScreen({ trialGraphs, onContinue }) {
  return (
    <div
      className="flex flex-col items-center gap-6 px-6 py-8"
      style={{ maxWidth: 680, margin: '0 auto' }}
    >
      <h2 style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: 'var(--tx)', margin: 0 }}>
        Phase 2 complete
      </h2>
      <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)', margin: 0 }}>
        Signal quality across all 9 trials. Blue = pacer, amber = belt.
      </p>

      {/* 3×3 grid */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap:                 12,
          width:               '100%',
        }}
      >
        {trialGraphs.map((g, i) => (
          <div
            key={i}
            style={{
              background:   '#0d1117',
              borderRadius: 8,
              padding:      8,
              display:      'flex',
              flexDirection:'column',
              gap:          4,
            }}
          >
            {/* Trial label */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Space Mono', fontSize: '0.62rem', color: '#555' }}>
                Trial {g.trialNumber}
              </span>
              <span style={{ fontFamily: 'Space Mono', fontSize: '0.62rem', color: CONDITION_COLORS[g.condition] ?? '#555' }}>
                {CONDITION_LABELS[g.condition] ?? g.condition}
              </span>
            </div>

            {/* Graph */}
            <SignalGraph
              pacerPts={g.pacerPts}
              beltPts={g.beltPts}
              scoreMs={g.peakErrorMs}
              width={180}
              height={60}
            />
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="px-6 py-3 rounded-xl font-medium"
        style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
      >
        Continue to staircase
      </button>
    </div>
  )
}
