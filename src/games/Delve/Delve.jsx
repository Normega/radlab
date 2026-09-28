import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import GameIntro from '../shared/GameIntro'
import { supabase } from '../../lib/supabase'
import { dbWrite } from '../../lib/dbWrite'
import defaultBg from './assets/default-background.jpg'
import {
  DWELL_VELOCITY_PX_S, REVEAL_RADIUS, GROWTH_RATE, DECAY_RATE,
  CELL, DPR_MAX, HAZE_FILTER, HAZE_BG, PARCHMENT,
  RING_DIAMETER, RING_OPEN_S, RING_CLOSE_S, CLEAR_AT,
  LINE_HOLD_MS, LINE_GAP_MS, RESTLESS_S, QUESTION_AT_S,
} from './constants'

/* ── SQL (applied 2026-07-22, supabase/migrations/20260722_delve.sql) ─────────

CREATE TABLE delve_backgrounds (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text        NOT NULL,   -- inside public-assets bucket
  title        text        NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE performance
  ADD COLUMN delve_duration_ms   integer,
  ADD COLUMN delve_avg_dwell_ms  float,
  ADD COLUMN delve_background_id uuid REFERENCES delve_backgrounds(id) ON DELETE SET NULL;

──────────────────────────────────────────────────────────────────────────── */

const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const COARSE_INPUT = typeof window !== 'undefined'
  && !!window.matchMedia?.('(pointer: coarse)')?.matches

// Each shown at most once, in response to what the player does (see
// updateGuidance). Lowercase, like the rest of the stage text. Say what to do;
// never a goal.
const LINES = {
  start:    COARSE_INPUT ? 'rest a finger anywhere' : 'let the pointer stop anywhere',
  cleared:  'that’s the picture, underneath. there’s more of it.',
  wander:   'wander wherever you like. nothing to find, nothing to finish.',
  restless: 'let it stop somewhere for a moment',
  q1:       'what arrives first — an edge, a colour, a shape?',
  q2:       'when you move on, what happens to what you left?',
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────

async function startSession(userId) {
  if (!userId) return null
  const { data } = await supabase.from('game_sessions').insert({
    user_id: userId, game_name: 'delve', study_id: null,
    started_at: new Date().toISOString(),
  }).select('id').single()
  return data?.id ?? null
}

// Pick a background: random among active rows, excluding the one this user saw
// in their most recent completed Delve session. Falls back to the bundled
// default (id null) if the table is empty or anything fails.
async function fetchBackground(userId) {
  try {
    const { data: rows } = await supabase
      .from('delve_backgrounds')
      .select('id, storage_path')
      .eq('active', true)
    if (!rows?.length) return { id: null, url: defaultBg }

    let lastId = null
    if (userId) {
      const { data: last } = await supabase
        .from('game_sessions')
        .select('started_at, performance(delve_background_id)')
        .eq('user_id', userId).eq('game_name', 'delve')
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false }).limit(1)
      lastId = last?.[0]?.performance?.[0]?.delve_background_id ?? null
    }

    let pool = rows.filter(r => r.id !== lastId)
    if (!pool.length) pool = rows
    const pick = pool[Math.floor(Math.random() * pool.length)]
    const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(pick.storage_path)
    return { id: pick.id, url: urlData.publicUrl }
  } catch (_) {
    return { id: null, url: defaultBg }
  }
}

async function saveSessionComplete({ sessionId, durationMs, avgDwellMs, backgroundId }) {
  if (!sessionId) return
  await dbWrite(
    supabase.from('game_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select('id'),
    'game_sessions.ended_at', { expectRows: true },
  )
  await supabase.from('performance').insert({
    session_id:          sessionId,
    delve_duration_ms:   durationMs,
    delve_avg_dwell_ms:  avgDwellMs,
    delve_background_id: backgroundId,
  })
  // Deliberately no profiles/points update — Delve is a non-striving practice.
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtDuration(ms) {
  const totalS = Math.round(ms / 1000)
  const m = Math.floor(totalS / 60)
  const s = totalS % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function IntroScreen({ onStart }) {
  return (
    <GameIntro
      title="Delve."
      lead={<>A picture to wander. Wherever you rest, it clears.<br />Nothing to find or finish.</>}
      steps={[
        // Copy matches the senseforaging.com Delve: say what to do, give
        // attention questions with no right answer, and count wandering as data.
        { title: 'Let it rest somewhere', body: 'Settle your cursor on one spot — or rest a finger on the screen. Held still, that spot slowly comes clear. Anywhere counts.' },
        { title: 'Things to notice', body: 'What arrives first — an edge, a colour, a shape? Does the clearing spread outward from your finger, or surface all at once? When you move on, what happens to what you left?' },
        { title: 'Where your eye goes to rest', body: 'When your attention wanders, notice where it lands — that’s worth as much as the dwelling. Stay as long as you like; a quiet finish button waits in the corner.' },
      ]}
      onStart={onStart}
    />
  )
}

function SummaryScreen({ summary, onPlay }) {
  // Dwell time is still recorded (performance.delve_avg_dwell_ms) but never
  // shown: a number on this screen becomes a score by the second session.
  const { durationMs, avgDwellMs } = summary
  const dwellLine = avgDwellMs != null
    ? 'Your attention came to rest here and there, and parts of the image came clear.'
    : 'Your attention kept moving this time — that’s its own way of looking.'

  return (
    <div style={{ maxWidth: 400, textAlign: 'center', padding: '0 16px', width: '100%' }}>
      <p style={S.eyebrow}>Done</p>
      <h1 style={S.h1}>{fmtDuration(durationMs)} of delving</h1>
      <p style={S.sub}>{dwellLine}</p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...S.btnOutline, flex: 1 }} onClick={onPlay}>Again</button>
        <Link to="/games" style={{ ...S.btnPrimary, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Games &rarr;</Link>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Delve({ session }) {
  const [phase, setPhase]       = useState('intro')   // intro | delve | summary
  const [summary, setSummary]   = useState(null)

  const sessionIdRef  = useRef(null)
  const startedAtRef  = useRef(null)
  const backgroundRef = useRef(null)   // { id, url } picked before Begin
  const bgFailedRef   = useRef(false)  // picked image 404'd → bundled fallback shown
  const engineRef     = useRef(null)   // { collectEpisodes } exposed by the canvas effect
  const stageRef      = useRef(null)
  const canvasRef     = useRef(null)
  const glowRef       = useRef(null)
  const ringRef       = useRef(null)
  const lineRef       = useRef(null)

  const userId = session?.user?.id ?? null

  // Pick the session's background up front so the image is ready by Begin
  useEffect(() => {
    let alive = true
    fetchBackground(userId).then(bg => { if (alive) backgroundRef.current = bg })
    return () => { alive = false }
  }, [userId])

  function startGame() {
    bgFailedRef.current = false
    startedAtRef.current = Date.now()
    setSummary(null)
    setPhase('delve')
    startSession(userId).then(id => { sessionIdRef.current = id })
  }

  function finish() {
    const episodes   = engineRef.current?.collectEpisodes() ?? []
    const durationMs = Date.now() - startedAtRef.current
    const avgDwellMs = episodes.length
      ? episodes.reduce((s, d) => s + d, 0) / episodes.length
      : null
    // Record what was actually seen: null when we fell back to the bundled image
    const backgroundId = bgFailedRef.current ? null : (backgroundRef.current?.id ?? null)
    saveSessionComplete({ sessionId: sessionIdRef.current, durationMs, avgDwellMs, backgroundId })
    sessionIdRef.current = null
    setSummary({ durationMs, avgDwellMs, episodeCount: episodes.length })
    setPhase('summary')
  }

  // ─── Canvas engine — faithful port of dwell_to_reveal_prototype.html ────────
  // Everything per-frame lives in this closure; zero React state in the loop.
  useEffect(() => {
    if (phase !== 'delve') return
    const stage  = stageRef.current
    const canvas = canvasRef.current
    const glow   = glowRef.current
    const ring   = ringRef.current
    const lineEl = lineRef.current
    if (!stage || !canvas) return

    const ctx = canvas.getContext('2d')

    // Offscreen buffers
    const sharpCanvas    = document.createElement('canvas')
    const sharpCtx       = sharpCanvas.getContext('2d')
    const hazeCanvas     = document.createElement('canvas')
    const hazeCtx        = hazeCanvas.getContext('2d')
    const maskCanvas     = document.createElement('canvas')
    const maskCtx        = maskCanvas.getContext('2d')
    const revealedCanvas = document.createElement('canvas')
    const revealedCtx    = revealedCanvas.getContext('2d')

    let W = 0, H = 0, DPR = 1
    let cols = 0, rows = 0, revealMap = null
    let imageReady = false

    // Background artwork — picked row's public URL, bundled default on failure
    const baseImage = new Image()
    baseImage.onload = () => { imageReady = true; renderBase() }
    baseImage.onerror = () => {
      if (baseImage.src !== defaultBg) {
        bgFailedRef.current = true
        baseImage.src = defaultBg
      }
    }
    baseImage.src = backgroundRef.current?.url ?? defaultBg

    function renderBase() {
      if (!W || !H) return
      sharpCtx.clearRect(0, 0, W, H)
      if (imageReady) {
        const iw = baseImage.naturalWidth, ih = baseImage.naturalHeight
        const scale = Math.max(W / iw, H / ih)
        const dw = iw * scale, dh = ih * scale
        sharpCtx.drawImage(baseImage, (W - dw) / 2, (H - dh) / 2, dw, dh)
      } else {
        sharpCtx.fillStyle = HAZE_BG
        sharpCtx.fillRect(0, 0, W, H)
      }
      hazeCtx.clearRect(0, 0, W, H)
      hazeCtx.filter = HAZE_FILTER
      hazeCtx.drawImage(sharpCanvas, 0, 0, W, H)
      hazeCtx.filter = 'none'
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, DPR_MAX)
      W = window.innerWidth
      H = window.innerHeight
      ;[canvas, sharpCanvas, hazeCanvas, maskCanvas, revealedCanvas].forEach(c => {
        c.width = Math.round(W * DPR)
        c.height = Math.round(H * DPR)
        c.style.width = W + 'px'
        c.style.height = H + 'px'
      })
      ;[ctx, sharpCtx, hazeCtx, maskCtx, revealedCtx].forEach(c => c.setTransform(DPR, 0, 0, DPR, 0, 0))
      cols = Math.ceil(W / CELL) + 1
      rows = Math.ceil(H / CELL) + 1
      revealMap = new Float32Array(cols * rows)
      renderBase()
    }
    window.addEventListener('resize', resize)
    resize()

    // Pointer / dwell tracking (unified mouse + touch, prototype pattern)
    let pointerActive = false
    let px = W / 2, py = H / 2
    let lastPx = px, lastPy = py, lastT = performance.now()
    let velocity = 0

    function handleMove(e) {
      const rect = stage.getBoundingClientRect()
      px = e.clientX - rect.left
      py = e.clientY - rect.top
      if (glow) {
        glow.style.left = e.clientX + 'px'
        glow.style.top = e.clientY + 'px'
      }
      if (ring) {
        ring.style.left = e.clientX + 'px'
        ring.style.top = e.clientY + 'px'
      }
    }
    function onPointerDown(e) {
      stage.setPointerCapture(e.pointerId)
      pointerActive = true
      handleMove(e)
      if (glow) glow.style.opacity = '1'
    }
    function onPointerMove(e) {
      handleMove(e)
      if (e.pointerType !== 'touch') pointerActive = true
      else if (pointerActive && glow) glow.style.opacity = '1'
    }
    function deactivate() {
      pointerActive = false
      if (glow) glow.style.opacity = '0'
      if (ring) ring.style.opacity = '0'
    }
    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerup', deactivate)
    stage.addEventListener('pointercancel', deactivate)
    stage.addEventListener('pointerleave', deactivate)

    // Dwell episodes — contiguous stretches of (pointerActive && slow)
    let episodeStart = null
    const episodes = []
    function closeEpisode(now) {
      if (episodeStart != null) {
        episodes.push(now - episodeStart)
        episodeStart = null
      }
    }

    // rAF doesn't run while hidden, so close any open episode here
    function onVisibility() {
      if (document.hidden) {
        pointerActive = false
        closeEpisode(performance.now())
        if (glow) glow.style.opacity = '0'
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    engineRef.current = {
      collectEpisodes() {
        closeEpisode(performance.now())
        return [...episodes]
      },
    }

    // Reveal-map → mask
    function buildMask() {
      maskCtx.clearRect(0, 0, W, H)
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const v = revealMap[gy * cols + gx]
          if (v < 0.015) continue
          const cx = gx * CELL
          const cy = gy * CELL
          const r = CELL * 1.9
          const grad = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, r)
          grad.addColorStop(0, `rgba(255,255,255,${v})`)
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          maskCtx.fillStyle = grad
          maskCtx.beginPath()
          maskCtx.arc(cx, cy, r, 0, Math.PI * 2)
          maskCtx.fill()
        }
      }
    }

    // ── Guidance: the stillness ring and the one-time lines ──
    // The ring is the rule made visible: it opens while the pointer is still
    // and closes when it moves, so the player learns that stopping does
    // something before anything has visibly cleared.
    let stillness = 0
    // Lines queue and show one at a time, each at most once. DOM only, no
    // React state, like the glow.
    const said = new Set()
    const queue = []
    let lineUntil = 0, nextLineAt = 0
    function say(key) {
      if (said.has(key)) return
      said.add(key)
      queue.push(LINES[key])
    }
    let elapsed = 0            // s on the stage; dt is capped, so hidden time barely counts
    let restlessS = 0          // pointer active and moving, since the last clearing
    let firstClear = null      // where the first clearing happened
    let clearedHere = false    // this rest has already counted as a clearing
    const startTimer = setTimeout(() => say('start'), 500)

    function updateGuidance(now, dt, dwelling) {
      elapsed += dt

      stillness += dwelling ? dt / RING_OPEN_S : -dt / RING_CLOSE_S
      stillness = Math.max(0, Math.min(1, stillness))
      const gx = Math.min(cols - 1, Math.max(0, Math.round(px / CELL)))
      const gy = Math.min(rows - 1, Math.max(0, Math.round(py / CELL)))
      const vHere = revealMap[gy * cols + gx]
      if (ring) {
        const e = stillness * stillness * (3 - 2 * stillness)   // smoothstep
        // once the patch has cleared, the ring steps back and lets the image be
        const alpha = pointerActive ? (0.18 + 0.4 * e) * (1 - 0.55 * vHere) : 0
        ring.style.opacity = alpha.toFixed(3)
        ring.style.transform = `translate(-50%, -50%) scale(${(0.18 + 0.82 * e).toFixed(3)})`
      }

      if (dwelling && vHere > CLEAR_AT && !clearedHere) {
        clearedHere = true
        restlessS = 0
        if (!firstClear) { firstClear = { x: px, y: py }; say('cleared') }
        else if (Math.hypot(px - firstClear.x, py - firstClear.y) > RING_DIAMETER * 1.5) say('wander')
      }
      if (!dwelling) clearedHere = false
      // judged on the smoothed stillness, not the raw per-frame velocity:
      // a frame with no pointer event reads as "still" even mid-sweep
      if (pointerActive && stillness < 0.35) restlessS += dt
      if (restlessS > RESTLESS_S) say('restless')
      if (elapsed > QUESTION_AT_S[0]) say('q1')
      if (elapsed > QUESTION_AT_S[1]) say('q2')

      if (!lineEl) return
      if (lineUntil && now > lineUntil) {
        lineEl.style.opacity = '0'
        lineUntil = 0
        nextLineAt = now + LINE_GAP_MS
      }
      if (!lineUntil && queue.length && now > nextLineAt) {
        lineEl.textContent = queue.shift()
        lineEl.style.opacity = '0.72'
        lineUntil = now + LINE_HOLD_MS
      }
    }

    let lastFrameT = performance.now()
    let rafId = 0

    function tick(now) {
      const dt = Math.min((now - lastFrameT) / 1000, 0.05)
      lastFrameT = now

      const dx = px - lastPx, dy = py - lastPy
      const dtms = Math.max(now - lastT, 1)
      velocity = (Math.sqrt(dx * dx + dy * dy) / dtms) * 1000
      lastPx = px; lastPy = py; lastT = now

      const dwelling = pointerActive && velocity < DWELL_VELOCITY_PX_S
      if (dwelling && episodeStart == null) episodeStart = now
      else if (!dwelling) closeEpisode(now)

      const pgx = px / CELL, pgy = py / CELL
      const radiusCells = REVEAL_RADIUS / CELL

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const idx = gy * cols + gx
          let v = revealMap[idx]
          if (dwelling) {
            const d = Math.hypot(gx - pgx, gy - pgy)
            if (d < radiusCells) {
              const falloff = 1 - d / radiusCells
              v += GROWTH_RATE * dt * falloff * falloff
            }
          }
          v -= DECAY_RATE * dt
          revealMap[idx] = Math.max(0, Math.min(1, v))
        }
      }

      buildMask()

      revealedCtx.clearRect(0, 0, W, H)
      revealedCtx.drawImage(sharpCanvas, 0, 0, W, H)
      revealedCtx.globalCompositeOperation = 'destination-in'
      revealedCtx.drawImage(maskCanvas, 0, 0, W, H)
      revealedCtx.globalCompositeOperation = 'source-over'

      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(hazeCanvas, 0, 0, W, H)
      ctx.drawImage(revealedCanvas, 0, 0, W, H)

      updateGuidance(now, dt, dwelling)

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(startTimer)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      stage.removeEventListener('pointerdown', onPointerDown)
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerup', deactivate)
      stage.removeEventListener('pointercancel', deactivate)
      stage.removeEventListener('pointerleave', deactivate)
      baseImage.onload = null
      baseImage.onerror = null
      engineRef.current = null
    }
  }, [phase])

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'delve') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: HAZE_BG, zIndex: 50, userSelect: 'none', WebkitUserSelect: 'none' }}>
        {/* Stage owns the pointer listeners; overlays are siblings so taps on
            them never trigger stage pointer capture (prototype structure) */}
        <div ref={stageRef} style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'none' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
        <div ref={lineRef} style={S.prompt} />
        <div ref={ringRef} style={S.ring} />
        <div ref={glowRef} style={S.glow} />
        <button style={S.finishBtn} onClick={finish}>finish</button>
      </div>
    )
  }

  return (
    <div style={{ background: '#FCF0F5', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', userSelect: 'none' }}>
        {phase === 'intro' && <IntroScreen onStart={startGame} />}
        {phase === 'summary' && summary && <SummaryScreen summary={summary} onPlay={() => setPhase('intro')} />}
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  eyebrow:    { fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#abadb0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 },
  h1:         { fontFamily: 'DM Serif Display,serif', fontSize: 28, color: '#1c1c1e', fontWeight: 400, margin: '0 0 8px' },
  sub:        { color: '#888', fontSize: 13, marginBottom: 28, lineHeight: 1.6 },
  card:       { background: 'white', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', marginBottom: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 },
  btnPrimary: { background: '#f068a4', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontFamily: 'DM Sans,sans-serif', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'block', width: '100%' },
  btnOutline: { background: 'white', color: '#f068a4', border: '1.5px solid #f068a4', borderRadius: 12, padding: 11, fontFamily: 'DM Sans,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  prompt: {
    position: 'fixed', bottom: '13%', left: '50%', transform: 'translateX(-50%)',
    opacity: 0, padding: '0 20px', boxSizing: 'border-box', lineHeight: 1.6,
    color: PARCHMENT, fontSize: '0.85rem', letterSpacing: '0.14em', textTransform: 'lowercase',
    pointerEvents: 'none', textAlign: 'center', width: '100%',
    textShadow: '0 1px 12px rgba(0,0,0,0.6)',
    transition: REDUCED_MOTION ? 'none' : 'opacity 2.4s ease',
  },
  ring: {
    position: 'fixed', left: '50%', top: '50%',
    width: RING_DIAMETER, height: RING_DIAMETER, borderRadius: '50%',
    border: '1px solid rgba(240,230,216,0.95)',
    boxShadow: '0 0 14px rgba(0,0,0,0.25), inset 0 0 14px rgba(0,0,0,0.12)',
    transform: 'translate(-50%, -50%) scale(0.18)', pointerEvents: 'none', opacity: 0, zIndex: 4,
  },
  glow: {
    position: 'fixed', width: 14, height: 14, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(240,230,216,0.9) 0%, rgba(240,230,216,0) 70%)',
    transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0,
    transition: REDUCED_MOTION ? 'none' : 'opacity 0.5s ease', zIndex: 5,
  },
  finishBtn: {
    position: 'fixed', bottom: 22, right: 26,
    background: 'transparent', border: 'none', color: PARCHMENT,
    opacity: 0.28, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'lowercase',
    cursor: 'pointer', padding: '8px 10px', fontFamily: 'inherit',
    textShadow: '0 1px 8px rgba(0,0,0,0.6)',
  },
}
