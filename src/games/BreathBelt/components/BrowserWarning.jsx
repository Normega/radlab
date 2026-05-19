// Shows a gate screen when Web Bluetooth is unavailable (non-Chrome/Edge).

export default function BrowserWarning() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-8"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="bg-white rounded-2xl p-10 max-w-md w-full text-center"
        style={{ border: '1px solid var(--bd)' }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌐</div>
        <h2
          className="mb-3"
          style={{ fontFamily: 'DM Serif Display', fontSize: 24, color: 'var(--tx)' }}
        >
          Chrome or Edge required
        </h2>
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', marginBottom: 16 }}>
          The Polar H10 belt uses the Web Bluetooth API, which only runs in Chrome and Edge.
          Please reopen this page in one of those browsers.
        </p>
        <p style={{ color: 'var(--tx3)', fontSize: 'var(--fs-body-sm)', fontFamily: 'Space Mono' }}>
          {navigator.userAgent}
        </p>
      </div>
    </div>
  );
}
