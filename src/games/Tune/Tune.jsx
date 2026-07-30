import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import { supabase } from '../../lib/supabase'
import { dbWrite } from '../../lib/dbWrite'
import {
  DWELL_VELOCITY, INFLUENCE_RADIUS, GROWTH_RATE, DECAY_RATE,
  FREQ_MUFFLED, DUCK_DEPTH, DUCK_FLOOR, AUDIO_BUCKET, audioPath, SCENES,
} from './constants'

/* ── SQL (supabase/migrations/20260725_tune.sql — apply before shipping) ───────

ALTER TABLE performance
  ADD COLUMN tune_duration_ms    integer,
  ADD COLUMN tune_avg_dwell_ms   float,
  ADD COLUMN tune_scenes_visited integer;

──────────────────────────────────────────────────────────────────────────── */

// ─── SUPABASE ─────────────────────────────────────────────────────────────────

async function startSession(userId) {
  if (!userId) return null
  const { data } = await supabase.from('game_sessions').insert({
    user_id: userId, game_name: 'tune', study_id: null,
    started_at: new Date().toISOString(),
  }).select('id').single()
  return data?.id ?? null
}

async function saveSessionComplete({ sessionId, durationMs, avgDwellMs, scenesVisited }) {
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
    tune_duration_ms:    durationMs,
    tune_avg_dwell_ms:   avgDwellMs,
    tune_scenes_visited: scenesVisited,
  })
  // Deliberately no profiles/points update — Tune is a non-striving practice.
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
      <h1 style={S.h1}>Tune.</h1>
      <p style={S.sub}>
        A world of sound waits in a soft haze.<br />
        This is a practice in letting attention settle — listening, not searching.
      </p>

      <div style={S.card}>
        {[
          { n: 1, title: 'Rest, don’t hunt', body: 'Let your cursor settle near a glowing point — or rest a finger on the screen. Held still, that sound clarifies and steps forward.' },
          { n: 2, title: 'The rest softens back', body: 'As one voice comes clear, the others recede around it. Drift on and the whole mix returns.' },
          { n: 3, title: 'Nothing to complete', body: 'Wander between scenes if you like. Stay as long as you please — a quiet finish button waits in the corner. Headphones help.' },
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
  const { durationMs, avgDwellMs, episodeCount, scenesVisited } = summary
  const dwellLine = avgDwellMs != null
    ? `Your attention settled ${episodeCount === 1 ? 'once' : `${episodeCount} times`}, resting for ${(avgDwellMs / 1000).toFixed(1)}s at a time on average.`
    : 'Movement kept the haze in place this time — nothing wrong with that.'
  const sceneLine = scenesVisited > 1 ? ` You wandered through ${scenesVisited} scenes.` : ''

  return (
    <div style={{ maxWidth: 400, textAlign: 'center', padding: '0 16px', width: '100%' }}>
      <p style={S.eyebrow}>Done</p>
      <h1 style={S.h1}>{fmtDuration(durationMs)} of listening</h1>
      <p style={S.sub}>{dwellLine}{sceneLine}</p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...S.btnOutline, flex: 1 }} onClick={onPlay}>Again</button>
        <Link to="/games" style={{ ...S.btnPrimary, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Games &rarr;</Link>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Tune({ session }) {
  const [phase, setPhase]       = useState('intro')    // intro | play | summary
  const [sceneIdx, setSceneIdx] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [summary, setSummary]   = useState(null)

  const sessionIdRef = useRef(null)
  const startedAtRef = useRef(null)
  const engineRef    = useRef(null)   // { loadScene, collectEpisodes } from the effect
  const visitedRef   = useRef(new Set())
  const sceneIdxRef  = useRef(0)
  const stageRef     = useRef(null)
  const canvasRef    = useRef(null)

  const userId = session?.user?.id ?? null

  function startGame() {
    startedAtRef.current = Date.now()
    visitedRef.current = new Set()
    sceneIdxRef.current = 0
    setSceneIdx(0)
    setSummary(null)
    setLoading(true)
    setPhase('play')
    startSession(userId).then(id => { sessionIdRef.current = id })
  }

  function finish() {
    const episodes   = engineRef.current?.collectEpisodes() ?? []
    const durationMs = Date.now() - startedAtRef.current
    const avgDwellMs = episodes.length
      ? episodes.reduce((s, d) => s + d, 0) / episodes.length
      : null
    const scenesVisited = visitedRef.current.size
    saveSessionComplete({ sessionId: sessionIdRef.current, durationMs, avgDwellMs, scenesVisited })
    sessionIdRef.current = null
    setSummary({ durationMs, avgDwellMs, episodeCount: episodes.length, scenesVisited })
    setPhase('summary')
  }

  function pickScene(idx) {
    if (idx === sceneIdxRef.current) return
    sceneIdxRef.current = idx
    setSceneIdx(idx)
    engineRef.current?.loadScene(idx)
  }

  // ─── Audio + canvas engine — faithful port of tune_prototype.html ───────────
  useEffect(() => {
    if (phase !== 'play') return
    const stage  = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const g = canvas.getContext('2d')

    // ── Audio graph ──────────────────────────────────────────────────────────
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const master = ctx.createDynamicsCompressor()
    master.threshold.value = -14; master.knee.value = 24; master.ratio.value = 3
    master.attack.value = 0.006; master.release.value = 0.25
    const outGain = ctx.createGain(); outGain.gain.value = 0.9
    master.connect(outGain).connect(ctx.destination)
    if (ctx.state === 'suspended') ctx.resume()

    const bufferCache = new Map()
    async function loadBuffer(id) {
      if (bufferCache.has(id)) return bufferCache.get(id)
      const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(audioPath(id))
      const res = await fetch(data.publicUrl)
      const arr = await res.arrayBuffer()
      const buf = await ctx.decodeAudioData(arr)
      bufferCache.set(id, buf)
      return buf
    }
    function makeBus() {
      const input = ctx.createGain(); input.gain.value = 1
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = FREQ_MUFFLED; lp.Q.value = 0.5
      const out = ctx.createGain(); out.gain.value = 0.0
      input.connect(lp).connect(out).connect(master)
      return { input, lp, out }
    }

    // Procedural voices
    function synthContinuous(name, bus, opt = {}) {
      const stops = []
      if (name === 'pad' || name === 'warmpad') {
        const freqs = opt.chord || [220, 261.63, 329.63]
        const wave = name === 'warmpad' ? 'triangle' : 'sawtooth'
        const gn = ctx.createGain(); gn.gain.value = name === 'warmpad' ? 0.20 : 0.16
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800; f.Q.value = 4
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lfg = ctx.createGain(); lfg.gain.value = 260
        lfo.connect(lfg).connect(f.frequency); lfo.start()
        f.connect(gn).connect(bus.input)
        freqs.forEach((fr, i) => { const o = ctx.createOscillator(); o.type = wave; o.frequency.value = fr; o.detune.value = (i - 1) * 7; o.connect(f); o.start(); stops.push(o) })
        stops.push(lfo)
      } else if (name === 'drone') {
        const tones = opt.tones || [110, 164.81]
        const gn = ctx.createGain(); gn.gain.value = 0.2; gn.connect(bus.input)
        tones.forEach(fr => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const og = ctx.createGain(); og.gain.value = 0.5; o.connect(og).connect(gn); o.start(); stops.push(o) })
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; const lg = ctx.createGain(); lg.gain.value = 0.08; lfo.connect(lg).connect(gn.gain); lfo.start(); stops.push(lfo)
      }
      return () => stops.forEach(o => { try { o.stop() } catch (_) {} })
    }
    function synthNote(name, bus, opt) {
      const t = ctx.currentTime
      if (name === 'bass') {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = opt.freq
        const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.5, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
        o.connect(gn).connect(bus.input); o.start(t); o.stop(t + 1.0)
      } else if (name === 'pluck') {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = opt.freq
        const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.5, t + 0.005); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
        o.connect(gn).connect(bus.input); o.start(t); o.stop(t + 0.55)
      } else if (name === 'bell') {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = opt.freq
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = opt.freq * 2.01
        const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.4, t + 0.006); gn.gain.exponentialRampToValueAtTime(0.001, t + 2.4)
        const g2 = ctx.createGain(); g2.gain.value = 0.28; o2.connect(g2).connect(gn)
        o.connect(gn).connect(bus.input); o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5)
      } else if (name === 'drum') {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.14)
        const gn = ctx.createGain(); gn.gain.setValueAtTime(0.6, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
        o.connect(gn).connect(bus.input); o.start(t); o.stop(t + 0.3)
      } else if (name === 'busker') {
        const seq = [392, 440, 587.33, 523.25, 440, 392]; let tt = t
        seq.forEach(fr => {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr
          const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 4; vib.connect(vg).connect(o.frequency); vib.start(tt)
          const gn = ctx.createGain(); gn.gain.setValueAtTime(0, tt); gn.gain.linearRampToValueAtTime(0.4, tt + 0.02); gn.gain.exponentialRampToValueAtTime(0.001, tt + 0.34)
          o.connect(gn).connect(bus.input); o.start(tt); o.stop(tt + 0.4); vib.stop(tt + 0.4)
          tt += 0.26
        })
      } else if (name === 'epiano') {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = opt.freq
        const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = opt.freq * 2; const mg = ctx.createGain(); mg.gain.value = opt.freq * 1.2; mod.connect(mg).connect(o.frequency); mod.start(t)
        const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.42, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
        o.connect(gn).connect(bus.input); o.start(t); o.stop(t + 1.25); mod.stop(t + 1.25)
      } else if (name === 'swell') {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = opt.freq
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = opt.freq; o2.detune.value = 6
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; f.Q.value = 2
        const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.34, t + 0.7); gn.gain.setValueAtTime(0.34, t + 1.6); gn.gain.exponentialRampToValueAtTime(0.001, t + 3.0)
        o.connect(f); o2.connect(f); f.connect(gn).connect(bus.input); o.start(t); o2.start(t); o.stop(t + 3.05); o2.stop(t + 3.05)
      } else if (name === 'metallo') {
        ;[[1, 0.5], [2.76, 0.28], [5.4, 0.16]].forEach(([mult, amp]) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = opt.freq * mult
          const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(amp * 0.5, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
          o.connect(gn).connect(bus.input); o.start(t); o.stop(t + 1.65)
        })
      }
    }
    function fireSlice(bus, buf, slice) {
      const t = ctx.currentTime
      const dur = Math.min(buf.duration, slice * (0.75 + Math.random() * 0.5))
      const off = Math.random() * Math.max(0.01, buf.duration - dur)
      const src = ctx.createBufferSource(); src.buffer = buf
      const env = ctx.createGain(); env.gain.value = 0
      src.connect(env).connect(bus.input)
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(1, t + 0.09)
      env.gain.setValueAtTime(1, t + dur - 0.18)
      env.gain.linearRampToValueAtTime(0, t + dur)
      try { src.start(t, off, dur + 0.05); src.stop(t + dur + 0.1) } catch (_) {}
    }

    // ── Scene runtime ─────────────────────────────────────────────────────────
    let current = null

    function scheduleEvent(rt, voice) {
      const v = voice.def
      const next = () => {
        if (current !== rt) return
        ;(voice._interval || voice.fire)()
        voice.pulse = 1
        let base = v.iv
        if (v.density) base = v.iv - voice.clarity * (v.iv - (v.minIv || 1))
        const wait = Math.max(0.3, base * (1 + (Math.random() * 2 - 1) * (v.jit || 0.3)))
        rt.timers.push(setTimeout(next, wait * 1000))
      }
      rt.timers.push(setTimeout(next, (0.5 + Math.random() * v.iv) * 1000))
    }

    function stopScene() {
      if (!current) return
      const rt = current; current = null
      rt.timers.forEach(clearTimeout)
      if (rt.transport) clearInterval(rt.transport)
      rt.continuous.forEach(c => { try { c.stop ? c.stop() : null } catch (_) {} })
      rt.voices.forEach(v => { try { v.bus.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05) } catch (_) {} })
    }

    async function startScene(scene) {
      stopScene()
      setLoading(true)
      const ids = [...new Set(scene.voices.filter(v => v.id).map(v => v.id))]
      let buffers = {}
      try {
        const bufs = await Promise.all(ids.map(loadBuffer))
        ids.forEach((id, i) => { buffers[id] = bufs[i] })
      } catch (_) {
        setLoading(false)
        return
      }
      if (current !== null && current.scene === scene) return  // superseded

      const rt = { scene, voices: [], timers: [], continuous: [], transport: null }
      scene.voices.forEach(v => {
        const bus = makeBus()
        const voice = { def: v, bus, clarity: 0, x: v.pos[0], y: v.pos[1], pulse: 0 }
        if (v.kind === 'realCont') {
          const b = buffers[v.id]
          const src = ctx.createBufferSource(); src.buffer = b; src.loop = true
          if (b.duration > 40) { src.loopStart = 2; src.loopEnd = Math.min(b.duration - 2, 34) }
          src.connect(bus.input); src.start(); rt.continuous.push(src)
        } else if (v.kind === 'procCont') {
          rt.continuous.push({ stop: synthContinuous(v.synth, bus, { chord: v.chord, tones: v.tones }) })
        } else if (v.kind === 'realEvent') {
          voice.fire = () => fireSlice(bus, buffers[v.id], v.slice)
          if (!scene.music) scheduleEvent(rt, voice)
        } else if (v.kind === 'procEvent') {
          voice.fire = (freq) => synthNote(v.synth, bus, { freq })
          if (!scene.music && v.note) {
            voice._interval = () => voice.fire(v.note[Math.floor(Math.random() * v.note.length)])
            scheduleEvent(rt, voice)
          } else if (!scene.music) {
            voice._interval = () => voice.fire()
            scheduleEvent(rt, voice)
          }
        }
        rt.voices.push(voice)
      })

      if (scene.music) {
        const stepDur = 60 / scene.music.bpm / 2
        let step = 0
        rt.transport = setInterval(() => {
          rt.voices.forEach(voice => {
            const v = voice.def; if (!v.pattern) return
            const cell = v.pattern[step % v.pattern.length]
            if (cell) { voice.fire(cell === 1 ? undefined : cell); voice.pulse = 1 }
          })
          step++
        }, stepDur * 1000)
      }

      current = rt
      setLoading(false)
    }

    // ── Pointer / dwell ────────────────────────────────────────────────────────
    let W = 0, H = 0, DPR = 1
    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * DPR; canvas.height = H * DPR
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      g.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    window.addEventListener('resize', resize); resize()

    let px = -999, py = -999, active = false, vel = 0, lastX = 0, lastY = 0, lastT = 0
    function onMove(x, y) {
      const now = performance.now()
      if (lastT) { const dt = Math.max(1, now - lastT) / 1000; const d = Math.hypot(x - lastX, y - lastY); vel = 0.6 * vel + 0.4 * (d / dt) }
      lastX = x; lastY = y; lastT = now; px = x; py = y
    }
    const onDown = e => { active = true; lastT = 0; vel = 0; onMove(e.clientX, e.clientY); try { stage.setPointerCapture(e.pointerId) } catch (_) {} }
    const onPMove = e => { if (active || e.pointerType !== 'touch') { active = true; onMove(e.clientX, e.clientY) } }
    const onUp = () => { active = false }
    stage.addEventListener('pointerdown', onDown)
    stage.addEventListener('pointermove', onPMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    // Dwell episodes for the summary (contiguous pointer-still stretches)
    let episodeStart = null
    const episodes = []
    const closeEpisode = now => { if (episodeStart != null) { episodes.push(now - episodeStart); episodeStart = null } }

    engineRef.current = {
      loadScene(idx) { startScene(SCENES[idx]) },
      collectEpisodes() { closeEpisode(performance.now()); return [...episodes] },
    }

    function hexA(hex, a) {
      const h = hex.replace('#', '')
      return `rgba(${parseInt(h.substr(0, 2), 16)},${parseInt(h.substr(2, 2), 16)},${parseInt(h.substr(4, 2), 16)},${a})`
    }
    function drawAnchor(x, y, voice, acc) {
      const c = voice.clarity
      const R = 26 + c * 64 + voice.pulse * 10
      const gl = g.createRadialGradient(x, y, 0, x, y, R)
      const a = 0.10 + c * 0.55 + voice.pulse * 0.25
      gl.addColorStop(0, hexA(acc, a)); gl.addColorStop(1, hexA(acc, 0))
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill()
      g.beginPath(); g.arc(x, y, 3 + c * 3, 0, 7); g.fillStyle = hexA(acc, 0.5 + c * 0.5); g.fill()
      if (c > 0.08) {
        g.font = '600 12px -apple-system,Segoe UI,Roboto,sans-serif'; g.textAlign = 'center'
        g.fillStyle = hexA('#eef2f4', Math.min(1, c * 1.4)); g.fillText(voice.def.name, x, y + R + 16)
      }
    }

    let lastFrame = performance.now(), rafId = 0
    function frame() {
      const now = performance.now(); const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now
      if (now - lastT > 60) vel *= Math.pow(0.0001, dt)
      const dwelling = active && vel < DWELL_VELOCITY
      if (dwelling && episodeStart == null) episodeStart = now
      else if (!dwelling) closeEpisode(now)

      g.clearRect(0, 0, W, H)
      const acc = current ? current.scene.accent : '#6fd0b0'
      const bg = g.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.75)
      bg.addColorStop(0, '#141b24'); bg.addColorStop(1, '#070a0e')
      g.fillStyle = bg; g.fillRect(0, 0, W, H)

      if (current) {
        let A = 0
        current.voices.forEach(voice => {
          const ax = voice.x * W, ay = voice.y * H
          const inRange = Math.hypot(px - ax, py - ay) < INFLUENCE_RADIUS
          if (dwelling && inRange) voice.clarity = Math.min(1, voice.clarity + GROWTH_RATE * dt)
          else voice.clarity = Math.max(0, voice.clarity - DECAY_RATE * dt)
          if (voice.clarity > A) A = voice.clarity
        })
        current.voices.forEach(voice => {
          const v = voice.def, c = voice.clarity
          const duck = Math.max(DUCK_FLOOR, 1 - DUCK_DEPTH * (A - c))
          voice.bus.out.gain.setTargetAtTime(v.rest * duck, ctx.currentTime, 0.10)
          voice.bus.lp.frequency.setTargetAtTime(FREQ_MUFFLED + c * (v.freqClear - FREQ_MUFFLED), ctx.currentTime, 0.08)
          if (voice.pulse > 0) voice.pulse = Math.max(0, voice.pulse - dt * 2.2)
          drawAnchor(voice.x * W, voice.y * H, voice, acc)
        })
      }
      if (active) {
        g.beginPath(); g.arc(px, py, INFLUENCE_RADIUS, 0, 7); g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.stroke()
        g.beginPath(); g.arc(px, py, dwelling ? 9 : 6, 0, 7); g.fillStyle = dwelling ? acc : 'rgba(255,255,255,.5)'; g.fill()
      }
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)

    // initial scene
    startScene(SCENES[sceneIdxRef.current])

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      stage.removeEventListener('pointerdown', onDown)
      stage.removeEventListener('pointermove', onPMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stopScene()
      engineRef.current = null
      try { ctx.close() } catch (_) {}
    }
  }, [phase])

  // Track which scenes get visited (for the summary metric)
  useEffect(() => {
    if (phase === 'play') visitedRef.current.add(SCENES[sceneIdx].key)
  }, [phase, sceneIdx])

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'play') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#070a0e', zIndex: 50, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <div ref={stageRef} style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'none' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        <div style={S.topbar}>
          {SCENES.map((s, i) => (
            <button key={s.key}
              onClick={() => pickScene(i)}
              style={{ ...S.sceneBtn, ...(i === sceneIdx ? { ...S.sceneBtnOn, background: s.accent, borderColor: s.accent } : {}) }}>
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ ...S.blurb, opacity: loading ? 0 : 0.7 }}>{SCENES[sceneIdx].blurb}</div>
        {loading && <div style={S.loader}>gathering sounds…</div>}
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

  topbar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 6,
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
    padding: '10px 12px', background: 'linear-gradient(#0a0d12ee,#0a0d1200)',
  },
  sceneBtn: {
    font: 'inherit', fontSize: 12, color: '#8fa0ad', background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.10)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer',
  },
  sceneBtnOn: { color: '#06110d', fontWeight: 600 },

  blurb: {
    position: 'fixed', bottom: 54, left: '50%', transform: 'translateX(-50%)',
    color: '#c7d0d6', fontSize: '0.8rem', letterSpacing: '0.06em', pointerEvents: 'none',
    textAlign: 'center', width: '90%', textShadow: '0 1px 10px rgba(0,0,0,0.7)', transition: 'opacity 1.2s ease',
  },
  loader: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    color: '#8fa0ad', fontSize: 13, letterSpacing: '0.08em', pointerEvents: 'none',
  },
  finishBtn: {
    position: 'fixed', bottom: 18, right: 22, background: 'transparent', border: 'none', color: '#c7d0d6',
    opacity: 0.4, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'lowercase',
    cursor: 'pointer', padding: '8px 10px', fontFamily: 'inherit', textShadow: '0 1px 8px rgba(0,0,0,0.6)',
  },
}
