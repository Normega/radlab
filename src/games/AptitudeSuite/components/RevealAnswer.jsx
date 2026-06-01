export default function RevealAnswer({ word, solved }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(252,240,245,0.96)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '12px',
      zIndex: 10,
    }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        color: solved ? 'var(--pk)' : 'var(--tx2)',
        marginBottom: '8px',
      }}>
        {solved ? 'Correct! The word was' : 'The answer was'}
      </div>
      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: '2.5rem',
        color: 'var(--tx)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {word}.
      </div>
    </div>
  );
}
