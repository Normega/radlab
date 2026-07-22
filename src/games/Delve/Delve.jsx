import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import { supabase } from '../../lib/supabase'
import defaultBg from './assets/default-background.jpg'
import {
  DWELL_VELOCITY_PX_S, REVEAL_RADIUS, GROWTH_RATE, DECAY_RATE,
  CELL, DPR_MAX, HAZE_FILTER, HAZE_BG, PARCHMENT,
  PROMPT_IN_MS, PROMPT_OUT_MS,
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
  await supabase.from('game_sessions').update({ ended_at: new Date().toISOString() }).eq('id', sessionId)
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
    <div style={{ maxWidth: 380, textAlign: 'center', padding: '0 16px' }}>
      <p style={S.eyebrow}>RADlab · Come, See</p>
      <h1 style={S.h1}>Delve.</h1>
      <p style={S.sub}>
        An image waits behind haze.<br />
        This is a practice in letting attention settle — not in finding anything.
      </p>

      <div style={S.card}>
        {[
          { n: 1, title: 'Rest, don’t search', body: 'Let your cursor settle somewhere — or rest a finger on the screen. Held still, that spot slowly comes clear.' },
          { n: 2, title: 'Movement reveals nothing', body: 'Quick scanning keeps the haze in place. There is no correct place to look.' },
          { n: 3, title: 'Nothing to complete', body: 'What you’ve seen drifts back to haze after a while. Stay as long as you like — a quiet finish button waits in the corner.' },
        ].map(({ n, title, body }) => (
          <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ background: '#F4E0F0', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#f068a4', fontWeight: 700 }}>{n}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>

      <button style={S.btnPrimary} onClick={onStart}>Begin →</button>
    </div>
  )
}

function SummaryScreen({ summary, onPlay }) {
  const { durationMs, avgDwellMs, episodeCount } = summary
  const dwellLine = avgDwellMs != null
    ? `Your attention settled ${episodeCount === 1 ? 'once' : `${episodeCount} times`}, resting for ${(avgDwellMs / 1000).toFixed(1)}s at a time on average.`
    : 'Movement kept the haze in place this time — nothing wrong with that.'

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
  const [promptOn, setPromptOn] = useState(false)
  const [summary, setSummary]   = useState(null)

  const sessionIdRef  = useRef(null)
  const startedAtRef  = useRef(null)
  const backgroundRef = useRef(null)   // { id, url } picked before Begin
  const bgFailedRef   = useRef(false)  // picked image 404'd → bundled fallback shown
  const engineRef     = useRef(null)   // { collectEpisodes } exposed by the canvas effect
  const stageRef      = useRef(null)
  const canvasRef     = useRef(null)
  const glowRef       = useRef(null)

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

  // Prompt fade in/out
  useEffect(() => {
    if (phase !== 'delve') return
    const t1 = setTimeout(() => setPromptOn(true), PROMPT_IN_MS)
    const t2 = setTimeout(() => setPromptOn(false), PROMPT_OUT_MS)
    return () => { clearTimeout(t1); clearTimeout(t2); setPromptOn(false) }
  }, [phase])

  // ─── Canvas engine — faithful port of dwell_to_reveal_prototype.html ────────
  // Everything per-frame lives in this closure; zero React state in the loop.
  useEffect(() => {
    if (phase !== 'delve') return
    const stage  = stageRef.current
    const canvas = canvasRef.current
    const glow   = glowRef.current
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

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
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
        <div style={{ ...S.prompt, opacity: promptOn ? 0.65 : 0 }}>let your attention rest here</div>
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
    position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)',
    color: PARCHMENT, fontSize: '0.85rem', letterSpacing: '0.14em', textTransform: 'lowercase',
    pointerEvents: 'none', textAlign: 'center', width: '100%',
    textShadow: '0 1px 12px rgba(0,0,0,0.6)',
    transition: REDUCED_MOTION ? 'none' : 'opacity 2.4s ease',
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
