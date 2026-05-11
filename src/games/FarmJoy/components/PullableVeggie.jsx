import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { veggieUrl } from '../data/veggies.js'
import { CFG } from '../constants.js'

const PARTICLES = [
  { size: 24, color: '#C2A47A', tx: -75, ty: -10, delay: 0.00 },
  { size: 30, color: '#B89976', tx:  80, ty: -18, delay: 0.04 },
  { size: 20, color: '#D2B48C', tx: -50, ty: -38, delay: 0.08 },
  { size: 26, color: '#A88863', tx:  60, ty: -42, delay: 0.02 },
  { size: 18, color: '#C2A47A', tx: -90, ty: -25, delay: 0.12 },
  { size: 22, color: '#B89976', tx:  90, ty: -20, delay: 0.06 },
  { size: 28, color: '#D2B48C', tx:   5, ty: -48, delay: 0.10 },
  { size: 16, color: '#A88863', tx: -28, ty: -32, delay: 0.14 },
  { size: 22, color: '#C2A47A', tx:  38, ty: -28, delay: 0.18 },
  { size: 26, color: '#B89976', tx: -60, ty: -15, delay: 0.22 },
]

// Matches VeggieReveal.jsx: sprite bottom anchors 5 SVG units below mound center
// so the base visually overlaps the mound soil
const MOUND_OVERLAP = 5

/**
 * PullableVeggie — a single veggie buried in soil (25% visible above mound).
 *
 * Pull mode (default, alreadyPulled=false):
 *   tap → vibrate 300ms → rise 850ms → pill fades in
 *
 * Select mode (alreadyPulled=true):
 *   renders fully risen immediately; tap calls onSelectTap; selected prop adds ring
 *
 * IMPORTANT: for pill/positioning, all CSS centering (translateX(-50%)) lives on plain
 * div wrappers — never on motion.div — because Framer Motion owns the transform property.
 *
 * Props
 *   value         { word, veggie }
 *   containerW    number  rendered px width  of the 680-unit SVG container
 *   containerH    number  rendered px height of the 1020-unit SVG container
 *   svgX          number  SVG-space x center of mound (matches FarmField COL_X)
 *   svgY          number  SVG-space y center of mound (matches FarmField ROW_Y)
 *   onPulled      (word, rtMs) => void
 *   alreadyPulled bool
 *   selected      bool    show selection ring (select mode)
 *   onSelectTap   () => void
 */
export default function PullableVeggie({
  value,
  containerW,
  containerH,
  svgX,
  svgY,
  onPulled,
  alreadyPulled = false,
  selected      = false,
  onSelectTap,
}) {
  const pullStartRef = useRef(null)
  const [imageH,    setImageH]    = useState(0)
  const [pullPhase, setPullPhase] = useState(alreadyPulled ? 'risen' : 'buried')
  const [dustKey,   setDustKey]   = useState(0)

  const scaleX = containerW / 680
  const scaleY = containerH / 1020

  // Match VeggieReveal: width='19%' of container = 0.19 * containerW
  const imgWidthPx = 0.19 * containerW

  // Sprite bottom anchors at moundTop (matches VeggieReveal's moundTop = svgY + MOUND_OVERLAP)
  const anchorY  = (svgY + MOUND_OVERLAP) * scaleY   // px from container top to sprite bottom
  const leftPx   = svgX * scaleX

  // How far to push the veggie DOWN so only INITIAL_VISIBLE_PCT of imageH is above anchorY
  const buriedY = imageH > 0 ? imageH * (1 - CFG.INITIAL_VISIBLE_PCT) : 0

  const isRisen = pullPhase === 'risen'
  const isDust  = pullPhase === 'rising' || pullPhase === 'risen'

  const handleImageLoad = useCallback((e) => {
    setImageH(e.currentTarget.offsetHeight)
  }, [])

  const handleTap = useCallback(() => {
    if (alreadyPulled) { onSelectTap?.(); return }
    if (pullPhase !== 'buried' || imageH === 0) return

    pullStartRef.current = Date.now()
    setPullPhase('vibrating')
    setDustKey(k => k + 1)

    setTimeout(() => {
      setPullPhase('rising')
      setTimeout(() => {
        setPullPhase('risen')
        onPulled?.(value.word, Date.now() - pullStartRef.current)
      }, CFG.RISE_MS)
    }, CFG.VIBRATE_MS)
  }, [alreadyPulled, pullPhase, imageH, value.word, onPulled, onSelectTap])

  // Framer Motion animate — includes opacity so the element is hidden before image loads.
  // Centering (translateX -50%) lives on the plain clipper div, NOT here.
  const groupAnimate = (() => {
    if (!imageH) return { opacity: 0, x: 0, y: 0 }
    if (pullPhase === 'vibrating') return { opacity: 1, x: [0, -5, 5, -4, 4, -3, 3, 0], y: buriedY }
    if (pullPhase === 'rising' || pullPhase === 'risen') return { opacity: 1, x: 0, y: 0 }
    return { opacity: 1, x: 0, y: buriedY }
  })()

  const groupTransition = (() => {
    if (pullPhase === 'vibrating') return { duration: CFG.VIBRATE_MS / 1000, ease: 'easeInOut' }
    if (pullPhase === 'rising')    return { duration: CFG.RISE_MS / 1000, ease: [0.18, 0.79, 0.32, 1.01] }
    return { duration: 0 }
  })()

  return (
    <>
      {/* ── Clipper ──────────────────────────────────────────────────────────
          Plain div handles centering (translateX -50%). overflow:hidden clips
          the buried portion of the veggie so only the peeking top shows. */}
      <div
        style={{
          position:      'absolute',
          left:          leftPx,
          top:           0,
          width:         imgWidthPx,
          height:        anchorY,
          transform:     'translateX(-50%)',
          overflow:      'hidden',
          pointerEvents: 'none',
          zIndex:        4,
        }}
      >
        {/* motion.div owns y/x animation only — no transform in its style prop */}
        <motion.div
          style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }}
          initial={false}
          animate={groupAnimate}
          transition={groupTransition}
        >
          {/* Selection ring + image */}
          <div style={{
            position:  'relative',
            boxShadow: selected
              ? '0 0 0 3px #f068a4, 0 0 0 5px rgba(240,104,164,0.25)'
              : 'none',
            borderRadius: selected ? 10 : 0,
          }}>
            <img
              src={veggieUrl(value.veggie)}
              alt={value.word}
              onLoad={handleImageLoad}
              style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}
            />
          </div>
        </motion.div>
      </div>

      {/* ── Tap zone ─────────────────────────────────────────────────────────
          Sits above the clipper at the mound level. In select mode covers
          the full risen sprite area so the whole veggie is tappable. */}
      {(pullPhase === 'buried' || alreadyPulled) && imageH > 0 && (
        <div
          onClick={handleTap}
          style={{
            position:  'absolute',
            left:      leftPx,
            top:       pullPhase === 'buried' ? anchorY - 50 : anchorY - imageH,
            width:     imgWidthPx,
            height:    pullPhase === 'buried' ? 70 : imageH,
            transform: 'translateX(-50%)',
            cursor:    'pointer',
            zIndex:    6,
          }}
        />
      )}

      {/* ── Dust puff ────────────────────────────────────────────────────────
          Centered on anchorY (mound level), outside the clipper. */}
      <AnimatePresence>
        {isDust && (
          <div
            key={dustKey}
            style={{
              position:      'absolute',
              left:          leftPx,
              top:           anchorY - 10,
              width:         1,
              height:        1,
              pointerEvents: 'none',
              zIndex:        5,
            }}
          >
            {PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
                animate={{ x: p.tx, y: p.ty, scale: 1.6, opacity: [0, 0.85, 0] }}
                transition={{ duration: CFG.DUST_DURATION_MS / 1000, delay: p.delay, ease: 'easeOut' }}
                style={{
                  position:     'absolute',
                  width:        p.size,
                  height:       p.size,
                  borderRadius: '50%',
                  background:   p.color,
                  top:          -p.size / 2,
                  left:         -p.size / 2,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ── Value pill ───────────────────────────────────────────────────────
          Plain outer div owns centering (translateX -50%) and vertical anchor
          (top: anchorY, translateY(-100%) = pill bottom sits at sprite bottom).
          motion.div inside handles only opacity+y float-up — no transform in style. */}
      <AnimatePresence>
        {isRisen && imageH > 0 && (
          <div
            style={{
              position:      'absolute',
              left:          leftPx,
              top:           anchorY,
              transform:     'translate(-50%, -100%)',
              width:         `${imgWidthPx * 1.05}px`,
              textAlign:     'center',
              pointerEvents: 'none',
              zIndex:        7,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: alreadyPulled ? 0 : 0.4,
                delay:    alreadyPulled ? 0 : CFG.PILL_DELAY_MS / 1000,
                ease:     'easeOut',
              }}
            >
              <span style={{
                display:      'inline-block',
                background:   'rgba(255,255,255,0.82)',
                borderRadius:  999,
                padding:      '2px 7px',
                fontFamily:   'DM Serif Display, serif',
                fontSize:     'clamp(9px, 2.4vw, 12px)',
                fontWeight:    600,
                color:        '#1c1c1e',
                lineHeight:    1.3,
                wordBreak:    'break-word',
                maxWidth:     '100%',
              }}>
                {value.word}
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
