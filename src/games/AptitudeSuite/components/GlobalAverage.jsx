export default function GlobalAverage({ pct1, pct2, pct3 }) {
  const avg = Math.round((pct1 + pct2 + pct3) / 3);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: '3rem',
        lineHeight: 1,
        color: 'var(--tx)',
      }}>
        {avg}
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        color: 'var(--tx2)',
        marginTop: '4px',
      }}>
        better than {avg}% of players overall
      </div>
    </div>
  );
}
