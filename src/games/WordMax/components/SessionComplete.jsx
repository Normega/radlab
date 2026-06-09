import { NUM_SETS } from '../constants';

export default function SessionComplete({ results, totalScore, timedOut, saving, saveError, onPlayAgain }) {
  const setsCompleted = results.filter(r => r.word).length;
  const completed     = setsCompleted === NUM_SETS;

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.icon}>{completed ? '✓' : timedOut ? '⏱' : '✓'}</div>
        <h2 style={S.heading}>
          {timedOut && !completed ? 'Time's up!' : 'Session complete'}
        </h2>
        <p style={S.sub}>
          {completed
            ? 'You completed all 5 sets.'
            : `You completed ${setsCompleted} of ${NUM_SETS} sets.`}
        </p>

        {/* Score summary */}
        <div style={S.scoreRow}>
          <div style={S.metric}>
            <span style={S.metricVal}>{totalScore}</span>
            <span style={S.metricLabel}>Total score</span>
          </div>
          <div style={S.metric}>
            <span style={S.metricVal}>{setsCompleted}</span>
            <span style={S.metricLabel}>Sets done</span>
          </div>
          <div style={S.metric}>
            <span style={S.metricVal}>
              {setsCompleted > 0 ? (totalScore / setsCompleted).toFixed(1) : '—'}
            </span>
            <span style={S.metricLabel}>Avg word length</span>
          </div>
        </div>

        {/* Per-set breakdown */}
        <div style={S.breakdown}>
          {results.map((r, i) => (
            <div key={i} style={S.breakdownRow}>
              <span style={S.bLabel}>Set {i + 1}</span>
              <span style={S.bLetters}>{r.letters.join(' ')}</span>
              <span style={S.bWord}>
                {r.word
                  ? <strong style={{ color: 'var(--pk)' }}>{r.word}</strong>
                  : <span style={{ color: 'var(--tx3)' }}>—</span>}
              </span>
              <span style={S.bPts}>{r.score ? `+${r.score}` : '0'}</span>
            </div>
          ))}
        </div>

        {saving && <p style={S.saving}>Saving…</p>}
        {saveError && <p style={S.err}>{saveError}</p>}

        <button style={S.btn} onClick={onPlayAgain} disabled={saving}>
          Play again
        </button>
      </div>
    </div>
  );
}

const S = {
  wrap:        { display: 'flex', justifyContent: 'center', padding: '40px 16px', minHeight: '100vh', background: 'var(--bg)', alignItems: 'flex-start' },
  card:        { background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: '36px 32px', maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
  icon:        { fontSize: 36 },
  heading:     { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  sub:         { fontSize: 14, color: 'var(--tx2)', margin: 0, fontFamily: '"DM Sans", system-ui, sans-serif' },
  scoreRow:    { display: 'flex', gap: 24, justifyContent: 'center', width: '100%' },
  metric:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  metricVal:   { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 36, color: 'var(--pk)', lineHeight: 1 },
  metricLabel: { fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  breakdown:   { width: '100%', display: 'flex', flexDirection: 'column', gap: 6 },
  breakdownRow:{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'var(--bg)', borderRadius: 8 },
  bLabel:      { fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'var(--tx3)', width: 36, flexShrink: 0 },
  bLetters:    { fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'var(--tx3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  bWord:       { fontFamily: '"Space Mono", monospace', fontSize: 13, minWidth: 80, textAlign: 'right' },
  bPts:        { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--pk)', fontWeight: 700, minWidth: 28, textAlign: 'right' },
  saving:      { fontSize: 13, color: 'var(--tx3)', margin: 0 },
  err:         { fontSize: 13, color: '#dc2626', margin: 0 },
  btn:         { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans", system-ui, sans-serif', width: '100%' },
};
