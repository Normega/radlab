// Wraps any fixed-size avatar element with the CSS displacement-filter aura.
//
// params — { inset: 1-4, opacity: 0-1 } | null
//   When null the aura div is absent; children always render (no remount on
//   threshold crossings, so imperative RAF loops inside children are preserved).
// color  — CSS color string; use AURA_DEFAULT_COLOR when no custom config.
// size   — px; must match the avatar's own width/height.
export default function SyncAura({ params, color, size = 192, children }) {
  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
    }}>
      {params && (
        <div style={{
          position:     'absolute',
          top:          -params.inset,
          left:         -params.inset,
          right:        -params.inset,
          bottom:       -params.inset,
          background:   color,
          borderRadius: '50%',
          zIndex:       0,
          filter:       'url(#aura-filter) blur(3px)',
          opacity:      params.opacity,
          animation:    'aura-pulse 2.0s ease-in-out infinite',
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
