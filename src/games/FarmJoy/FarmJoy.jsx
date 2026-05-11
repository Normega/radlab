import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PHASE, CFG, sampleValues } from './constants.js'
import { assignVeggies, veggieUrl } from './data/veggies.js'
import { saveFarmJoySession } from './hooks/useFarmJoySession.js'
import FarmField      from './components/FarmField.jsx'
import Greenhouse     from './components/Greenhouse.jsx'
import FarmRow        from './components/FarmRow.jsx'
import Intro          from './components/Intro.jsx'
import PullableVeggie from './components/PullableVeggie.jsx'

// SVG viewBox shared by all three background components
const VB_W = 680
const VB_H = 1020

// Coordinate tables — must match background SVG source files
const FIELD_COL_X = [85, 255, 425, 595]
const FIELD_ROW_Y = [85, 255, 425, 595, 765, 935]

// Mound centers matching FarmField.jsx COL_X / ROW_Y (used for PullableVeggie positioning)
const PULL_COL_X = [85, 255, 425, 595]
const PULL_ROW_Y = [135, 305, 475, 645, 815, 985]

// Greenhouse pot centers in SVG space (match Greenhouse.jsx COL_X / ROW_Y)
const GH_COL_X = [113, 340, 567]
const GH_ROW_Y = [370, 690]

// R2: top half is 55% of game height → xMidYMid slice shows SVG y≈229.5..790.5
const GH_TOP_PCT = 55
const GH_VIS_H   = 1020 * GH_TOP_PCT / 100   // 561 SVG units visible vertically
const GH_VIS_TOP = 510 - GH_VIS_H / 2         // 229.5

// Pot soil line (cy=-28 relative to pot center in Greenhouse.jsx defs)
const POT_SOIL_OFFSET = 28

const ghLeft  = col => `${GH_COL_X[col] / VB_W * 100}%`
// Bottom of sprite anchored to soil line (combine with transform: translate(-50%, -100%))
const ghSoilY = row => `${(GH_ROW_Y[row] - POT_SOIL_OFFSET - GH_VIS_TOP) / GH_VIS_H * 100}%`

// FarmRow harvest: mounds at ROW_Y_HARVEST (match FarmRow.jsx)
const FR_ROW_Y = [175, 510, 845]

// FarmRow planting: holes at ROW_Y_PLANTING; hole outer ry=11 → top edge = center - 11
// X=340 always (moundXPositions(1) = [340] = SVG center → 50% of container)
const FR_HOLE_Y        = [275, 610, 945]
const FR_HOLE_TOP_Y    = FR_HOLE_Y.map(y => y - 11)   // [264, 599, 934]
const FR_HOLE_TOP_PCT  = FR_HOLE_TOP_Y.map(y => y / 1020 * 100)

// Harvest: moundXPositions(6) with SIDE_MARGIN=50 → step=116
const HARVEST_COL_X        = [50, 166, 282, 398, 514, 630]
const HARVEST_MOUND_RY     = 13   // FarmRow mound ellipse ry — sprite bottom anchors here

function idxToRowCol(i) { return { row: Math.floor(i / CFG.COLS), col: i % CFG.COLS } }

// ─────────────────────────────────────────────────────────────────────────────

export default function FarmJoy({ session }) {
  const navigate = useNavigate()
  const userId   = session?.user?.id

  // ── Stable session refs ───────────────────────────────────────────────────
  const seedRef               = useRef(Date.now())
  const svRef                 = useRef(null)
  const decisionsRef          = useRef([])
  const feedbackEventsRef     = useRef([])
  const startedAtRef          = useRef(null)
  const sessionStartMs        = useRef(null)
  const selectionsSnapshotRef = useRef(new Set())
  const r2StartMs             = useRef(null)
  const r3StartMs             = useRef(null)
  const ghChoicesRef          = useRef([])
  const finalRef              = useRef([])
  const r1RtMapRef            = useRef({})   // word → pull rt_ms

  // ── Container size (for PullableVeggie px positioning) ────────────────────
  const containerRef  = useRef(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  function bootstrap() {
    const seed = seedRef.current
    const words = sampleValues(seed)
    const vmap  = assignVeggies(words.map(w => w.word), seed + 1)
    svRef.current = words.map((w, i) => {
      const { row, col } = idxToRowCol(i)
      return { ...w, veggie: vmap.get(w.word), row, col }
    })
    decisionsRef.current      = []
    feedbackEventsRef.current = []
  }

  // ── Phase ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState(PHASE.INTRO)

  function startGame() {
    bootstrap()
    startedAtRef.current   = new Date().toISOString()
    sessionStartMs.current = Date.now()
    r1RtMapRef.current     = {}
    setPulledIndices(new Set())
    setSelections(new Set())
    setHarvestTriggered(false)
    setPhase(PHASE.ROUND_1_PULL)
  }

  // ── ALL state declarations up front ───────────────────────────────────────
  const [selections,       setSelections]       = useState(new Set())
  const [pulledIndices,    setPulledIndices]    = useState(new Set())
  const [harvestTriggered, setHarvestTriggered] = useState(false)

  const [planted,  setPlanted]  = useState([])
  const [ghSlots,  setGhSlots]  = useState(Array(CFG.GREENHOUSE_MAX).fill(null))
  const [r3Slots,  setR3Slots]  = useState([null, null, null])

  const [feedbackModal, setFeedbackModal] = useState(null)

  // ── Container ResizeObserver ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    // Immediate read so we don't wait for first ResizeObserver callback
    const { width, height } = el.getBoundingClientRect()
    if (width > 0) setContainerSize({ w: width, h: height })
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect
      setContainerSize({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Round 1 callbacks ─────────────────────────────────────────────────────
  const handleVeggieToggle = useCallback((word) => {
    setSelections(prev => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else                next.add(word)
      return next
    })
  }, [])

  const handlePull = useCallback((word, rtMs) => {
    r1RtMapRef.current[word] = rtMs
    setPulledIndices(prev => {
      const next = new Set(prev)
      next.add(word)
      if (next.size === CFG.SAMPLE_TOTAL) {
        // All pulled — advance to select sub-phase after a brief pause
        setTimeout(() => setPhase(PHASE.ROUND_1_SELECT), 600)
      }
      return next
    })
  }, [])

  const handleHarvest = useCallback(() => {
    const snap = new Set(selections)
    selectionsSnapshotRef.current = snap
    setHarvestTriggered(true)

    setTimeout(() => {
      const rtMap = r1RtMapRef.current
      const all = (svRef.current ?? []).map(v => ({
        ...v,
        round1_choice: snap.has(v.word) ? 'selected' : 'not_selected',
        round1_rt_ms:  rtMap[v.word] ?? null,
      }))
      decisionsRef.current = all

      const selectedList = (svRef.current ?? []).filter(v => snap.has(v.word))
      setPlanted(selectedList)
      setGhSlots(Array(CFG.GREENHOUSE_MAX).fill(null))
      r2StartMs.current = Date.now()
      setPhase(PHASE.ROUND_2_GREENHOUSE)
    }, 1300)
  }, [selections])

  // ── Round 2 confirm ───────────────────────────────────────────────────────
  const handleR2Confirm = useCallback(() => {
    const chosen = ghSlots.filter(Boolean)
    if (chosen.length === 0) return
    if (chosen.length < CFG.GREENHOUSE_MAX) {
      setFeedbackModal({
        round: 2,
        message: 'What values would fill your bowl?',
        onDone: (fb) => {
          if (fb) feedbackEventsRef.current.push(fb)
          setFeedbackModal(null)
          advanceToR3(chosen)
        },
      })
    } else {
      advanceToR3(chosen)
    }
  }, [ghSlots])

  function advanceToR3(chosen) {
    ghChoicesRef.current = chosen
    setR3Slots([null, null, null])
    r3StartMs.current = Date.now()
    setPhase(PHASE.ROUND_3_PLANTING)
  }

  // ── Round 3 confirm ───────────────────────────────────────────────────────
  const handleR3Confirm = useCallback(() => {
    const chosen = r3Slots.filter(Boolean)
    if (chosen.length === 0) return
    if (chosen.length < CFG.FINAL_MAX) {
      setFeedbackModal({
        round: 3,
        message: 'What values would fill your fork?',
        onDone: (fb) => {
          if (fb) feedbackEventsRef.current.push(fb)
          setFeedbackModal(null)
          advanceToHarvest(chosen)
        },
      })
    } else {
      advanceToHarvest(chosen)
    }
  }, [r3Slots])

  function advanceToHarvest(chosen) {
    finalRef.current = chosen
    setPhase(PHASE.HARVEST)
    setTimeout(() => {
      setPhase(PHASE.SESSION_COMPLETE)
      saveSession(chosen)
    }, 3200)
  }

  // ── Supabase save ─────────────────────────────────────────────────────────
  function saveSession(finalValues) {
    saveFarmJoySession({
      userId,
      startedAt:      startedAtRef.current,
      decisions:      decisionsRef.current,
      greenhouse:     ghChoicesRef.current,
      finalValues,
      endedEarly:     false,
      feedbackEvents: feedbackEventsRef.current,
      durationMs:     Date.now() - sessionStartMs.current,
    }).catch(err => console.error('FarmJoy: save failed', err))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100dvh',
      background: '#1a0f02',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1, width: '100%', minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '100%',
          aspectRatio: `${VB_W} / ${VB_H}`,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >

        {phase === PHASE.INTRO && (
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg,#1a3a0a 0%,#2a5c1a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Intro onStart={startGame} />
          </div>
        )}

        {phase === PHASE.ROUND_1_PULL && containerSize.w > 0 && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <FarmField
              className="absolute-fill"
              showStalks={false}
              pulledMounds={new Set((svRef.current ?? [])
                .filter(v => pulledIndices.has(v.word))
                .map(v => `${v.row}-${v.col}`))}
            />
            {(svRef.current ?? []).map((v) => (
              <PullableVeggie
                key={v.word}
                value={v}
                containerW={containerSize.w}
                containerH={containerSize.h}
                svgX={PULL_COL_X[v.col]}
                svgY={PULL_ROW_Y[v.row]}
                alreadyPulled={pulledIndices.has(v.word)}
                onPulled={handlePull}
              />
            ))}
          </div>
        )}

        {phase === PHASE.ROUND_1_SELECT && containerSize.w > 0 && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <FarmField className="absolute-fill" showStalks={false} pulledMounds={new Set()} />
            {(svRef.current ?? []).map((v) => (
              <PullableVeggie
                key={v.word}
                value={v}
                containerW={containerSize.w}
                containerH={containerSize.h}
                svgX={PULL_COL_X[v.col]}
                svgY={PULL_ROW_Y[v.row]}
                alreadyPulled={true}
                selected={selections.has(v.word)}
                onSelectTap={() => !harvestTriggered && handleVeggieToggle(v.word)}
              />
            ))}
          </div>
        )}

        {phase === PHASE.ROUND_2_GREENHOUSE && (
          <GreenhouseRound
            planted={planted}
            ghSlots={ghSlots}
            onSlotsChange={setGhSlots}
            onConfirm={handleR2Confirm}
            containerW={containerSize.w}
            containerH={containerSize.h}
          />
        )}

        {phase === PHASE.ROUND_3_PLANTING && (
          <PlantingRound
            greenhouse={ghChoicesRef.current}
            r3Slots={r3Slots}
            onSlotsChange={setR3Slots}
            onConfirm={handleR3Confirm}
          />
        )}

        {phase === PHASE.HARVEST && (
          <HarvestPhase
            finalValues={finalRef.current}
            containerW={containerSize.w}
            containerH={containerSize.h}
          />
        )}

        {phase === PHASE.SESSION_COMPLETE && (
          <SessionComplete
            finalValues={finalRef.current}
            onDone={() => navigate('/games')}
          />
        )}

        {feedbackModal && (
          <FeedbackOverlay
            message={feedbackModal.message}
            round={feedbackModal.round}
            onDone={feedbackModal.onDone}
          />
        )}
      </div>
      </div>

      {/* R1 pull phase bottom bar */}
      {phase === PHASE.ROUND_1_PULL && (
        <div style={{
          flexShrink: 0, width: '100%', height: 88,
          background: 'rgba(26,15,2,0.96)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          padding: '0 28px', gap: 20,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)', borderRadius: 999,
            padding: '6px 16px', fontFamily: 'Space Mono,monospace',
            fontSize: 13, color: '#fff',
          }}>
            {pulledIndices.size} / {CFG.SAMPLE_TOTAL} pulled
          </div>
        </div>
      )}

      {/* R1 select phase bottom bar */}
      {phase === PHASE.ROUND_1_SELECT && (
        <div style={{
          flexShrink: 0, width: '100%', height: 88,
          background: 'rgba(26,15,2,0.96)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          padding: '0 28px', gap: 20,
        }}>
          <SelectionCounter count={selections.size} required={CFG.ROUND1_REQUIRED_SELECTIONS} />
          <HarvestButton
            enabled={selections.size === CFG.ROUND1_REQUIRED_SELECTIONS && !harvestTriggered}
            onClick={handleHarvest}
          />
        </div>
      )}
    </div>
  )
}

// ─── Shared animation variants ────────────────────────────────────────────────

const POT_V = {
  hidden:  { scale: 0.5, opacity: 0 },
  visible: { scale: 1,   opacity: 1, x: 0 },
  wiggle:  { scale: 1,   opacity: 1, x: [0, -8, 8, -6, 6, -3, 0] },
}

const CARD_V = {
  idle:   { x: 0 },
  wiggle: { x: [0, -7, 7, -5, 5, -3, 3, 0] },
  shake:  { x: [0, -5, 5, -4, 4, -2, 2, 0] },
}

// ─── Round 2: Greenhouse ──────────────────────────────────────────────────────

function GreenhouseRound({ planted, ghSlots, onSlotsChange, onConfirm, containerW = 0, containerH = 0 }) {
  const [wiggleWord, setWiggleWord] = useState(null)
  const [shakeWord,  setShakeWord]  = useState(null)

  // Greenhouse SVG uses xMidYMid slice. On mobile the GH div is taller than the
  // SVG's aspect-ratio would predict, so more of the SVG is visible and the pot
  // positions need to be computed against the actual rendered SVG viewport.
  const ghW        = containerW
  const ghH        = GH_TOP_PCT / 100 * containerH
  const ghSvgScale = ghW > 0 ? Math.max(ghW / 680, ghH / 1020) : 1
  const ghOffsetX  = (ghW - 680  * ghSvgScale) / 2
  const ghOffsetY  = (ghH - 1020 * ghSvgScale) / 2
  const ghPotLeft  = col => ghOffsetX + GH_COL_X[col] * ghSvgScale
  const ghPotTop   = row => ghOffsetY + (GH_ROW_Y[row] - POT_SOIL_OFFSET) * ghSvgScale
  const ghPotW     = ghW > 0 ? 0.18 * 680 * ghSvgScale : undefined

  const handleBottomTap = useCallback((value) => {
    if (wiggleWord) return
    if (ghSlots.some(s => s?.word === value.word)) return

    if (ghSlots.every(s => s !== null)) {
      setShakeWord(value.word)
      setTimeout(() => setShakeWord(null), 360)
      return
    }

    setWiggleWord(value.word)
    setTimeout(() => {
      onSlotsChange(prev => {
        const next     = [...prev]
        const emptyIdx = next.findIndex(s => s === null)
        if (emptyIdx !== -1) next[emptyIdx] = value
        return next
      })
      setWiggleWord(null)
    }, 300)
  }, [wiggleWord, ghSlots, onSlotsChange])

  const handlePotTap = useCallback((slotIdx) => {
    const value = ghSlots[slotIdx]
    if (!value || wiggleWord) return

    setWiggleWord(value.word)
    setTimeout(() => {
      onSlotsChange(prev => {
        const next = [...prev]
        next[slotIdx] = null
        return next
      })
      setWiggleWord(null)
    }, 300)
  }, [wiggleWord, ghSlots, onSlotsChange])

  const potsFilled = ghSlots.filter(Boolean).length

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>

      {/* ── Instruction header ── */}
      <div style={{
        flexShrink: 0,
        padding: '12px 24px 10px',
        textAlign: 'center',
        background: 'rgba(10,20,5,0.72)',
      }}>
        <p style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(13px, 3vw, 17px)',
          color: 'rgba(255,255,255,0.92)',
          margin: 0,
          fontStyle: 'italic',
        }}>
          Only six pots… plant the most important six
        </p>
      </div>

      {/* ── Top 55%: greenhouse pots ── */}
      <div style={{ flex: `0 0 ${GH_TOP_PCT}%`, position: 'relative', overflow: 'hidden' }}>
        <Greenhouse preserveAspectRatio="xMidYMid slice" className="absolute-fill" />

        {ghSlots.map((v, idx) => {
          const row = Math.floor(idx / 3)
          const col = idx % 3
          return (
            // Static outer div owns the positioning transform — Framer Motion
            // overwrites style.transform on motion elements so positioning must
            // live on a plain div, with the motion.div inside for animation only.
            <div
              key={idx}
              style={{
                position:  'absolute',
                left:      ghPotLeft(col),
                top:       ghPotTop(row),
                transform: 'translate(-50%, -100%)',
                width:     ghPotW,
                zIndex:    2,
              }}
            >
              <AnimatePresence>
                {v && (
                  <motion.div
                    key={v.word}
                    variants={POT_V}
                    initial="hidden"
                    animate={wiggleWord === v.word ? 'wiggle' : 'visible'}
                    exit="hidden"
                    transition={wiggleWord === v.word
                      ? { duration: 0.28, ease: 'easeInOut' }
                      : { type: 'spring', damping: 14, stiffness: 280 }}
                    onClick={() => handlePotTap(idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Dance layer — bobs while placed, pauses during wiggle */}
                    <motion.div
                      animate={wiggleWord === v.word
                        ? { y: 0, rotate: 0 }
                        : { y: [0, -6, 0], rotate: [-1.5, 1.5, -1.5] }}
                      transition={wiggleWord === v.word
                        ? { duration: 0.2, ease: 'easeOut' }
                        : { duration: 0.8, repeat: Infinity, repeatDelay: 0.15, ease: 'easeInOut' }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={veggieUrl(v.veggie)} alt={v.word}
                          style={{ width: '100%', display: 'block', objectFit: 'contain' }}
                        />
                        <div style={{
                          position: 'absolute', bottom: 0, left: '50%',
                          transform: 'translateX(-50%)',
                          textAlign: 'center', width: '115%',
                        }}>
                          <span style={wordPillStyle('clamp(9px, 2.4vw, 12px)')}>{v.word}</span>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* ── Bottom: 2×6 card grid ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gridTemplateRows: 'repeat(2, auto)',
        alignContent: 'center',
        gap: '5px',
        padding: '6px 8px 0',
      }}>
        {planted.map(v => {
          const inPot    = ghSlots.some(s => s?.word === v.word)
          const isWiggle = wiggleWord === v.word
          const isShake  = shakeWord  === v.word
          const cardAnim = isWiggle ? 'wiggle' : isShake ? 'shake' : 'idle'

          return (
            <motion.div
              key={v.word}
              variants={CARD_V}
              animate={cardAnim}
              transition={{ duration: 0.28 }}
              onClick={() => !inPot && handleBottomTap(v)}
              style={{
                aspectRatio: 1,
                position: 'relative',
                borderRadius: 7,
                overflow: 'hidden',
                cursor: inPot ? 'default' : 'pointer',
              }}
            >
              {inPot ? (
                <div style={{
                  width: '100%', height: '100%',
                  border: '1.5px dashed rgba(255,255,255,0.25)',
                  borderRadius: 7,
                  background: 'rgba(255,255,255,0.04)',
                }} />
              ) : (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <img
                    src={veggieUrl(v.veggie)} alt={v.word}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center', width: '110%',
                  }}>
                    <span style={wordPillStyle('clamp(9px, 2.2vw, 12px)')}>{v.word}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* ── Confirm strip ── */}
      <div style={{
        flexShrink: 0, padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <button
          onClick={potsFilled > 0 ? onConfirm : undefined}
          style={{
            padding: '10px 32px',
            background: potsFilled > 0 ? 'var(--pk)' : 'rgba(255,255,255,0.12)',
            color: '#fff', border: 'none', borderRadius: 999,
            fontSize: 15, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
            cursor: potsFilled > 0 ? 'pointer' : 'default',
            opacity: potsFilled > 0 ? 1 : 0.45,
            transition: 'background 0.2s, opacity 0.2s',
          }}
        >
          {potsFilled === 0 ? 'Tap veggies to fill your greenhouse' : 'Cultivate'}
        </button>
      </div>
    </div>
  )
}

// ─── Round 3: Planting (side-by-side) ────────────────────────────────────────

function PlantingRound({ greenhouse, r3Slots, onSlotsChange, onConfirm }) {
  const [wiggleWord, setWiggleWord] = useState(null)
  const [shakeWord,  setShakeWord]  = useState(null)

  const placedWords = new Set(r3Slots.filter(Boolean).map(v => v.word))
  const hasAny      = r3Slots.some(Boolean)

  // Tap a card → fill next available row (one-tap, no pick-up state)
  const handleCardTap = useCallback((v) => {
    if (wiggleWord) return
    if (r3Slots.some(s => s?.word === v.word)) return   // already placed

    if (r3Slots.every(s => s !== null)) {
      setShakeWord(v.word)
      setTimeout(() => setShakeWord(null), 360)
      return
    }

    setWiggleWord(v.word)
    setTimeout(() => {
      onSlotsChange(prev => {
        const next     = [...prev]
        const emptyIdx = next.findIndex(s => s === null)
        if (emptyIdx !== -1) next[emptyIdx] = v
        return next
      })
      setWiggleWord(null)
    }, 300)
  }, [wiggleWord, r3Slots, onSlotsChange])

  // Tap a planted row → return veggie to left menu
  const handleRowTap = useCallback((row) => {
    const v = r3Slots[row]
    if (!v || wiggleWord) return

    setWiggleWord(v.word)
    setTimeout(() => {
      onSlotsChange(prev => {
        const next = [...prev]
        next[row] = null
        return next
      })
      setWiggleWord(null)
    }, 300)
  }, [wiggleWord, r3Slots, onSlotsChange])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>

      {/* ── Instruction header ── */}
      <div style={{ flexShrink: 0, padding: '12px 24px 10px', textAlign: 'center', background: 'rgba(10,20,5,0.72)' }}>
        <p style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(13px, 3vw, 17px)', color: 'rgba(255,255,255,0.92)', margin: 0, fontStyle: 'italic' }}>
          Which 3 are the most important to plant?
        </p>
      </div>

      {/* ── Main area: left cards | right rows ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

        {/* Left: 2 cols × 3 rows grid, items centered vertically in each track */}
        <div style={{
          flex: '0 0 50%',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          alignItems: 'center',
          gap: '6px',
          padding: '12px 6px 12px 12px',
          background: '#1a0f02',
        }}>
          {greenhouse.map(v => {
            const placed   = placedWords.has(v.word)
            const isWiggle = wiggleWord === v.word
            const isShake  = shakeWord  === v.word
            const cardAnim = isWiggle ? 'wiggle' : isShake ? 'shake' : 'idle'

            return (
              <motion.div
                key={v.word}
                variants={CARD_V}
                animate={cardAnim}
                transition={{ duration: 0.28 }}
                onClick={() => !placed && handleCardTap(v)}
                style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: placed ? 'default' : 'pointer',
                }}
              >
                {placed ? (
                  <div style={{
                    width: '100%', aspectRatio: 1,
                    border: '1.5px dashed rgba(255,255,255,0.25)',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                  }} />
                ) : (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={veggieUrl(v.veggie)} alt={v.word}
                      style={{ width: '100%', display: 'block', objectFit: 'contain' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, left: '50%',
                      transform: 'translateX(-50%)',
                      textAlign: 'center', width: '110%',
                    }}>
                      <span style={wordPillStyle('clamp(9px, 2.4vw, 12px)')}>{v.word}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Right: FarmRow + click zones + animated overlays */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FarmRow
            cropsPerRow={[1, 1, 1]}
            mode="planting"
            preserveAspectRatio="xMidYMid slice"
            className="absolute-fill"
          />

          {/* Click zones: equal thirds of height */}
          {[0, 1, 2].map(row => (
            <div
              key={row}
              onClick={() => handleRowTap(row)}
              style={{
                position: 'absolute', left: 0, right: 0,
                top:    `${row * 33.333}%`,
                height: '33.333%',
                cursor: 'pointer',
              }}
            />
          ))}

          {/* Planted veggie overlays — static div owns position, motion.div owns animation */}
          {r3Slots.map((v, row) => (
            <div
              key={row}
              style={{
                position:      'absolute',
                left:          '50%',
                top:           `${FR_HOLE_TOP_PCT[row]}%`,
                transform:     'translate(-50%, -100%)',
                width:         '55%',
                pointerEvents: 'none',
                zIndex:        2,
              }}
            >
              <AnimatePresence>
                {v && (
                  <motion.div
                    key={v.word}
                    variants={POT_V}
                    initial="hidden"
                    animate={wiggleWord === v.word ? 'wiggle' : 'visible'}
                    exit="hidden"
                    transition={wiggleWord === v.word
                      ? { duration: 0.28, ease: 'easeInOut' }
                      : { type: 'spring', damping: 14, stiffness: 280 }}
                  >
                    {/* Dance layer — bobs while planted, pauses during wiggle */}
                    <motion.div
                      animate={wiggleWord === v.word
                        ? { y: 0, rotate: 0 }
                        : { y: [0, -6, 0], rotate: [-1.5, 1.5, -1.5] }}
                      transition={wiggleWord === v.word
                        ? { duration: 0.2, ease: 'easeOut' }
                        : { duration: 0.8, repeat: Infinity, repeatDelay: 0.15, ease: 'easeInOut' }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={veggieUrl(v.veggie)} alt={v.word}
                          style={{ width: '100%', display: 'block', objectFit: 'contain' }}
                        />
                        <div style={{
                          position: 'absolute', bottom: 0, left: '50%',
                          transform: 'translateX(-50%)',
                          textAlign: 'center', width: '110%',
                        }}>
                          <span style={wordPillStyle('clamp(9px, 2.4vw, 12px)')}>{v.word}</span>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* ── Confirm strip ── */}
      <div style={{
        flexShrink: 0, padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <button
          onClick={hasAny ? onConfirm : undefined}
          style={{
            padding: '10px 32px',
            background: hasAny ? '#3a8a3a' : 'rgba(255,255,255,0.12)',
            color: '#fff', border: 'none', borderRadius: 999,
            fontSize: 15, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
            cursor: hasAny ? 'pointer' : 'default',
            opacity: hasAny ? 1 : 0.45,
            transition: 'background 0.2s, opacity 0.2s',
          }}
        >
          {hasAny
            ? `Plant these values (${r3Slots.filter(Boolean).length} / ${CFG.FINAL_MAX})`
            : 'Tap a value card to plant it in a row'}
        </button>
      </div>
    </div>
  )
}

// ─── Harvest ──────────────────────────────────────────────────────────────────

function HarvestPhase({ finalValues, containerW = 0, containerH = 0 }) {
  // FarmRow uses xMidYMid meet — same offset correction as Round 1 / PullableVeggie
  const svgScale   = containerW > 0 ? Math.min(containerW / 680, containerH / 1020) : 1
  const svgOffsetX = (containerW - 680  * svgScale) / 2
  const svgOffsetY = (containerH - 1020 * svgScale) / 2
  const toX        = x => svgOffsetX + x * svgScale
  const toY        = y => svgOffsetY + y * svgScale
  const spriteW    = containerW > 0 ? 0.14 * 680 * svgScale : undefined

  const cropsPerRow = [
    finalValues[0] ? 6 : 0,
    finalValues[1] ? 6 : 0,
    finalValues[2] ? 6 : 0,
  ]

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <FarmRow cropsPerRow={cropsPerRow} className="absolute-fill" />

      {/* Veggie sprite on every mound — bottom-anchored, dancing animation */}
      {finalValues.map((v, row) =>
        !v ? null :
        HARVEST_COL_X.map((x, col) => {
          const staggerIdx = row * 6 + col
          return (
            <div
              key={`${row}-${col}`}
              style={{
                position:      'absolute',
                left:          toX(x),
                top:           toY(FR_ROW_Y[row] - HARVEST_MOUND_RY),
                transform:     'translate(-50%, -100%)',
                width:         spriteW,
                pointerEvents: 'none',
              }}
            >
              <motion.div
                animate={{ y: [0, -6, 0], rotate: [-1.5, 1.5, -1.5] }}
                transition={{
                  duration:    0.8,
                  delay:       staggerIdx * 0.055,
                  repeat:      Infinity,
                  repeatDelay: 0.15,
                  ease:        'easeInOut',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={veggieUrl(v.veggie)} alt={v.word}
                    style={{ width: '100%', display: 'block', objectFit: 'contain' }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center', width: '115%',
                  }}>
                    <span style={wordPillStyle('clamp(8px, 1.8vw, 11px)')}>{v.word}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )
        })
      )}

      <div style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 16,
          padding: '24px 36px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'DM Serif Display,serif', fontSize: 24,
            color: '#fff', margin: 0 }}>
            Your harvest is coming in…
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Session complete ─────────────────────────────────────────────────────────

function SessionComplete({ finalValues, onDone }) {
  return (
    <div style={{ position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg,#1a3a0a 0%,#2a5c1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 24px', gap: 24, textAlign: 'center' }}>
      <p style={{ fontFamily: 'DM Serif Display,serif', fontSize: 26,
        color: '#fff', margin: 0 }}>
        Amazing, here's what you have selected as your core values.
      </p>
      <p style={{ fontFamily: 'DM Sans,sans-serif', fontSize: 15,
        color: 'rgba(255,255,255,0.8)', maxWidth: 300, lineHeight: 1.6, margin: 0 }}>
        We hope you can find ways of realizing them today.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {finalValues.map(v => (
          <div key={v.word} style={{ background: 'rgba(255,255,255,0.18)',
            borderRadius: 999, padding: '10px 24px',
            fontFamily: 'DM Sans,sans-serif', fontSize: 18, color: '#fff', fontWeight: 600 }}>
            {v.word}
          </div>
        ))}
      </div>
      <button onClick={onDone} style={S.pkBtn}>Done</button>
    </div>
  )
}

// ─── Underfull feedback overlay ───────────────────────────────────────────────

function FeedbackOverlay({ message, round, onDone }) {
  const [responded, setResponded] = useState(false)
  const [text, setText] = useState('')

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 320,
        textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontFamily: 'DM Serif Display,serif', fontSize: 20,
          color: 'var(--tx)', margin: 0 }}>{message}</p>
        {responded ? <>
          <input maxLength={30} value={text} onChange={e => setText(e.target.value)}
            placeholder="Up to 30 characters"
            style={{ padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--bd)', fontSize: 16,
              fontFamily: 'DM Sans,sans-serif', outline: 'none' }} />
          <button
            onClick={() => onDone({ round, user_responded: true, suggested_value: text || null })}
            style={S.pkBtn}>
            Continue
          </button>
        </> : (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => setResponded(true)} style={S.pkBtn}>Yes</button>
            <button onClick={() => onDone({ round, user_responded: false, suggested_value: null })}
              style={S.ghostBtn}>No thanks</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function wordPillStyle(fontSize) {
  return {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.82)',
    borderRadius: 999,
    padding: '2px 7px',
    fontFamily: 'DM Serif Display, serif',
    fontSize,
    fontWeight: 600,
    color: '#1c1c1e',
    lineHeight: 1.3,
    wordBreak: 'break-word',
    maxWidth: '100%',
  }
}

function SelectionCounter({ count, required }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 999,
      padding: '6px 16px', fontFamily: 'Space Mono,monospace',
      fontSize: 13, color: '#fff', flexShrink: 0 }}>
      {count} / {required} selected
    </div>
  )
}

function HarvestButton({ enabled, onClick }) {
  return (
    <button onClick={enabled ? onClick : undefined} style={{
      padding: '11px 32px',
      background: enabled ? 'var(--pk)' : 'rgba(255,255,255,0.12)',
      color: '#fff', border: 'none', borderRadius: 999,
      fontSize: 16, fontFamily: 'DM Sans,sans-serif', fontWeight: 600,
      cursor: enabled ? 'pointer' : 'default',
      opacity: enabled ? 1 : 0.45,
      transition: 'background 0.2s, opacity 0.2s',
      flexShrink: 0,
    }}>Harvest</button>
  )
}

const S = {
  pkBtn: {
    padding: '12px 32px', background: 'var(--pk)', color: '#fff', border: 'none',
    borderRadius: 999, fontSize: 15, fontFamily: 'DM Sans,sans-serif',
    fontWeight: 600, cursor: 'pointer',
  },
  ghostBtn: {
    padding: '12px 28px', background: 'transparent', color: 'var(--tx2)',
    border: '1.5px solid var(--bd)', borderRadius: 999, fontSize: 15,
    fontFamily: 'DM Sans,sans-serif', fontWeight: 500, cursor: 'pointer',
  },
}
