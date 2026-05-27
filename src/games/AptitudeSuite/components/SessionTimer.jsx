export default function SessionTimer({ secondsRemaining }) {
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const urgent  = secondsRemaining <= 60;
  const pulse   = secondsRemaining <= 30;

  return (
    <div style={{
      fontFamily: "'Space Mono', monospace",
      fontSize: '1.5rem',
      fontWeight: '700',
      color: urgent ? 'var(--pk)' : 'var(--tx2)',
      animation: pulse ? 'hub-pulse 1s ease-in-out infinite' : 'none',
      letterSpacing: '0.05em',
    }}>
      {display}
    </div>
  );
}
