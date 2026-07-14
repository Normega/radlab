import { useEffect } from 'react'

/**
 * Full-screen dark demo/preview overlay — children render in a 640px column.
 * Shared by TrainingLibrary's module/wrapper demos and SessionDemoModal.
 * Escape or backdrop click closes; content clicks don't propagate.
 */
export default function DemoModal({ title, subtitle = 'Preview only — no data saved', onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      {/* Header bar */}
      <div
        style={{
          width: '100%', maxWidth: 640,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: '#fff', margin: '0 0 2px' }}>
            {title}
          </p>
          <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            {subtitle}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            fontFamily: 'DM Sans', fontSize: 13, color: '#fff',
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Preview content — no participant data, no DB writes */}
      <div
        style={{ width: '100%', maxWidth: 640, flex: 1 }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
