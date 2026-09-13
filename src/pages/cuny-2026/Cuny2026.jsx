// CUNY 2026 deck — "Remapping the Mind", imported from the PowerPoint file rather
// than rebuilt. Each click step is a pre-rendered image (see slides.js), so a
// forward press swaps to the next build state: → / Space / click advance one
// click, ← steps back, PageDown/PageUp jump whole slides, N toggles notes.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { SLIDES, GIFS } from './slides'

const BASE = '/cuny-2026/'
const src = (n, k) => `${BASE}s${String(n).padStart(2, '0')}_${k}.webp`

// flat list of every click step across the deck: { slide index, step }
const STEPS = SLIDES.flatMap((s, si) => Array.from({ length: s.steps }, (_, k) => ({ si, k })))

export default function Cuny2026() {
  const [pos, setPos] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const total = STEPS.length

  const go = useCallback(d => setPos(p => Math.min(total - 1, Math.max(0, p + d))), [total])
  const jumpSlide = useCallback(d => setPos(p => {
    const target = STEPS[p].si + d
    if (target < 0) return 0
    if (target >= SLIDES.length) return total - 1
    return STEPS.findIndex(s => s.si === target)
  }), [total])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ')  { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft')               { e.preventDefault(); go(-1) }
      else if (e.key === 'PageDown')                { e.preventDefault(); jumpSlide(1) }
      else if (e.key === 'PageUp')                  { e.preventDefault(); jumpSlide(-1) }
      else if (e.key === 'n' || e.key === 'N')      { setShowNotes(s => !s) }
      else if (e.key === 'Home')                    { setPos(0) }
      else if (e.key === 'End')                     { setPos(total - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jumpSlide, total])

  const { si, k } = STEPS[pos]
  const slide = SLIDES[si]
  const gif = GIFS[slide.n]

  // warm the cache for the next few steps so a click never shows a blank frame
  const upcoming = useMemo(() => STEPS.slice(pos + 1, pos + 4), [pos])
  useEffect(() => {
    upcoming.forEach(s => { new Image().src = src(SLIDES[s.si].n, s.k) })
  }, [upcoming])

  return (
    <div style={K.stage} onClick={() => go(1)}>
      <div style={K.frame}>
        <img src={src(slide.n, k)} alt={`Slide ${slide.n}`} style={K.img} draggable={false} />
        {gif && (
          <img src={BASE + gif.src} alt="" draggable={false} style={{
            ...K.overlay,
            left: `${gif.left * 100}%`, top: `${gif.top * 100}%`,
            width: `${gif.width * 100}%`, height: `${gif.height * 100}%`,
          }} />
        )}
      </div>

      <div style={K.bottom} onClick={e => e.stopPropagation()}>
        <button onClick={() => go(-1)} style={{ ...K.navArrow, visibility: pos === 0 ? 'hidden' : 'visible' }} aria-label="Previous">‹</button>
        <span style={K.counter}>{slide.n} / {SLIDES.length}</span>
        <button onClick={() => go(1)} style={{ ...K.navArrow, visibility: pos === total - 1 ? 'hidden' : 'visible' }} aria-label="Next">›</button>
        {slide.notes && (
          <button onClick={() => setShowNotes(s => !s)} style={{ ...K.notesBtn, ...(showNotes ? K.notesOn : {}) }} title="Speaker notes (N)">Notes</button>
        )}
      </div>

      {showNotes && slide.notes && (
        <div style={K.noteOverlay} onClick={e => e.stopPropagation()}>
          {slide.notes.map((p, i) => <p key={i} style={K.noteP}>{p}</p>)}
        </div>
      )}
    </div>
  )
}

const K = {
  stage: { position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', overflow: 'hidden' },
  frame: { position: 'relative', width: 'min(100vw, calc(100vh * 16 / 9))', aspectRatio: '16 / 9' },
  img: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' },
  overlay: { position: 'absolute', display: 'block', objectFit: 'fill' },
  bottom: { position: 'fixed', bottom: 10, right: 14, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.35, fontFamily: '"Space Mono",monospace', color: '#fff', fontSize: 13 },
  navArrow: { background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '0 6px', lineHeight: 1 },
  counter: { minWidth: 52, textAlign: 'center' },
  notesBtn: { marginLeft: 8, background: 'none', border: '1px solid #fff6', color: '#fff', borderRadius: 999, padding: '2px 10px', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' },
  notesOn: { background: '#fff', color: '#000' },
  noteOverlay: { position: 'fixed', left: '50%', bottom: 44, transform: 'translateX(-50%)', width: 'min(860px, 92vw)', maxHeight: '40vh', overflowY: 'auto', background: 'rgba(20,20,24,0.94)', color: '#eee', borderRadius: 12, padding: '14px 20px', fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 15, lineHeight: 1.5, cursor: 'default' },
  noteP: { margin: '0 0 6px' },
}
