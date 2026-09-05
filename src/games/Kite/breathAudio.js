// ── breathAudio ─────────────────────────────────────────────────────────────
// Breath-noise engine for Free Breathing: looped white noise → bandpass →
// gain. Loudness follows airflow (|dFullness/dt|), not fullness — so a breath
// swells at the start of a hold and dies away as the lungs approach full or
// empty, which is how breathing actually sounds; a pause is genuinely silent.
// Inhale sits in a higher band than exhale, like air over the palate vs a
// sigh. No assets, no fetches; context is created inside the Begin click so
// autoplay policy is satisfied.

const MAX_GAIN = 0.12
const FLOW_K   = 1.8          // flow (≈0–0.65/s) → 0–1 loudness before MAX_GAIN
const FREQ     = { in: 950, out: 520 }

export function createBreathAudio() {
  let ctx = null
  let gain = null
  let filter = null

  function ensure() {
    if (ctx) return true
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      ctx = new AC()
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = FREQ.in
      filter.Q.value = 0.9
      gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      src.start()
      return true
    } catch {
      ctx = null
      return false
    }
  }

  return {
    start() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {})
    },
    // Call every animation frame with the live control ('in'|'out'|'pause')
    // and airflow in fullness-units per second.
    update(control, flow) {
      if (!ctx || ctx.state !== 'running') return
      const t = ctx.currentTime
      const target = control === 'pause' ? 0 : Math.min(1, flow * FLOW_K) * MAX_GAIN
      gain.gain.setTargetAtTime(target, t, 0.08)
      if (control !== 'pause') filter.frequency.setTargetAtTime(FREQ[control], t, 0.15)
    },
    stop() {
      if (!ctx) return
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
      setTimeout(() => { ctx?.suspend?.().catch(() => {}) }, 250)
    },
    dispose() {
      if (!ctx) return
      try { ctx.close() } catch { /* already closed */ }
      ctx = null
    },
  }
}
