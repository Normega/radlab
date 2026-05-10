import { motion } from 'framer-motion'
import { veggieUrl } from '../data/veggies.js'

// Mound grid positions in SVG space (must match FarmField.jsx)
const COL_X = [85, 255, 425, 595]
const ROW_Y  = [135, 305, 475, 645, 815, 985]
// Sprite bottom anchors slightly below mound top (ry=15) so base overlaps mound
const MOUND_TOP_OFFSET = -5
const VB_W   = 680
const VB_H   = 1020

const pctX = x => `${(x / VB_W) * 100}%`
const pctY = y => `${(y / VB_H) * 100}%`

/**
 * Single veggie sprite positioned directly on the soil field.
 * No card — just the image + a text pill overlaid on the sprite.
 *
 * Reveal: rises from soil after 1000 ms delay (staggered by index).
 * Select: thick pink ring via box-shadow.
 * Harvest: selected veggies pop-bounce; unselected fade + drop.
 *
 * Props:
 *   value     — { word, veggie, row, col }
 *   index     — 0–23 for stagger timing
 *   revealed  — boolean; triggers rise animation when true
 *   selected  — boolean; shows pink selection ring
 *   harvesting — boolean; triggers harvest celebration/exit animation
 *   onTap     — () => void; called on tap (disabled while harvesting)
 */
export default function VeggieReveal({ value, index, revealed, selected, harvesting, onTap }) {
  const x      = COL_X[value.col]
  const y      = ROW_Y[value.row]
  const moundTop = y - MOUND_TOP_OFFSET  // SVG y where sprite bottom anchors

  // ── Animation targets ───────────────────────────────────────────────────
  let animTarget
  let animTransition

  if (harvesting) {
    if (selected) {
      // Pop-bounce celebration
      animTarget = { scale: [1, 1.22, 0.92, 1], y: [0, -11, 3, 0], opacity: 1 }
      animTransition = {
        duration: 0.55,
        delay:    index * 0.045,
        ease:     [0.34, 1.56, 0.64, 1],
      }
    } else {
      // Fade and drop back into soil
      animTarget = { opacity: 0, y: 12, scale: 0.9 }
      animTransition = { duration: 0.55, delay: 0, ease: 'easeIn' }
    }
  } else {
    // Reveal rise from soil
    animTarget = revealed
      ? { y: 0,  opacity: 1, scale: 1 }
      : { y: 38, opacity: 0, scale: 1 }
    animTransition = {
      delay:    revealed ? index * 0.05 : 0,
      duration: 0.42,
      ease:     [0.34, 1.56, 0.64, 1],
    }
  }

  return (
    // Outer wrapper: positions sprite so its bottom edge sits on the mound top (static)
    <div style={{
      position: 'absolute',
      left:      pctX(x),
      top:       pctY(moundTop),
      transform: 'translate(-50%, -100%)',
      width:     '19%',
      zIndex:    selected ? 2 : 1,
    }}>
      {/* Inner motion.div: handles all animation, click, selection ring */}
      <motion.div
        animate={animTarget}
        transition={animTransition}
        onClick={harvesting ? undefined : onTap}
        style={{
          position: 'relative',
          cursor:   harvesting ? 'default' : 'pointer',
          // Pink selection ring via box-shadow (supports border-radius, no extra DOM)
          boxShadow: selected
            ? '0 0 0 3px #f068a4, 0 0 0 5px rgba(240,104,164,0.25)'
            : 'none',
          borderRadius: 10,
        }}
      >
        {/* Veggie sprite — the focal point, fills the cell */}
        {value.veggie
          ? <img
              src={veggieUrl(value.veggie)}
              alt={value.word}
              style={{ width: '100%', display: 'block', objectFit: 'contain' }}
            />
          : <div style={{ width: '100%', paddingBottom: '100%',
              background: 'rgba(255,255,255,0.25)', borderRadius: 8 }} />
        }

        {/* Value word: overlaid at bottom of sprite, white pill behind text only */}
        <div style={{
          position:  'absolute',
          bottom:    0,
          left:      '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          width:     '105%',  // slightly wider than sprite so pill isn't squashed
        }}>
          <span style={{
            display:     'inline-block',
            background:  'rgba(255,255,255,0.82)',
            borderRadius: 999,
            padding:     '2px 7px',
            fontFamily:  'DM Serif Display, serif',
            fontSize:    'clamp(11px, 2.8vw, 15px)',
            fontWeight:  600,
            color:       '#1c1c1e',
            lineHeight:  1.3,
            wordBreak:   'break-word',
            maxWidth:    '100%',
          }}>
            {value.word}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
