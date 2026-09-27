/* ── Owl Barn audio ───────────────────────────────────────────────────────────

   Web Audio synthesis only (no files). The hoot is the old useOwlAudio voice,
   kept because it sounds right; what changed is timing:

     * every hoot is SCHEDULED on the audio clock (`start`/`stop` at exact
       ctx times) instead of being started from a setTimeout - the game's phase
       boundaries are defined in audio-clock time, so what the player hears and
       what the game judges are the same instant;
     * output latency is reported so the engine can judge taps against when
       the silence was HEARD (Bluetooth output adds 150-300 ms);
     * iOS: the context is created on the Begin gesture and resumed on
       visibility change and on the next gesture after an interruption.
──────────────────────────────────────────────────────────────────────────── */

export function createOwlAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx({ latencyHint: 'interactive' })
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination)
  let noiseBuf = null
  const hoots = new Set()

  function noise() {
    if (noiseBuf) return noiseBuf
    const len = Math.ceil(ctx.sampleRate * 3)
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return noiseBuf
  }

  const resume = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}) }
  const onVis = () => { if (document.visibilityState === 'visible') resume() }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('pointerdown', resume, true)
  window.addEventListener('keydown', resume, true)

  /** Three staggered owl voices from `t0` to `t1` (ctx seconds); the fade-out ends exactly at t1. */
  function hoot(t0, t1) {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.26, t0 + 0.16)
    g.gain.setValueAtTime(0.26, Math.max(t0 + 0.16, t1 - 0.22))
    g.gain.linearRampToValueAtTime(0, t1)
    g.connect(master)
    const nodes = []
    for (const { pan, pitch, onset, rate } of [
      { pan: -0.55, pitch: 340, onset: 0, rate: 5.8 },
      { pan: 0.42, pitch: 347, onset: 0.082, rate: 6.1 },
      { pan: 0.02, pitch: 333, onset: 0.158, rate: 5.95 },
    ]) {
      const t = t0 + onset
      const lfo = ctx.createOscillator(); lfo.frequency.value = rate
      const lfoG = ctx.createGain(); lfoG.gain.value = 7.8 + Math.random() * 1.4
      const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(pitch + (Math.random() * 3 - 1.5), t)
      lfo.connect(lfoG); lfoG.connect(osc.frequency)
      const v = ctx.createGain(); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.62 + Math.random() * 0.22, t + 0.12)
      const p = ctx.createStereoPanner(); p.pan.value = pan
      osc.connect(v); v.connect(p); p.connect(g)
      const n = ctx.createBufferSource(); n.buffer = noise(); n.loop = true
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = pitch * 1.45; bp.Q.value = 3.2
      const ng = ctx.createGain(); ng.gain.value = 0.06
      n.connect(bp); bp.connect(ng); ng.connect(p)
      for (const s of [lfo, osc, n]) { s.start(t); s.stop(t1 + 0.05); nodes.push(s) }
    }
    const h = { g, nodes }; hoots.add(h)
    nodes[0].onended = () => hoots.delete(h)
    return h
  }

  /** Cut a scheduled hoot short (a swoop interrupts it). */
  function cancelHoot(h) {
    if (!h) return
    const now = ctx.currentTime
    h.g.gain.cancelScheduledValues(now); h.g.gain.setValueAtTime(h.g.gain.value, now); h.g.gain.linearRampToValueAtTime(0, now + 0.12)
    for (const s of h.nodes) { try { s.stop(now + 0.15) } catch (_) { /* already stopped */ } }
    hoots.delete(h)
  }

  function tone(freq, t, dur, gain, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.value = freq
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02)
  }

  const api = {
    ctx,
    now: () => ctx.currentTime,
    latencySec: () => (ctx.outputLatency || 0) + (ctx.baseLatency || 0),
    info: () => ({ sampleRate: ctx.sampleRate, baseLatency: ctx.baseLatency ?? null, outputLatency: ctx.outputLatency ?? null, state: ctx.state }),
    /** performance.now()-based timestamp (e.g. event.timeStamp) → ctx seconds. */
    toCtx(perfMs) {
      const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null
      if (ts && ts.performanceTime) return ts.contextTime + (perfMs - ts.performanceTime) / 1000
      return ctx.currentTime - (performance.now() - perfMs) / 1000
    },
    resume,
    hoot, cancelHoot,
    tap(count) {
      if (count < 1 || count > 8) return
      const green = count === 3 || count === 8
      tone(count === 8 ? 1047 : count === 3 ? 880 : 260 + count * 36, ctx.currentTime, green ? 0.24 : 0.1, green ? 0.22 : 0.11)
    },
    swoop() {
      const t = ctx.currentTime
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(640, t); o.frequency.exponentialRampToValueAtTime(72, t + 0.62)
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.9)
      tone(90, t + 0.6, 0.3, 0.18)
    },
    crossed() { [523, 659, 784, 1047].forEach((f, i) => tone(f, ctx.currentTime + i * 0.13, 0.42, 0.2)) },
    chime() { tone(1318, ctx.currentTime, 0.9, 0.08); tone(1976, ctx.currentTime + 0.05, 1.1, 0.05) },
    /** Quiet barn bed: low wind, faint creaks. Returns a stop function. */
    ambience() {
      const n = ctx.createBufferSource(); n.buffer = noise(); n.loop = true
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420
      const g = ctx.createGain(); g.gain.value = 0.035
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.02
      lfo.connect(lg); lg.connect(g.gain)
      n.connect(lp); lp.connect(g); g.connect(master); n.start(); lfo.start()
      return () => { try { n.stop(); lfo.stop() } catch (_) { /* stopped */ } }
    },
    close() {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointerdown', resume, true)
      window.removeEventListener('keydown', resume, true)
      for (const h of hoots) cancelHoot(h)
      ctx.close().catch(() => {})
    },
  }
  return api
}
