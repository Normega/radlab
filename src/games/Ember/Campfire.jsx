import { useEffect, useRef } from 'react'
import {
  stepWarmth, rateFromSignal, flameGeom, classifyRate, flameColor,
  emptyMetrics, accumulateMetrics,
} from './emberMechanics'
import { WIN_WARMTH, HOLD_MS, PACER_PERIOD_MS } from './constants'

// ── Campfire ────────────────────────────────────────────────────────────────
// The playfield. Reads breath.signalRef every animation frame, advances the
// warmth accumulator W (the score), and renders a night hearth whose flame size
// tracks W and whose flicker tracks the live breath. Owns particles (sparks +
// smoke), the win-beacon hold streak, and the running metrics accumulator, which
// it writes into metricsRef for the parent to read at summary time.
//
// All game state lives in refs and mutates inside the draw loop — no React state
// per frame. onCaughtFire fires once when the hold streak first reaches HOLD_MS.
//
// The loop runs on setInterval, not requestAnimationFrame: rAF freezes entirely
// in a backgrounded tab, which would pause the fire (and the metrics) the moment
// a participant switched away — and blocks headless verification. An interval
// keeps ticking (throttled), and the dt cap below absorbs any catch-up jump.
const FRAME_MS = 33  // ~30 fps

export default function Campfire({ breath, running, showPacer, metricsRef, onCaughtFire }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const groundY = H * 0.82
    const cx = W / 2

    // Game state (refs — never React state)
    let warmth = 0
    let holdStart = null         // wall-clock ms when W first crossed WIN_WARMTH
    let caughtFired = false
    let lastT = performance.now()
    const particles = []          // { x, y, vx, vy, life, max, kind }
    let sparkAccum = 0, smokeAccum = 0
    let lastBreathValue = 0.5, lastPhase = 'pause'

    if (metricsRef) { metricsRef.current = emptyMetrics(); metricsRef.current.startMs = Date.now() }

    const spawn = (kind) => {
      const jitter = (n) => (Math.random() - 0.5) * n
      if (kind === 'spark') {
        particles.push({
          x: cx + jitter(30), y: groundY - 20 - Math.random() * 40,
          vx: jitter(24), vy: -50 - Math.random() * 70,
          life: 0, max: 0.7 + Math.random() * 0.6, kind,
        })
      } else {
        particles.push({
          x: cx + jitter(40), y: groundY - 60 - Math.random() * 30,
          vx: jitter(12), vy: -20 - Math.random() * 20,
          life: 0, max: 1.6 + Math.random() * 1.2, kind,
        })
      }
    }

    const frame = () => {
      const now = performance.now()
      const dtS = Math.min((now - lastT) / 1000, 0.1)  // cap dt after tab-switch stalls
      lastT = now

      const sig = breath.signalRef.current
      const rate = rateFromSignal(sig)
      const cls = classifyRate(rate)

      if (running) {
        warmth = stepWarmth(warmth, sig, dtS)

        // Win-beacon hold streak
        if (warmth >= WIN_WARMTH) {
          if (holdStart == null) holdStart = now
        } else {
          holdStart = null
        }
        const holdMs = holdStart == null ? 0 : now - holdStart
        if (!caughtFired && holdMs >= HOLD_MS) {
          caughtFired = true
          if (metricsRef) metricsRef.current.caughtFire = true
          onCaughtFire?.()
          // celebratory burst
          for (let i = 0; i < 40; i++) spawn('spark')
        }

        if (metricsRef) {
          accumulateMetrics(metricsRef.current, {
            W: warmth, rate, regularitySdMs: sig.regularitySdMs, holdMs, dtMs: dtS * 1000,
          })
        }
      }

      lastBreathValue = sig.value ?? lastBreathValue
      lastPhase = sig.phase ?? lastPhase

      // ── Emit particles ──
      if (running) {
        // Sparks: rate-limited, scale with warmth, burst on exhale onset
        if (warmth > 0.6) { sparkAccum += dtS * (warmth * 14); while (sparkAccum >= 1) { spawn('spark'); sparkAccum -= 1 } }
        if (lastPhase === 'exhale' && warmth > 0.6 && Math.random() < 0.04) spawn('spark')
        // Smoke: only when breathing too fast (gain < 0 ⇒ 'fast')
        if (cls === 'fast') { smokeAccum += dtS * 8; while (smokeAccum >= 1) { spawn('smoke'); smokeAccum -= 1 } }
      }

      // ── Draw ──
      drawBackground(ctx, W, H, groundY, warmth)
      if (showPacer) drawPacer(ctx, cx, groundY, now)
      drawHearth(ctx, cx, groundY)
      drawFlame(ctx, cx, groundY, warmth, lastBreathValue, cls, now)
      drawParticles(ctx, particles, dtS)
      drawWarmthGauge(ctx, W, H, warmth, caughtFired)
    }
    const id = setInterval(frame, FRAME_MS)
    return () => clearInterval(id)
  }, [breath, running, showPacer, metricsRef, onCaughtFire])

  return <canvas ref={canvasRef} width={520} height={520} style={{ width: '100%', maxWidth: 520, borderRadius: 16, display: 'block' }} />
}

// ── Draw helpers ──────────────────────────────────────────────────────────

function drawBackground(ctx, W, H, groundY, warmth) {
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  // night deepens to warm near the fire as it grows
  sky.addColorStop(0, '#0b1020')
  sky.addColorStop(0.7, '#141024')
  sky.addColorStop(1, `rgb(${30 + warmth * 60}, ${18 + warmth * 20}, ${20})`)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // ground
  ctx.fillStyle = '#0a0a10'
  ctx.fillRect(0, groundY, W, H - groundY)

  // warm glow pool on the ground, radius grows with warmth
  const r = 60 + warmth * 200
  const glow = ctx.createRadialGradient(W / 2, groundY, 0, W / 2, groundY, r)
  glow.addColorStop(0, `rgba(255,150,50,${0.10 + warmth * 0.35})`)
  glow.addColorStop(1, 'rgba(255,150,50,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
}

function drawPacer(ctx, cx, groundY, now) {
  // Faint guide ring pulsing at the resonance period. A cosine radius so it is
  // biggest ("inhale") at cycle start — the same phase convention as the belt.
  const phase = (now % PACER_PERIOD_MS) / PACER_PERIOD_MS
  const s = (1 - Math.cos(phase * 2 * Math.PI)) / 2   // 0..1
  const r = 70 + s * 70
  ctx.save()
  ctx.strokeStyle = `rgba(150,190,255,${0.12 + s * 0.12})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, groundY - 70, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawHearth(ctx, cx, groundY) {
  // Two crossed logs
  ctx.save()
  ctx.strokeStyle = '#3a2416'
  ctx.lineCap = 'round'
  ctx.lineWidth = 16
  ctx.beginPath(); ctx.moveTo(cx - 55, groundY + 6); ctx.lineTo(cx + 45, groundY - 14); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + 55, groundY + 6); ctx.lineTo(cx - 45, groundY - 14); ctx.stroke()
  ctx.strokeStyle = '#241608'
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(cx - 55, groundY + 6); ctx.lineTo(cx + 45, groundY - 14); ctx.stroke()
  ctx.restore()
}

function drawFlame(ctx, cx, groundY, warmth, value, cls, now) {
  const { flame } = flameGeom(warmth, value)
  const maxH = 230
  const h = Math.max(14, flame * maxH)
  const baseW = 46 + warmth * 26
  const baseY = groundY - 10

  const col = flameColor(warmth)
  // desaturate toward grey-smoke when breathing too fast
  const smokeMix = cls === 'fast' ? 0.45 : 0
  const mix = (c) => Math.round(c + (150 - c) * smokeMix)
  const R = mix(col.r), G = mix(col.g), B = mix(col.b)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  // layered flame tongues with per-frame sway
  const layers = [
    { w: 1.0, h: 1.0, a: 0.35, sway: 10 },
    { w: 0.7, h: 0.82, a: 0.5, sway: 7 },
    { w: 0.42, h: 0.6, a: 0.85, sway: 4 },
  ]
  for (const L of layers) {
    const sway = Math.sin(now / 220 + L.sway) * L.sway * (0.4 + warmth * 0.6)
    const lw = baseW * L.w, lh = h * L.h
    ctx.fillStyle = `rgba(${R},${G},${B},${L.a})`
    ctx.beginPath()
    ctx.moveTo(cx - lw / 2, baseY)
    ctx.quadraticCurveTo(cx - lw / 2 + sway, baseY - lh * 0.55, cx + sway * 0.5, baseY - lh)
    ctx.quadraticCurveTo(cx + lw / 2 + sway, baseY - lh * 0.55, cx + lw / 2, baseY)
    ctx.closePath()
    ctx.fill()
  }
  // hot white-gold core
  ctx.fillStyle = `rgba(255,240,200,${0.5 * warmth + 0.1})`
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h * 0.18, baseW * 0.16, h * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawParticles(ctx, particles, dtS) {
  ctx.save()
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life += dtS
    if (p.life >= p.max) { particles.splice(i, 1); continue }
    p.x += p.vx * dtS
    p.y += p.vy * dtS
    const t = p.life / p.max
    if (p.kind === 'spark') {
      p.vy += 8 * dtS  // slight gravity easing the rise
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = `rgba(255,${170 - t * 90},60,${(1 - t) * 0.9})`
      const s = 2.2 * (1 - t) + 0.6
      ctx.fillRect(p.x, p.y, s, s)
    } else {
      ctx.globalCompositeOperation = 'source-over'
      const g = 90
      ctx.fillStyle = `rgba(${g},${g},${g},${(1 - t) * 0.18})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6 + t * 16, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawWarmthGauge(ctx, W, H, warmth, caught) {
  const barW = 200, barH = 8, x = (W - barW) / 2, y = H - 26
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  roundRect(ctx, x, y, barW, barH, 4); ctx.fill()
  const col = flameColor(warmth)
  ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`
  roundRect(ctx, x, y, barW * warmth, barH, 4); ctx.fill()
  // win-threshold tick
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x + barW * WIN_WARMTH, y - 3); ctx.lineTo(x + barW * WIN_WARMTH, y + barH + 3); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '11px "Space Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(caught ? 'ROARING' : 'warmth', W / 2, y - 8)
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
