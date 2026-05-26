// ── SynchronyBar.jsx ───────────────────────────────────────────────────────
//
// Fixed bottom-centre sync quality bar. Shows rolling Pearson R of belt
// model against pacer reference. Replaces the BeltSyncRing during BreathBelt
// paced trials — scientific feedback without the visual distraction of the ring.
//
// BeltSyncRing is still available for other contexts (Still Water etc.)
// where aesthetic warmth is more important than precise feedback.
//
// quality: 0–1 Pearson R from useBeltConnection.syncQuality
// Thresholds: good ≥ 0.70 (green), fair ≥ 0.40 (amber), lost < 0.40 (red)

export default function SynchronyBar({ quality, visible = true }) {
  if (!visible) return null

  const pct   = Math.round(quality * 100)
  const color = quality >= 0.70 ? '#2ecc71'
              : quality >= 0.40 ? '#f39c12'
              : '#e74c3c'
  const label = quality >= 0.70 ? 'Good sync'
              : quality >= 0.40 ? 'Fair sync'
              : 'Sync lost'

  return (
    <div
      style={{
        position:       'fixed',
        bottom:         18,
        left:           '50%',
        transform:      'translateX(-50%)',
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        background:     'rgba(20,20,20,0.88)',
        borderRadius:   20,
        padding:        '5px 14px',
        border:         '1px solid #2a2a2a',
        zIndex:         200,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Progress bar */}
      <div style={{ width: 110, height: 7, background: '#2a2a2a', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width:      `${pct}%`,
          height:     '100%',
          background: color,
          transition: 'width 0.5s, background 0.4s',
        }} />
      </div>
      <span style={{ fontSize: '0.68rem', color: '#999', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}
