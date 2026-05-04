/**
 * useOwlAudio — Web Audio synthesis for OwlBarn
 *
 * Returns a stable API object (all functions close over internal refs).
 * No WAV files — all sounds are synthesised at runtime.
 *
 * Owl hoot synthesis parameters (per spec):
 *   base pitch ~340 Hz, vibrato 6 Hz / 8 Hz depth, breathiness ~6%
 *   3 staggered voices, stereo-panned, independent pitch variation
 */

import { useRef, useMemo } from 'react'

export function useOwlAudio() {
  const s = useRef({
    ctx:      null,    // AudioContext
    voices:   [],      // active oscillator nodes per hoot voice
    master:   null,    // master GainNode for current hoot
    noiseBuf: null,    // pre-generated white-noise buffer (reused across hoots)
  })

  return useMemo(() => {

    // ── Internal helpers ─────────────────────────────────────────────────────

    function getCtx() {
      if (!s.current.ctx) {
        s.current.ctx = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = s.current.ctx
      if (ctx.state === 'suspended') ctx.resume()
      return ctx
    }

    function getNoiseBuf(ctx) {
      if (!s.current.noiseBuf) {
        const len = Math.ceil(ctx.sampleRate * 3)
        const buf = ctx.createBuffer(1, len, ctx.sampleRate)
        const d   = buf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
        s.current.noiseBuf = buf
      }
      return s.current.noiseBuf
    }

    function killVoices() {
      s.current.voices.forEach(v => {
        ['osc', 'lfo', 'noise'].forEach(k => { try { v[k].stop(0) } catch (_) {} })
      })
      s.current.voices = []
      s.current.master = null
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * startHoot — launch 3 owl-voice synthesis chains.
     * Voices stagger ~80 ms, each with independent pitch/pan/vibrato.
     */
    function startHoot() {
      const ctx = getCtx()
      killVoices()

      const master = ctx.createGain()
      master.gain.setValueAtTime(0, ctx.currentTime)
      master.gain.linearRampToValueAtTime(0.26, ctx.currentTime + 0.16)
      master.connect(ctx.destination)
      s.current.master = master

      const noiseBuf = getNoiseBuf(ctx)

      const voiceDefs = [
        { pan: -0.55, pitch: 340, onset: 0,     vibratoRate: 5.8  },
        { pan:  0.42, pitch: 347, onset: 0.082, vibratoRate: 6.1  },
        { pan:  0.02, pitch: 333, onset: 0.158, vibratoRate: 5.95 },
      ]

      s.current.voices = voiceDefs.map(({ pan, pitch, onset, vibratoRate }) => {
        const t = ctx.currentTime + onset

        // Vibrato LFO: sine → gain node → frequency input of carrier
        const lfo     = ctx.createOscillator()
        lfo.type      = 'sine'
        lfo.frequency.value = vibratoRate
        const lfoGain = ctx.createGain()
        lfoGain.gain.value  = 7.8 + Math.random() * 1.4  // depth in Hz

        // Carrier: sine wave (pure hoot tone)
        const osc = ctx.createOscillator()
        osc.type  = 'sine'
        osc.frequency.setValueAtTime(pitch + (Math.random() * 3 - 1.5), t)
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)

        // Per-voice gain envelope
        const vGain = ctx.createGain()
        vGain.gain.setValueAtTime(0, t)
        vGain.gain.linearRampToValueAtTime(0.62 + Math.random() * 0.22, t + 0.12)

        // Panner
        const panner = ctx.createStereoPanner()
        panner.pan.value = pan

        osc.connect(vGain)
        vGain.connect(panner)
        panner.connect(master)

        // Breathiness: band-passed noise at ~6%
        const noiseNode = ctx.createBufferSource()
        noiseNode.buffer = noiseBuf
        noiseNode.loop   = true
        const bp = ctx.createBiquadFilter()
        bp.type           = 'bandpass'
        bp.frequency.value = pitch * 1.45
        bp.Q.value         = 3.2
        const noiseGain = ctx.createGain()
        noiseGain.gain.value = 0.06

        noiseNode.connect(bp)
        bp.connect(noiseGain)
        noiseGain.connect(panner)

        lfo.start(t)
        osc.start(t)
        noiseNode.start(t)

        return { osc, lfo, noise: noiseNode }
      })
    }

    /**
     * stopHoot — ramp master gain to 0 over ~220ms, then kill nodes.
     * This creates the "silence falls" moment that cues the player.
     */
    function stopHoot() {
      const ctx = s.current.ctx
      if (!ctx || !s.current.master) return
      const now    = ctx.currentTime
      const master = s.current.master
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.22)
      const voices = [...s.current.voices]
      s.current.voices = []
      s.current.master = null
      // Kill nodes after ramp completes
      setTimeout(() => {
        voices.forEach(v => {
          ['osc', 'lfo', 'noise'].forEach(k => { try { v[k].stop(0) } catch (_) {} })
        })
      }, 340)
    }

    /**
     * playTap — soft pulse per tap; pitch rises with count.
     * Green flash (counts 3 and 8) plays a brighter chime.
     */
    function playTap(tapCount) {
      if (tapCount < 1 || tapCount > 8) return
      const ctx = getCtx()
      const now = ctx.currentTime
      const isGreen = tapCount === 3 || tapCount === 8
      const freq = tapCount === 8 ? 1047 : tapCount === 3 ? 880 : 260 + tapCount * 36
      const dur  = isGreen ? 0.24 : 0.1

      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type            = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(isGreen ? 0.22 : 0.11, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + dur + 0.02)
    }

    /**
     * playSwoop — rapid descending sweep (wing flap + impact).
     */
    function playSwoop() {
      const ctx = getCtx()
      const now = ctx.currentTime

      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(640, now)
      osc.frequency.exponentialRampToValueAtTime(72, now + 0.62)
      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.9)

      // Impact thud
      const thud  = ctx.createOscillator()
      const tGain = ctx.createGain()
      thud.type = 'sine'
      thud.frequency.setValueAtTime(90, now + 0.6)
      thud.frequency.exponentialRampToValueAtTime(40, now + 0.85)
      tGain.gain.setValueAtTime(0.18, now + 0.6)
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
      thud.connect(tGain)
      tGain.connect(ctx.destination)
      thud.start(now + 0.6)
      thud.stop(now + 0.95)
    }

    /**
     * playBarnCrossed — triumphant ascending arpeggio.
     */
    function playBarnCrossed() {
      const ctx = getCtx()
      const now = ctx.currentTime
      ;[523, 659, 784, 1047].forEach((freq, i) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        const t    = now + i * 0.13
        osc.type            = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.2, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.46)
      })
    }

    return { startHoot, stopHoot, playTap, playSwoop, playBarnCrossed }

  }, []) // stable — all functions close over the `s` ref
}
