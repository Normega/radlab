import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DEMO_SECS, isDemoMode } from '../../lib/demoMode'
import { COLORS, W, H, drawPage } from './drawings'
import './ColorMax.css'

// ── Constants ──────────────────────────────────────────────────────────────
const PAGE_NAMES    = ['Duck', 'House', 'Butterfly', 'Apple', 'Sunflower']
const TOTAL_SECS    = 300
const BRUSH         = { thin: 4, thick: 20, eraser: 16 }
const ATTEMPT_THRESH = 0.05
const REF_RGB       = [[226,75,74],[239,159,39],[234,199,0],[99,153,34],[55,138,221],[127,119,221]]

// ── Scoring helpers (verbatim from reference, validated) ───────────────────
function refNum(r, g, b, a) {
  if (a < 128) return 0
  for (let i = 0; i < 6; i++) {
    const d = REF_RGB[i]
    if (Math.abs(r - d[0]) < 20 && Math.abs(g - d[1]) < 20 && Math.abs(b - d[2]) < 20) return i + 1
  }
  return 0
}

function closestNum(r, g, b) {
  let best = 0, bestD = Infinity
  for (let i = 0; i < 6; i++) {
    const d   = REF_RGB[i]
    const dist = Math.abs(r - d[0]) + Math.abs(g - d[1]) + Math.abs(b - d[2])
    if (dist < bestD) { bestD = dist; best = i + 1 }
  }
  return best
}

function calcScores(pagePaint, refPixel) {
  return Array(5).fill(0).map((_, i) => {
    if (!refPixel[i]) return { cov: 0, perf: 0 }

    let pd
    if (pagePaint[i]) {
      pd = pagePaint[i].getContext('2d').getImageData(0, 0, W, H).data
    } else {
      pd = new Uint8ClampedArray(W * H * 4)
    }
    const rd   = refPixel[i].data
    const rpc  = new Array(7).fill(0)
    const rpp  = new Array(7).fill(0)
    let correct = 0, outside = 0

    for (let p = 0; p < W * H; p++) {
      const ri = p * 4
      const cn = refNum(rd[ri], rd[ri + 1], rd[ri + 2], rd[ri + 3])
      if (cn > 0) rpc[cn]++
      if (pd[ri + 3] > 127) {
        const pn = closestNum(pd[ri], pd[ri + 1], pd[ri + 2])
        if (cn === 0) outside++
        else { rpp[cn]++; if (cn === pn) correct++ }
      }
    }

    let tot = 0
    for (let c = 1; c <= 6; c++) tot += rpc[c]
    const cov = tot > 0 ? Math.max(0, correct - outside) / tot * 100 : 0

    let atC = 0, atT = 0
    for (let c = 1; c <= 6; c++) {
      if (rpc[c] > 0 && rpp[c] / rpc[c] >= ATTEMPT_THRESH) {
        atT += rpc[c]
        for (let p = 0; p < W * H; p++) {
          const ri = p * 4
          if (
            refNum(rd[ri], rd[ri + 1], rd[ri + 2], rd[ri + 3]) === c &&
            pd[ri + 3] > 127 &&
            closestNum(pd[ri], pd[ri + 1], pd[ri + 2]) === c
          ) atC++
        }
      }
    }

    return {
      cov:  Math.round(cov * 10) / 10,
      perf: atT > 0 ? Math.round(atC / atT * 1000) / 10 : 0,
    }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────
function mmss(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

// ── ColorMax ───────────────────────────────────────────────────────────────
export default function ColorMax({ session, studyMode = false, userId: userIdProp = null, onSessionComplete = null, supabaseClient: supabaseClientProp = null }) {
  const db = supabaseClientProp ?? supabase
  // Admin quick-demo (?demo=1) shortens the session; never honored in studies
  const totalSecs = !studyMode && isDemoMode() ? DEMO_SECS : TOTAL_SECS
  // ── React state (drives re-renders) ─────────────────────────────────────
  const [phase,    setPhase]    = useState('start')   // 'start' | 'active' | 'complete'
  const [secsLeft, setSecsLeft] = useState(totalSecs)
  const [tool,     setToolSt]   = useState('thin')
  const [colorIdx, setColIdxSt] = useState(0)
  const [page,     setPageSt]   = useState(0)
  const [saving,   setSaving]   = useState(false)
  const [starting, setStarting] = useState(false)

  // ── Refs mirroring mutable state (for use inside event handlers) ─────────
  const toolRef    = useRef('thin')
  const colIdxRef  = useRef(0)
  const pageRef    = useRef(0)

  // ── Canvas DOM refs ──────────────────────────────────────────────────────
  const bgRef    = useRef(null)
  const paintRef = useRef(null)

  // ── Per-page data ────────────────────────────────────────────────────────
  const pagePaintRef = useRef(Array(5).fill(null))  // offscreen canvases per page
  const refPixelRef  = useRef(Array(5).fill(null))  // ImageData per page (for scoring)
  const loadedPageRef = useRef(0)                   // page currently drawn on canvas

  // ── Brush state ──────────────────────────────────────────────────────────
  const painting = useRef(false)
  const lx       = useRef(0)
  const ly       = useRef(0)

  // ── Tool time tracking ───────────────────────────────────────────────────
  const toolTimeRef     = useRef({ thin: 0, thick: 0, eraser: 0 })
  const toolTimeByPgRef = useRef(Array(5).fill(0).map(() => ({ thin: 0, thick: 0, eraser: 0 })))
  const downT    = useRef(null)
  const downTool = useRef(null)
  const downPage = useRef(null)

  // ── Session / DB ─────────────────────────────────────────────────────────
  const sessionIdRef    = useRef(null)
  const sessionStartRef = useRef(null)
  const timerRef        = useRef(null)
  const secsLeftRef     = useRef(totalSecs)

  // ── Batched stroke events ────────────────────────────────────────────────
  const pendingStrokesRef = useRef([])

  // ── Results (populated before phase='complete') ──────────────────────────
  const resultsRef = useRef(null)

  // ── Game functions ────────────────────────────────────────────────────────

  function pressStart() {
    downT.current    = performance.now()
    downTool.current = toolRef.current
    downPage.current = pageRef.current
  }

  function pressEnd() {
    if (downT.current == null) return
    const dt = performance.now() - downT.current
    const t  = downTool.current
    const pg = downPage.current
    toolTimeRef.current[t]         += dt
    toolTimeByPgRef.current[pg][t] += dt
    if (sessionIdRef.current) {
      const elapsed_ms = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0
      pendingStrokesRef.current.push({
        session_id: sessionIdRef.current,
        task:       'color_max',
        event_type: 'stroke_end',
        value: JSON.stringify({
          page: pg,
          tool: t,
          color: t === 'eraser' ? null : colIdxRef.current + 1,
          duration_ms: Math.round(dt),
        }),
        elapsed_ms,
      })
    }
    downT.current = null
  }

  function savePaint(i) {
    const pc = paintRef.current
    if (!pc) return
    if (!pagePaintRef.current[i]) {
      const oc = document.createElement('canvas')
      oc.width = W; oc.height = H
      pagePaintRef.current[i] = oc
    }
    const ctx = pagePaintRef.current[i].getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(pc, 0, 0)
  }

  function loadPage(i) {
    const bg = bgRef.current
    const pc = paintRef.current
    if (!bg || !pc) return

    bg.width = W; bg.height = H
    drawPage(bg.getContext('2d'), i, false)

    pc.width = W; pc.height = H
    const pCtx = pc.getContext('2d')
    pCtx.clearRect(0, 0, W, H)
    if (pagePaintRef.current[i]) pCtx.drawImage(pagePaintRef.current[i], 0, 0)

    loadedPageRef.current = i
  }

  function applyBrush(fn) {
    const pc = paintRef.current
    if (!pc) return
    const ctx = pc.getContext('2d')
    const t   = toolRef.current
    const sz  = t === 'eraser' ? BRUSH.eraser : t === 'thick' ? BRUSH.thick : BRUSH.thin
    ctx.save()
    ctx.globalCompositeOperation = t === 'eraser' ? 'destination-out' : 'source-over'
    const col = t === 'eraser' ? 'rgba(0,0,0,1)' : COLORS[colIdxRef.current].hex
    fn(ctx, sz, col)
    ctx.restore()
  }

  function dab(x, y) {
    applyBrush((ctx, sz, col) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(x, y, sz / 2, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  function seg(x1, y1, x2, y2) {
    applyBrush((ctx, sz, col) => {
      ctx.strokeStyle = col
      ctx.lineWidth   = sz
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    })
  }

  function setTool(t) {
    toolRef.current = t
    setToolSt(t)
    logEvent('tool_select', t)
  }

  function pickColor(i) {
    colIdxRef.current = i
    setColIdxSt(i)
    if (toolRef.current === 'eraser') {
      toolRef.current = 'thin'
      setToolSt('thin')
    }
    logEvent('color_select', String(i + 1))
  }

  function goPage(i) {
    if (i === pageRef.current) return
    logEvent('page_switch', JSON.stringify({ from: pageRef.current, to: i }))
    flushStrokes()
    savePaint(loadedPageRef.current)
    pageRef.current = i
    setPageSt(i)
    // loadPage(i) fires via useEffect watching [phase, page]
  }

  // ── DB helpers ────────────────────────────────────────────────────────────

  function logEvent(eventType, value = null) {
    if (!sessionIdRef.current) return
    const elapsed_ms = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0
    db.from('aptitude_events').insert({
      session_id: sessionIdRef.current,
      task:       'color_max',
      event_type: eventType,
      value,
      elapsed_ms,
    }).then(({ error }) => { if (error) console.warn('aptitude_events insert failed', error) })
  }

  function flushStrokes() {
    const batch = pendingStrokesRef.current.splice(0)
    if (!batch.length) return Promise.resolve()
    return db.from('aptitude_events').insert(batch).then(({ error }) => {
      if (error) console.warn('stroke batch insert failed', error)
    })
  }

  // ── Game lifecycle ────────────────────────────────────────────────────────

  async function handleStart() {
    setStarting(true)
    const uid = userIdProp ?? session?.user?.id ?? null
    const now = new Date().toISOString()
    sessionStartRef.current = Date.now()

    const { data, error } = await db
      .from('aptitude_sessions')
      .insert({ user_id: uid, game: 'color_max', session_start: now })
      .select('id')
      .single()
    if (error) console.warn('aptitude_sessions insert failed', error)
    else sessionIdRef.current = data.id

    // Start countdown
    secsLeftRef.current = totalSecs
    timerRef.current = setInterval(() => {
      secsLeftRef.current -= 1
      setSecsLeft(secsLeftRef.current)
      if (secsLeftRef.current <= 0) {
        clearInterval(timerRef.current)
        handleEnd()
      }
    }, 1000)

    logEvent('session_start')
    setStarting(false)
    setPhase('active')
    // Pre-render + loadPage fire via useEffect after render
  }

  async function handleEnd() {
    clearInterval(timerRef.current)

    // Finalize any in-progress stroke
    if (painting.current) pressEnd()
    painting.current = false

    // Save what's currently on the paint canvas
    savePaint(loadedPageRef.current)

    setSaving(true)

    const scores = calcScores(pagePaintRef.current, refPixelRef.current)

    const playedSecs = sessionStartRef.current
      ? Math.round((Date.now() - sessionStartRef.current) / 1000)
      : totalSecs

    const pfScores       = scores.filter(r => r.perf > 0)
    const avgCoverage    = +(scores.reduce((a, r) => a + r.cov, 0) / 5).toFixed(1)
    const avgPrecision   = pfScores.length > 0
      ? +(pfScores.reduce((a, r) => a + r.perf, 0) / pfScores.length).toFixed(1)
      : 0
    const imagesAttempted = scores.filter(r => r.cov > 0).length

    const results = {
      scores,
      avgCoverage,
      avgPrecision,
      imagesAttempted,
      toolTime:       { ...toolTimeRef.current },
      toolTimeByPage: toolTimeByPgRef.current.map(t => ({ ...t })),
      totalSecs: playedSecs,
    }
    resultsRef.current = results

    await flushStrokes()
    logEvent('game_end', JSON.stringify({ imagesAttempted, avgCoverage }))

    if (sessionIdRef.current) {
      const { error } = await db
        .from('aptitude_sessions')
        .update({ session_end: new Date().toISOString(), results })
        .eq('id', sessionIdRef.current)
      if (error) console.warn('aptitude_sessions update failed', error)
    }

    setSaving(false)
    setPhase('complete')
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  // Pre-render all 5 reference canvases to offscreen ImageData when game goes active.
  // These are used by calcScores; they never appear in the DOM.
  useEffect(() => {
    if (phase !== 'active') return
    for (let i = 0; i < 5; i++) {
      const oc = document.createElement('canvas')
      oc.width = W; oc.height = H
      const ctx = oc.getContext('2d')
      drawPage(ctx, i, true)
      refPixelRef.current[i] = ctx.getImageData(0, 0, W, H)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load page whenever the active page changes.
  useEffect(() => {
    if (phase !== 'active') return
    loadPage(pageRef.current)
  }, [phase, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Attach brush event handlers to the paint canvas once when game goes active.
  // Handlers only reference refs so stale closures are safe.
  useEffect(() => {
    if (phase !== 'active') return
    const canvas = paintRef.current
    if (!canvas) return

    const getPos  = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
    const getTPos = e => { const r = canvas.getBoundingClientRect(); return [e.touches[0].clientX - r.left, e.touches[0].clientY - r.top] }

    const onDown   = e => { painting.current = true; pressStart(); const [x, y] = getPos(e);  lx.current = x; ly.current = y; dab(x, y) }
    const onMove   = e => { if (!painting.current) return; const [x, y] = getPos(e);  seg(lx.current, ly.current, x, y); lx.current = x; ly.current = y }
    const onUp     = () => { if (painting.current) pressEnd(); painting.current = false }
    const onTStart = e => { e.preventDefault(); painting.current = true; pressStart(); const [x, y] = getTPos(e); lx.current = x; ly.current = y; dab(x, y) }
    const onTMove  = e => { e.preventDefault(); if (!painting.current) return; const [x, y] = getTPos(e); seg(lx.current, ly.current, x, y); lx.current = x; ly.current = y }
    const onTEnd   = () => { if (painting.current) pressEnd(); painting.current = false }

    canvas.addEventListener('mousedown',  onDown)
    canvas.addEventListener('mousemove',  onMove)
    canvas.addEventListener('mouseup',    onUp)
    canvas.addEventListener('mouseleave', onUp)
    canvas.addEventListener('touchstart', onTStart, { passive: false })
    canvas.addEventListener('touchmove',  onTMove,  { passive: false })
    canvas.addEventListener('touchend',   onTEnd)

    return () => {
      canvas.removeEventListener('mousedown',  onDown)
      canvas.removeEventListener('mousemove',  onMove)
      canvas.removeEventListener('mouseup',    onUp)
      canvas.removeEventListener('mouseleave', onUp)
      canvas.removeEventListener('touchstart', onTStart)
      canvas.removeEventListener('touchmove',  onTMove)
      canvas.removeEventListener('touchend',   onTEnd)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="cm-wrap">
      <div className="cm-card">
        {saving && (
          <div className="cm-saving-overlay">
            <span className="cm-saving-text">Saving…</span>
          </div>
        )}

        {/* ── Start screen ── */}
        {phase === 'start' && (
          <div className="cm-start">
            <h1 className="cm-start-title">ColorMax</h1>
            <p className="cm-start-sub">A paint by numbers activity! 5 images, 5 minutes. Color each region using the matching number — switch between images any time! The final reveal is entirely in your hands. A detail brush, heavy-fill brush, and a precision eraser will be available to you, and you will be scored on completeness and precision.</p>
            <button
              className="cm-start-btn"
              disabled={starting}
              onClick={handleStart}
            >
              {starting ? 'Starting…' : `Start — ${mmss(totalSecs)}`}
            </button>
          </div>
        )}

        {/* ── Active game ── */}
        {phase === 'active' && (
          <>
            <div className="cm-header">
              <span className={`cm-timer${secsLeft <= 60 ? ' warn' : ''}`}>
                {mmss(secsLeft)}
              </span>
              <div className="cm-tabs">
                {PAGE_NAMES.map((name, i) => (
                  <div
                    key={i}
                    className={`cm-tab${page === i ? ' active' : ''}`}
                    onClick={() => goPage(i)}
                  >
                    {name}
                  </div>
                ))}
              </div>
              <span className="cm-game-label">colormax</span>
            </div>

            <div className="cm-body">
              <div className="cm-toolbar">
                {/* Tool buttons */}
                <button
                  className={`cm-tool-btn${tool === 'thin' ? ' active' : ''}`}
                  onClick={() => setTool('thin')}
                  title="Thin brush"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="2" fill="currentColor" />
                    <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" />
                  </svg>
                  <span>thin</span>
                </button>
                <button
                  className={`cm-tool-btn${tool === 'thick' ? ' active' : ''}`}
                  onClick={() => setTool('thick')}
                  title="Thick brush"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="4" fill="currentColor" />
                  </svg>
                  <span>thick</span>
                </button>
                <button
                  className={`cm-tool-btn${tool === 'eraser' ? ' active' : ''}`}
                  onClick={() => setTool('eraser')}
                  title="Eraser"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="5" width="12" height="7" rx="1.5" fill="currentColor" opacity="0.35" />
                    <rect x="6" y="5" width="7" height="7" rx="1" fill="currentColor" />
                  </svg>
                  <span>erase</span>
                </button>

                <div className="cm-toolbar-divider" />

                {/* Color swatches */}
                {COLORS.map((c, i) => (
                  <div
                    key={i}
                    className={`cm-swatch${colorIdx === i ? ' active' : ''}`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => pickColor(i)}
                    title={c.name}
                  >
                    {c.n}
                  </div>
                ))}
              </div>

              <div className="cm-canvas-area">
                <div className="cm-canvas-wrap">
                  <canvas ref={bgRef}    className="cm-bg-canvas"    width={W} height={H} />
                  <canvas ref={paintRef} className="cm-paint-canvas" width={W} height={H} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Results screen ── */}
        {phase === 'complete' && resultsRef.current && (() => {
          const r = resultsRef.current
          return (
            <div className="cm-results">
              <h1 className="cm-results-title">ColorMax</h1>
              <p className="cm-results-sub">{mmss(r.totalSecs)} played</p>

              <div className="cm-overall-title">Overall Score</div>
              <div className="cm-stats">
                <div className="cm-stat">
                  <div className="cm-stat-val">{r.avgCoverage}%</div>
                  <div className="cm-stat-lbl">Coverage</div>
                </div>
                <div className="cm-stat">
                  <div className="cm-stat-val">{r.avgPrecision}%</div>
                  <div className="cm-stat-lbl">Precision</div>
                </div>
                <div className="cm-stat">
                  <div className="cm-stat-val">{r.imagesAttempted}/5</div>
                  <div className="cm-stat-lbl">Images</div>
                </div>
              </div>

              <div className="cm-breakdown-header">
                <span className="cm-breakdown-section-title">Per image</span>
                <span className="cm-breakdown-cols-label">Coverage / Precision</span>
              </div>
              <div className="cm-breakdown">
                {PAGE_NAMES.map((name, i) => {
                  const sc = r.scores[i]
                  return (
                    <div key={i} className="cm-breakdown-row">
                      <span className="cm-breakdown-name">{name}</span>
                      <div className="cm-bar-track">
                        <div
                          className={`cm-bar-fill${sc.cov === 0 ? ' zero' : ''}`}
                          style={{ width: `${Math.min(100, sc.cov)}%` }}
                        />
                      </div>
                      <span className="cm-breakdown-vals">
                        {sc.cov}% / {sc.perf > 0 ? `${sc.perf}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {onSessionComplete && (
                <button className="cm-start-btn" onClick={() => onSessionComplete({ avg_coverage: r.avgCoverage, avg_precision: r.avgPrecision, images_attempted: r.imagesAttempted, total_secs: r.totalSecs })}>
                  Continue
                </button>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
