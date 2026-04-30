import { useEffect } from 'react'

// Render once at the app root. Defines the shared SVG displacement filter,
// injects the aura-pulse keyframes, and drives the seed animation.
export default function AuraFilterDef() {
  useEffect(() => {
    const el = document.querySelector('#aura-filter feTurbulence')
    if (!el) return
    let seed = 1
    const t = setInterval(() => {
      seed = (seed % 100) + 1
      el.setAttribute('seed', seed)
    }, 80)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <style>{`
        @keyframes aura-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.12); }
        }
      `}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="aura-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.040"
                          numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="60"
                               xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </>
  )
}
