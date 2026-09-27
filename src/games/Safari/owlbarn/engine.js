/* ── Owl Barn engine ──────────────────────────────────────────────────────────

   Imperative canvas module (the Alongside/Sidelong pattern): it owns the
   canvas, runs its own rAF loop, keeps every per-frame value in closure
   locals, and reports each window through `onWindow` and the end through
   `onFinish`. No React state is touched from the loop.

   Clock. When audio is on, every phase boundary is a time on the AUDIO clock
   (ctx.currentTime): hoots are scheduled there, and a tap is converted to that
   clock from its event timestamp. Taps are judged against when the silence was
   HEARD - scheduled time plus output latency - so Bluetooth headphones don't
   shorten the window. With sound off the clock is performance.now().

   Scene. Two painted corridors (plate pixels are world units). The mouse hides
   behind the props at spots 1-9, the doorway is spot 10, corridor 2 holds
   spots 11-19 and the barn door (20) is the way out. Owls perch on the high
   beam; their heads are separate cut-out pieces (neutral/blink/hoot/glare).
──────────────────────────────────────────────────────────────────────────── */

import {
  STEPS_PER_CORRIDOR, STEPS_TOTAL, HOOT_MIN_MS, HOOT_MAX_MS, MAX_WINDOWS,
  nextWinnum, optimalChoice, resolveWindow, applySteps, WINNUM_MAX,
} from './timing.js'

// Owls perch along the high beam every ~1100 plate px, so a phone's narrower view (about 860 px of
// plate in portrait) nearly always has one in it - the owls carry the visual hoot cue. Facing alternates.
// Owls perch on the lower crossbeam (c1) and the stall-front tops (c2): at the 1.4x size chosen
// 2026-09-27 an owl on the high beam would lose the top of its head to the plate edge, and lower
// down they loom over the mouse. Heights are the beam tops from the Blender camera geometry.
const PERCH_Y = { c1: 872, c2: 838 }
const perchesFor = (cor, width) => {
  const out = []
  for (let x = 540, i = 0; x < width - 400; x += 1100, i++) out.push({ x, y: PERCH_Y[cor], s: i % 2 ? -1 : 1 })
  return out
}
const OWL_DRAW_H = 350          // owl height on the plate (1.4x, chosen 2026-09-27: they should loom)
const MOUSE_DRAW_W = 150        // crouched mouse width on the plate, tail included
const MOVE_MS_PER_STEP = 480
const SWOOP_DIVE = 0.5, SWOOP_CARRY = 0.7, SWOOP_DROP = 0.25, SWOOP_BACK = 0.6
const FADE_S = 0.55
const HOOT_LEAD_S = 0.06

const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const lerp = (a, b, t) => a + (b - a) * t

export function createOwlBarn(canvas, opts) {
  const { scene, images, schedule, audio, modality = 'both', reduceMotion = false, onWindow, onFinish } = opts
  const ctx = canvas.getContext('2d')
  const showVisualHoot = modality !== 'audio'
  const useSound = !!audio && modality !== 'visual'

  // ── clock ──────────────────────────────────────────────────────────────────
  let pausedAt = null, pausedTotal = 0
  const clock = () => (audio ? audio.now() : (performance.now() / 1000 - pausedTotal))
  const latency = () => (useSound ? audio.latencySec() : 0)
  const heard = () => clock() - latency()                      // "what the player is perceiving now"
  const tapTime = (ev) => (audio ? audio.toCtx(ev.timeStamp) : ev.timeStamp / 1000 - pausedTotal) - latency()

  // ── world ──────────────────────────────────────────────────────────────────
  const spotX = {}, spotY = {}
  function layoutSpots(cor) {
    const c = scene[cor]
    for (const p of c.props) {
      // tucked in just past the prop's right edge: the tail and haunch stay behind it, the head and
      // body stay visible - the player must always be able to see the mouse
      if (p.kind === 'prop') { spotX[p.spot] = p.box[2] + MOUSE_DRAW_W * 0.3; spotY[p.spot] = p.box[3] - 10 }
    }
    // The doorway (10) and the barn door (20) are on the far wall, and parallax projects them LEFT of
    // the last floor props - walking to them would mean running backwards. Until the doorways are
    // moved right in the Blender scene, the mouse runs on past the last prop and the fade carries it.
    for (const p of c.props) {
      if (p.kind === 'prop') continue
      const prev = spotX[p.spot - 1] ?? c.width / 2
      spotX[p.spot] = Math.min(prev + 340, c.width - MOUSE_DRAW_W * 0.5); spotY[p.spot] = spotY[p.spot - 1] ?? c.height - 170
    }
  }
  layoutSpots('c1'); layoutSpots('c2')
  const floorY = (cor) => {
    const ys = scene[cor].props.filter(p => p.kind === 'prop').map(p => p.box[3])
    return ys.reduce((a, b) => a + b, 0) / ys.length - 10
  }
  const START = { c1: { x: MOUSE_DRAW_W, y: floorY('c1') }, c2: { x: MOUSE_DRAW_W * 1.2, y: floorY('c2') } }
  const posForStep = (cor, step) => {
    if (cor === 'c1' && step === 0) return START.c1
    if (cor === 'c2' && step === STEPS_PER_CORRIDOR) return START.c2
    return { x: spotX[step], y: spotY[step] }
  }

  const PERCH = { c1: perchesFor('c1', scene.c1.width), c2: perchesFor('c2', scene.c2.width) }

  // ── state ──────────────────────────────────────────────────────────────────
  const S = {
    cor: 'c1', step: 0, phase: 'enter', t0: 0,
    winnum: WINNUM_MAX, dir: -1, win: null, windows: 0,
    mouse: { ...START.c1 }, pose: 'crouch', runT: 0,
    move: null, swoop: null, fade: 0, fadeDir: 0, shake: 0,
    taps: [], tapCount: 0, locked: false, flash: 0, sparkle: [],
    blink: [], nextBlink: [], owlHide: -1,
    startedAt: null, endedAt: null, stars: 0,
  }
  const cam = { x: 0 }
  let hootHandle = null, raf = 0, destroyed = false, lastFrame = null, stopAmbience = null

  // ── windows ────────────────────────────────────────────────────────────────
  function beginWindow(lock) {
    if (S.windows >= MAX_WINDOWS) return finish(false)
    const now = clock()
    const hootS = (HOOT_MIN_MS + Math.random() * (HOOT_MAX_MS - HOOT_MIN_MS)) / 1000
    const winMs = schedule.windowMs(S.winnum)
    const H = now + HOOT_LEAD_S, E = H + hootS, X = E + winMs / 1000
    S.win = { H, E, X, winMs, hootMs: Math.round(hootS * 1000), winnum: S.winnum, dir: S.dir, optimal: optimalChoice(winMs, schedule.riskyMs) }
    S.locked = !!lock; S.taps = []; S.tapCount = 0
    S.phase = 'hoot'
    if (useSound) hootHandle = audio.hoot(H, E)
    S.windows += 1
  }

  function record(kind, choice, outcome, before, after, extra = {}) {
    const w = S.win
    onWindow?.({
      i: S.windows, corridor: S.cor, kind, winnum: w.winnum, dir: w.dir,
      window_ms: w.winMs, hoot_ms: w.hootMs, risky_ms: schedule.riskyMs, safe_ms: schedule.safeMs,
      optimal: w.optimal, choice, outcome, tapCount: S.tapCount,
      taps_ms: S.taps.map(t => Math.round((t - w.E) * 1000)),
      first_tap_ms: S.taps.length ? Math.round((S.taps[0] - w.E) * 1000) : null,
      steps_before: before, steps_after: after, locked: S.locked,
      latency_ms: Math.round(latency() * 1000), ...extra,
    })
  }

  function advanceWave() { ({ winnum: S.winnum, dir: S.dir } = nextWinnum(S.winnum, S.dir)) }

  function resolveSilence() {
    const r = resolveWindow(S.tapCount)
    const before = S.step
    if (r.outcome === 'wrong_count') {
      const after = applySteps(before, r.delta)
      record('silence', r.choice, r.outcome, before, after)
      advanceWave()
      S.pose = 'freeze'; S.phase = 'freeze'; S.freezeUntil = clock() + 0.45
      S.pendingSwoopTo = after
      return
    }
    const after = applySteps(before, r.delta)
    record('silence', r.choice, r.outcome, before, after)
    advanceWave()
    if (r.delta > 0) startMove(after)
    else beginWindow(false)
  }

  function startMove(to) {
    const from = { ...S.mouse }
    const target = posForStep(S.cor, Math.min(to, S.cor === 'c1' ? STEPS_PER_CORRIDOR : STEPS_TOTAL))
    const steps = Math.max(1, to - S.step)
    S.move = { t0: clock(), dur: (MOVE_MS_PER_STEP * steps) / 1000, from, to: target }
    S.step = to; S.phase = 'moving'; S.pose = 'run_a'
  }

  function arrive() {
    S.move = null
    if (S.cor === 'c1' && S.step >= STEPS_PER_CORRIDOR) { S.phase = 'fadeout'; S.fadeDir = 1; return }
    if (S.step >= STEPS_TOTAL) return finish(true)
    S.pose = 'crouch'
    beginWindow(false)
  }

  function startSwoop(toStep) {
    // nearest owl on this corridor dives; the mouse is carried back to `toStep`
    const perches = PERCH[S.cor]
    let k = 0, best = Infinity
    perches.forEach((p, i) => { const d = Math.abs(p.x - S.mouse.x); if (d < best) { best = d; k = i } })
    const p = perches[k]
    S.owlHide = k
    S.swoop = { t0: clock(), from: { x: p.x, y: p.y - OWL_DRAW_H * 0.6 }, grab: { ...S.mouse }, to: posForStep(S.cor, toStep), back: { x: p.x, y: p.y - OWL_DRAW_H * 0.6 }, face: S.mouse.x >= p.x ? 1 : -1 }
    S.step = toStep; S.phase = 'swoop'; S.pose = 'freeze'
    if (useSound) audio.swoop()
    if (!reduceMotion) S.shake = 0.25
  }

  function finish(crossed) {
    if (S.phase === 'done') return
    S.phase = 'done'; S.pose = crossed ? 'cheer' : 'crouch'; S.endedAt = heard()
    if (useSound) { audio.cancelHoot(hootHandle); if (crossed) audio.crossed() }
    onFinish?.({ crossed, crossing_ms: Math.round((S.endedAt - S.startedAt) * 1000), windows: S.windows })
  }

  // ── input ──────────────────────────────────────────────────────────────────
  function tap(ev) {
    if (!S.win || S.phase === 'done') return
    const t = tapTime(ev)
    const w = S.win
    if (S.phase === 'hoot' || (S.phase === 'silence' && t < w.E)) {
      if (S.locked) return
      // a tap while the owls are hooting: swooped
      const before = S.step, after = applySteps(before, -2)
      S.taps = [t]; S.tapCount = 1
      record('hoot_tap', 'hoot_tap', 'swooped', before, after, { tap_into_hoot_ms: Math.round((t - w.H) * 1000) })
      if (useSound) audio.cancelHoot(hootHandle)
      advanceWave()
      startSwoop(after)
      return
    }
    if (S.phase !== 'silence' || t >= w.X) return
    S.taps.push(t); S.tapCount += 1
    if (useSound) audio.tap(S.tapCount)
    if (S.tapCount === 3 || S.tapCount === 8) S.flash = S.tapCount === 8 ? 0.6 : 0.35
    if (S.tapCount === 8) {
      for (let i = 0; i < 18; i++) S.sparkle.push({ a: Math.random() * Math.PI * 2, r: 10, v: 90 + Math.random() * 140, life: 0.7 })
      const before = S.step, after = applySteps(before, 2)
      record('silence', '8tap', 'success', before, after)
      advanceWave()
      startMove(after)
    }
  }

  // ── rendering helpers ──────────────────────────────────────────────────────
  const img = (f) => images[f]
  function drawImg(f, x, y, w, h, flip = false) {
    const im = img(f); if (!im || !im.complete) return
    if (!flip) { ctx.drawImage(im, x, y, w, h); return }
    ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); ctx.restore()
  }
  function drawOwl(p, i, t, headKind, puff) {
    const R = scene.owl, k = OWL_DRAW_H / R.height
    const breathe = 1 + Math.sin(t * 1.7 + i) * 0.012 + puff * 0.035
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k * p.s * breathe, k * breathe)
    const b = R.body; drawImg(b.file, b.x, b.y, b.w, b.h)
    const tilt = Math.sin(t * 0.6 + i * 2) * 0.06 + (headKind === 'hoot' ? Math.sin(t * 9) * 0.03 : 0)
    ctx.translate(R.pivot[0], R.pivot[1]); ctx.rotate(tilt); ctx.translate(-R.pivot[0], -R.pivot[1])
    const h = R.heads[headKind] || R.heads.neutral; drawImg(h.file, h.x, h.y, h.w, h.h)
    ctx.restore()
  }
  function drawMouse(x, y, pose, flip, alpha = 1) {
    const M = scene.mouse, P = M[pose] || M.crouch, k = MOUSE_DRAW_W / M.crouch.w
    ctx.save(); ctx.globalAlpha = alpha
    // anchored at the nose (leading edge) and feet
    const w = P.w * k, h = P.h * k
    drawImg(P.file, x - w * 0.62, y - h, w, h, flip)
    ctx.restore()
  }

  // ── frame ──────────────────────────────────────────────────────────────────
  function frame() {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    const now = clock(), t = heard()
    const dt = lastFrame == null ? 0 : Math.min(0.1, Math.max(0, now - lastFrame)); lastFrame = now

    // phase machine (judged on heard time)
    if (S.phase === 'enter') {
      if (S.t0 === 0) S.t0 = now
      if (now - S.t0 > 1.2) { S.startedAt = heard(); beginWindow(false) }
    } else if (S.phase === 'hoot' && S.win && t >= S.win.E) {
      S.phase = 'silence'; S.locked = false
      if (S.pose === 'dizzy' || S.pose === 'freeze') S.pose = 'crouch'
    } else if (S.phase === 'silence' && S.win && t >= S.win.X) {
      resolveSilence()
    } else if (S.phase === 'freeze' && now >= S.freezeUntil) {
      startSwoop(S.pendingSwoopTo)
    } else if (S.phase === 'moving' && S.move) {
      const u = Math.min(1, (now - S.move.t0) / S.move.dur)
      S.mouse.x = lerp(S.move.from.x, S.move.to.x, easeInOut(u)); S.mouse.y = lerp(S.move.from.y, S.move.to.y, u)
      S.runT += dt; S.pose = Math.floor(S.runT * 11) % 2 ? 'run_b' : 'run_a'
      if (u >= 1) arrive()
    } else if (S.phase === 'swoop' && S.swoop) {
      const e = now - S.swoop.t0
      if (e > SWOOP_DIVE && e <= SWOOP_DIVE + SWOOP_CARRY) {
        const u = easeInOut((e - SWOOP_DIVE) / SWOOP_CARRY)
        S.mouse.x = lerp(S.swoop.grab.x, S.swoop.to.x, u); S.mouse.y = lerp(S.swoop.grab.y, S.swoop.to.y, u) - Math.sin(u * Math.PI) * 180
      } else if (e > SWOOP_DIVE + SWOOP_CARRY && e <= SWOOP_DIVE + SWOOP_CARRY + SWOOP_DROP) {
        S.mouse.x = S.swoop.to.x; S.mouse.y = S.swoop.to.y; S.pose = 'dizzy'
      } else if (e > SWOOP_DIVE + SWOOP_CARRY + SWOOP_DROP + SWOOP_BACK) {
        S.swoop = null; S.owlHide = -1; S.pose = 'dizzy'; S.stars = 2.5
        beginWindow(true)                 // the next hoot is a lockout
      }
    } else if (S.phase === 'fadeout') {
      S.fade = Math.min(1, S.fade + dt / FADE_S)
      if (S.fade >= 1) { S.cor = 'c2'; S.mouse = { ...START.c2 }; cam.x = 0; S.phase = 'fadein'; S.pose = 'crouch' }
    } else if (S.phase === 'fadein') {
      S.fade = Math.max(0, S.fade - dt / FADE_S)
      if (S.fade <= 0) beginWindow(false)
    }

    // camera: full plate height, width from the canvas aspect; follow the mouse
    const C = scene[S.cor], W = canvas.width, Hc = canvas.height
    const sc = Hc / C.height, vw = W / sc
    const target = Math.max(0, Math.min(C.width - vw, S.mouse.x - vw * 0.4))
    cam.x = S.phase === 'fadein' && S.fade > 0.9 ? target : lerp(cam.x, target, 1 - Math.exp(-dt * 4))

    ctx.save()
    ctx.fillStyle = '#050403'; ctx.fillRect(0, 0, W, Hc)
    if (S.shake > 0) { S.shake -= dt; ctx.translate((Math.random() - 0.5) * 8, 0) }
    ctx.scale(sc, sc); ctx.translate(-cam.x, 0)
    drawImg(`${S.cor}_plate.webp`, 0, 0, C.width, C.height)

    // rafter glow while the owls hoot (visual cue), fading with the silence
    const hooting = (S.phase === 'hoot' || (S.phase === 'swoop' && S.win && t < S.win.E)) && S.win && t >= S.win.H
    if (showVisualHoot) {
      S.glow = lerp(S.glow || 0, hooting ? 1 : 0, 1 - Math.exp(-dt * (hooting ? 6 : 3)))
      if (S.glow > 0.01) {
        const g = ctx.createLinearGradient(0, 300, 0, 1100)
        const ga = 0.42 * S.glow * (0.85 + 0.15 * Math.sin(t * 5))
        g.addColorStop(0, 'rgba(122,40,0,0)'); g.addColorStop(0.5, `rgba(122,40,0,${ga})`); g.addColorStop(1, 'rgba(122,40,0,0)')
        ctx.fillStyle = g; ctx.fillRect(cam.x, 300, vw, 800)
      }
    }

    // owls
    PERCH[S.cor].forEach((p, i) => {
      if (i === S.owlHide) return
      if (S.nextBlink[i] == null) { S.nextBlink[i] = 0.8 + i * 1.3; S.blink[i] = 0 }
      S.nextBlink[i] -= dt
      if (S.nextBlink[i] <= 0) { S.blink[i] = 0.16; S.nextBlink[i] = 2.5 + Math.random() * 4.5 }
      S.blink[i] = Math.max(0, S.blink[i] - dt)
      let head = 'neutral', puff = 0
      if (hooting && showVisualHoot) { head = 'hoot'; puff = 1 }
      else if (S.phase === 'silence' || modality === 'audio') head = 'glare'
      if (S.blink[i] > 0 && head !== 'hoot') head = 'blink'
      drawOwl(p, i, t, head, puff)
      if (hooting && showVisualHoot) {
        const R = scene.owl, k = OWL_DRAW_H / R.height
        for (const e of R.eyes) {
          const ex = p.x + e.x * k * p.s, ey = p.y + e.y * k
          const gg = ctx.createRadialGradient(ex, ey, 0, ex, ey, e.r * k * 2.2)
          gg.addColorStop(0, 'rgba(255,170,60,0.55)'); gg.addColorStop(1, 'rgba(255,120,20,0)')
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(ex, ey, e.r * k * 2.2, 0, Math.PI * 2); ctx.fill()
        }
      }
    })

    // props
    for (const p of C.props) {
      if (p.kind !== 'prop') continue
      const [x0, y0, x1, y1] = p.box
      if (x1 < cam.x - 50 || x0 > cam.x + vw + 50) continue
      drawImg(p.file, x0, y0, x1 - x0, y1 - y0)
    }

    // mouse, drawn over the props: the player must always be able to see it; standing at a prop's
    // edge still reads as taking cover
    let mpose = S.pose
    if (S.phase === 'silence' && !S.locked && S.pose === 'crouch') mpose = 'peek'
    if (S.phase === 'done' && S.pose === 'cheer') mpose = 'cheer'
    drawMouse(S.mouse.x, S.mouse.y, mpose, false, S.cor === 'c1' && S.step === STEPS_PER_CORRIDOR && S.phase !== 'moving' ? 0.6 : 1)

    // tap aura (drawn over the props so feedback is never hidden)
    if (S.phase === 'silence' || S.flash > 0) {
      const n = S.tapCount, cx = S.mouse.x - MOUSE_DRAW_W * 0.2, cy = S.mouse.y - 45
      const green = n === 3 || n === 8, level = n <= 3 ? n : n - 3
      if (n > 0 || S.flash > 0) {
        const r = (green ? 120 : 50 + level * 16) * (S.flash > 0 ? 1 + S.flash : 1)
        const col = n >= 8 ? '168,255,135' : green ? '127,212,106' : '245,200,66'
        const a = S.flash > 0 ? 0.55 : 0.35
        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        gg.addColorStop(0, `rgba(${col},${a})`); gg.addColorStop(1, `rgba(${col},0)`)
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
      }
      S.flash = Math.max(0, S.flash - dt)
    }
    for (const s of S.sparkle) {
      s.life -= dt; s.r += s.v * dt
      ctx.fillStyle = `rgba(210,255,190,${Math.max(0, s.life)})`
      ctx.beginPath(); ctx.arc(S.mouse.x + Math.cos(s.a) * s.r, S.mouse.y - 50 + Math.sin(s.a) * s.r, 4, 0, Math.PI * 2); ctx.fill()
    }
    S.sparkle = S.sparkle.filter(s => s.life > 0)
    if (S.stars > 0 && S.pose === 'dizzy') {
      S.stars -= dt
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * 2.1
        ctx.fillStyle = 'rgba(255,230,140,0.9)'
        ctx.beginPath(); ctx.arc(S.mouse.x + Math.cos(a) * 34, S.mouse.y - 110 + Math.sin(a) * 10, 5, 0, Math.PI * 2); ctx.fill()
      }
    }

    // the swooping owl, on top of everything
    if (S.phase === 'swoop' && S.swoop) {
      const e = now - S.swoop.t0, sw = scene.owl.swoop, k = (OWL_DRAW_H * 1.15) / sw.h
      let px, py
      if (e <= SWOOP_DIVE) { const u = easeInOut(e / SWOOP_DIVE); px = lerp(S.swoop.from.x, S.swoop.grab.x, u); py = lerp(S.swoop.from.y, S.swoop.grab.y - 40, u) }
      else if (e <= SWOOP_DIVE + SWOOP_CARRY + SWOOP_DROP) { px = S.mouse.x; py = S.mouse.y - 40 }
      else { const u = easeInOut(Math.min(1, (e - SWOOP_DIVE - SWOOP_CARRY - SWOOP_DROP) / SWOOP_BACK)); px = lerp(S.swoop.to.x, S.swoop.back.x, u); py = lerp(S.swoop.to.y - 40, S.swoop.back.y, u) }
      const flip = (e <= SWOOP_DIVE ? S.swoop.face : -S.swoop.face) < 0
      drawImg(sw.file, px - sw.grip[0] * k, py - sw.grip[1] * k, sw.w * k, sw.h * k, flip)
    }
    ctx.restore()

    if (S.fade > 0) { ctx.fillStyle = `rgba(5,4,3,${S.fade})`; ctx.fillRect(0, 0, W, Hc) }
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr))
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize()
  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (audio) audio.ctx.suspend().catch(() => {}); else pausedAt = performance.now() / 1000
    } else {
      if (audio) audio.resume(); else if (pausedAt != null) { pausedTotal += performance.now() / 1000 - pausedAt; pausedAt = null }
      lastFrame = null
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  if (useSound) stopAmbience = audio.ambience()
  raf = requestAnimationFrame(frame)

  const api = {
    tap,
    state: () => ({ cor: S.cor, step: S.step, phase: S.phase, winnum: S.winnum, windows: S.windows }),
    layout: () => ({ canvas: [canvas.width, canvas.height], dpr: Math.min(window.devicePixelRatio || 1, 2) }),
    destroy() {
      destroyed = true; cancelAnimationFrame(raf); ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      stopAmbience?.()
      if (useSound) audio.cancelHoot(hootHandle)
    },
  }
  if (import.meta.env?.DEV) window.__owlbarn = api
  return api
}
