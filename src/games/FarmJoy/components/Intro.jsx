export default function Intro({ onStart }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '32px 24px',
      textAlign: 'center', gap: 20,
    }}>
      {/* Soil emoji stand-in until veggie PNGs arrive */}
      <div style={{ fontSize: 64, lineHeight: 1 }}>🌱</div>

      <div>
        <p style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 8 }}>
          RADlab · Farm Joy
        </p>
        <h1 style={{ fontFamily: 'DM Serif Display,serif', fontSize: 30,
          color: '#fff', margin: 0, lineHeight: 1.2 }}>
          What do you want to grow?
        </h1>
      </div>

      <p style={{ fontFamily: 'DM Sans,sans-serif', fontSize: 16, color: 'rgba(255,255,255,0.85)',
        maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
        Pull plants from the field. Each one reveals a value. Keep what feels
        right, compost what doesn't. Narrow down to what you most want to
        cultivate — then harvest.
      </p>

      <button
        onClick={onStart}
        style={{
          marginTop: 8, padding: '14px 40px',
          background: 'var(--pk)', color: '#fff', border: 'none',
          borderRadius: 999, fontSize: 16, fontFamily: 'DM Sans,sans-serif',
          fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em',
        }}
      >
        Visit the farm
      </button>
    </div>
  )
}
