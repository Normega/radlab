import PercentileGauge from './PercentileGauge';
import GlobalAverage from './GlobalAverage';

export default function SessionComplete({
  anagramScore, anagramPct,
  fluencyScore, fluencyPct, categoryLabel,
  wordprobeScore, wordprobePct,
  taskSwitchCount,
  submitted,
}) {
  const avg = Math.round((anagramPct + fluencyPct + wordprobePct) / 3);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <h1 style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: '2.25rem',
        color: 'var(--tx)',
        marginBottom: '0.25rem',
        textAlign: 'center',
      }}>
        Session Complete
      </h1>
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '15px',
        color: 'var(--tx2)',
        marginBottom: '2rem',
        textAlign: 'center',
      }}>
        Your results have been saved.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <GlobalAverage pct1={anagramPct} pct2={fluencyPct} pct3={wordprobePct} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '680px',
        marginBottom: '2rem',
      }}>
        {[
          { label: 'Unscramble', score: anagramScore, pct: anagramPct, unit: 'words' },
          { label: `Word Storm (${categoryLabel})`, score: fluencyScore, pct: fluencyPct, unit: 'words' },
          { label: 'Word Probe', score: wordprobeScore, pct: wordprobePct, unit: 'pts' },
        ].map(({ label, score, pct, unit }) => (
          <div key={label} style={{
            background: 'var(--bgc)',
            border: '1px solid var(--bd)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <PercentileGauge value={pct} size={100} />
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--tx)',
            }}>
              {score} <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>{unit}</span>
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              color: 'var(--tx2)',
              textAlign: 'center',
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {submitted && (
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: 'var(--tx3)',
        }}>
          Saving…
        </p>
      )}
    </div>
  );
}
